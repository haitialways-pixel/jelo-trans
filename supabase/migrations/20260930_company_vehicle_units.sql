-- 2026-09-30 company physical vehicles on public.vehicle_units.
-- Run this in the Supabase SQL editor on the live project.
-- Do NOT re-run supabase/schema.sql (it drops live tables).
-- Does not change bookable fleet classes, rates, flat fares, deposits,
-- staff roles, SMTP, or DNS. Does not drop existing vehicle_units.

-- ---------------------------------------------------------------------------
-- Registration fields the manager can see and edit.
-- license_plate remains the Florida tag. VIN / make / model / expiration
-- were not on this table.
-- ---------------------------------------------------------------------------
ALTER TABLE public.vehicle_units
  ADD COLUMN IF NOT EXISTS make text,
  ADD COLUMN IF NOT EXISTS model_name text,
  ADD COLUMN IF NOT EXISTS vin text,
  ADD COLUMN IF NOT EXISTS registration_expires date;

COMMENT ON COLUMN public.vehicle_units.make IS
  'Manufacturer from the registration card, e.g. Chevrolet.';
COMMENT ON COLUMN public.vehicle_units.model_name IS
  'Model and trim from the registration card, e.g. Suburban LT.';
COMMENT ON COLUMN public.vehicle_units.vin IS
  'Vehicle identification number from the Florida registration card.';
COMMENT ON COLUMN public.vehicle_units.license_plate IS
  'Florida license tag.';
COMMENT ON COLUMN public.vehicle_units.registration_expires IS
  'Florida registration expiration date.';

-- ---------------------------------------------------------------------------
-- Seed the 13 company cars. Match on license_plate so a re-run does not
-- duplicate rows. 12 SUVs → Full-Size SUV. Tesla → 2023 Tesla Model Y.
-- Luxury Sedan stays the partner-sedan class and is never used here.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_suv uuid;
  v_tesla uuid;
  v_updated integer := 0;
  v_inserted integer := 0;
  r record;
  v_model uuid;
  v_label text;
BEGIN
  SELECT id INTO v_suv
  FROM public.fleet
  WHERE name = 'Full-Size SUV'
  ORDER BY display_order
  LIMIT 1;

  IF v_suv IS NULL THEN
    SELECT id INTO v_suv
    FROM public.fleet
    WHERE status = 'available'
      AND name !~* '(tesla|model y|sprinter|stretch|escalade|party|sedan)'
      AND (
        type IN ('luxury_suv', 'executive_suburban')
        OR name ~* '(suv|suburban|yukon|expedition|full-size)'
      )
    ORDER BY CASE WHEN type = 'luxury_suv' THEN 0 ELSE 1 END, display_order
    LIMIT 1;
  END IF;

  IF v_suv IS NULL THEN
    RAISE EXCEPTION 'Full-Size SUV bookable class is missing. Do not insert a new class.';
  END IF;

  SELECT id INTO v_tesla
  FROM public.fleet
  WHERE name ~* '(tesla|model y)'
  ORDER BY display_order
  LIMIT 1;

  IF v_tesla IS NULL THEN
    RAISE EXCEPTION '2023 Tesla Model Y bookable class is missing. Do not insert a new class.';
  END IF;

  FOR r IN
    SELECT * FROM (
      VALUES
        (2021, 'Chevrolet', 'Suburban LT',            '1GNSCCKD3MR315885', 'FK12U',  DATE '2026-06-30', 'suv'),
        (2021, 'GMC',       'Yukon XL SLT',           '1GKS2GKD3MR482514', '11ALJC', DATE '2027-01-06', 'suv'),
        (2022, 'Chevrolet', 'Suburban LT',            '1GNSCCKDXNR165890', '39EJGV', DATE '2027-09-21', 'suv'),
        (2022, 'GMC',       'Yukon XL SLT',           '1GKS1GKD0NR156884', 'DI11NC', DATE '2028-01-15', 'suv'),
        (2023, 'Chevrolet', 'Suburban Premier',       '1GNSCFKD7PR178522', '03EZTL', DATE '2026-06-30', 'suv'),
        (2023, 'Chevrolet', 'Suburban LS',            '1GNSCBKD3PR164030', '33DFRY', DATE '2027-06-17', 'suv'),
        (2023, 'GMC',       'Yukon XL SLT',           '1GKS2GKD4PR156225', 'CT81DF', DATE '2027-06-13', 'suv'),
        (2023, 'Tesla',     'Model Y',                '7SAYGAEE0PF774921', 'BN11SR', DATE '2028-02-11', 'tesla'),
        (2024, 'Chevrolet', 'Suburban LT',            '1GNSCCKTXRR319933', 'RJSC34', DATE '2027-01-06', 'suv'),
        (2024, 'Chevrolet', 'Suburban LS',            '1GNSCBKD9RR151723', 'LUCJ04', DATE '2027-04-09', 'suv'),
        (2024, 'Chevrolet', 'Suburban LS',            '1GNSCBKT6RR111994', 'LEKR82', DATE '2028-03-10', 'suv'),
        (2024, 'Ford',      'Expedition MAX Limited', '1FMJK1K82REA26103', '30VCBK', DATE '2027-09-21', 'suv'),
        (2024, 'Ford',      'Expedition MAX Limited', '1FMJK1K87REA52082', 'XKG282', DATE '2026-09-21', 'suv')
    ) AS s(year, make, model_name, vin, license_plate, registration_expires, class_key)
  LOOP
    v_model := CASE WHEN r.class_key = 'tesla' THEN v_tesla ELSE v_suv END;
    v_label := r.year::text || ' ' || r.make || ' ' || r.model_name || ' · ' || r.license_plate;

    UPDATE public.vehicle_units
    SET
      model_id = v_model,
      label = v_label,
      year = r.year,
      make = r.make,
      model_name = r.model_name,
      vin = r.vin,
      license_plate = r.license_plate,
      registration_expires = r.registration_expires,
      updated_at = now()
    WHERE upper(btrim(license_plate)) = upper(btrim(r.license_plate));

    IF FOUND THEN
      v_updated := v_updated + 1;
    ELSE
      INSERT INTO public.vehicle_units (
        model_id, label, year, make, model_name, vin, license_plate, registration_expires, status
      ) VALUES (
        v_model, v_label, r.year, r.make, r.model_name, r.vin, r.license_plate, r.registration_expires, 'available'
      );
      v_inserted := v_inserted + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'company vehicle_units: % updated, % inserted', v_updated, v_inserted;
END;
$$;

DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS vehicle_units_license_plate_norm_uidx
    ON public.vehicle_units (upper(btrim(license_plate)))
    WHERE license_plate IS NOT NULL AND btrim(license_plate) <> '';
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'Skipping license_plate unique index; duplicate tags already exist.';
END $$;

DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS vehicle_units_vin_norm_uidx
    ON public.vehicle_units (upper(btrim(vin)))
    WHERE vin IS NOT NULL AND btrim(vin) <> '';
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'Skipping VIN unique index; duplicate VINs already exist.';
END $$;
