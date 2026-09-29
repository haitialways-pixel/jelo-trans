-- 2026-09-29 fleet classes, MCO flat fares, and stop auto-promoting Auth users.
-- Run this in the Supabase SQL editor on the live project.
-- Do NOT re-run supabase/schema.sql (it drops live tables).
-- Existing public.staff rows are not deleted or updated.

-- ---------------------------------------------------------------------------
-- Rate class + MCO flat fare. Mirrors lib/flatRates.ts and lib/catalog.ts.
-- Hourly charters never use this. Mileage remains the default otherwise.
-- A flat fare replaces base+miles only when exactly one end is MCO.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fleet_rate_class(p_name text, p_type text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  s text := lower(coalesce(p_name, '') || ' ' || coalesce(p_type, ''));
BEGIN
  IF s ~ '(tesla|model[[:space:]]*y)' THEN
    RETURN 'sedan';
  END IF;
  IF s ~ '(sedan|s-class|s class|lincoln|continental|e-class|c-class)'
     AND s !~ '(suv|suburban|yukon|expedition|escalade|tahoe)' THEN
    RETURN 'sedan';
  END IF;
  RETURN 'suv';
END;
$$;

CREATE OR REPLACE FUNCTION public.mco_flat_fare(
  p_pickup text,
  p_dropoff text,
  p_rate_class text,
  p_round_trip boolean
) RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  a text;
  b text;
  pickup_mco boolean;
  dropoff_mco boolean;
  other text;
  best_len int := 0;
  best_sedan numeric;
  best_suv numeric;
  dest record;
BEGIN
  a := lower(regexp_replace(coalesce(p_pickup, ''), '\s+', ' ', 'g'));
  b := lower(regexp_replace(coalesce(p_dropoff, ''), '\s+', ' ', 'g'));

  pickup_mco := a ~ '\mmco\M'
    OR a LIKE '%orlando international%'
    OR a LIKE '%orlando intl%'
    OR a LIKE '%mco airport%'
    OR a LIKE '%airport mco%'
    OR a LIKE '%(mco)%'
    OR a LIKE '%1 jeff fuqua%'
    OR a LIKE '%jeff fuqua boulevard%'
    OR a LIKE '%jeff fuqua blvd%';
  dropoff_mco := b ~ '\mmco\M'
    OR b LIKE '%orlando international%'
    OR b LIKE '%orlando intl%'
    OR b LIKE '%mco airport%'
    OR b LIKE '%airport mco%'
    OR b LIKE '%(mco)%'
    OR b LIKE '%1 jeff fuqua%'
    OR b LIKE '%jeff fuqua boulevard%'
    OR b LIKE '%jeff fuqua blvd%';

  IF pickup_mco = dropoff_mco THEN
    RETURN NULL;
  END IF;

  other := CASE WHEN pickup_mco THEN b ELSE a END;

  FOR dest IN
    SELECT * FROM (VALUES
      ('universal orlando', 80::numeric, 95::numeric),
      ('universal studios', 80, 95),
      ('islands of adventure', 80, 95),
      ('universal citywalk', 80, 95),
      ('citywalk', 80, 95),
      ('camping world stadium', 80, 95),
      ('camping world', 80, 95),
      ('the wheel at icon', 80, 95),
      ('icon park', 80, 95),
      ('i-drive 360', 80, 95),
      ('seaworld', 70, 85),
      ('sea world', 70, 85),
      ('hollywood studios', 100, 120),
      ('disney springs', 100, 120),
      ('magic kingdom', 110, 130),
      ('animal kingdom', 110, 130),
      ('pointe orlando', 110, 135),
      ('medieval times', 200, 250),
      ('kennedy space', 200, 250),
      ('ksc visitor', 200, 250),
      ('space center visitor', 200, 250),
      ('port canaveral', 200, 250),
      ('canaveral cruise', 200, 250),
      ('cruise terminal a', 200, 250),
      ('cruise terminal b', 200, 250),
      ('cruise terminal 1', 200, 250),
      ('cruise terminal 2', 200, 250),
      ('cruise terminal 3', 200, 250),
      ('cruise terminal 5', 200, 250),
      ('cruise terminal 6', 200, 250),
      ('cruise terminal 8', 200, 250),
      ('legoland', 300, 375),
      ('gatorland', 50, 65),
      ('epcot', 100, 120)
    ) AS t(needle, sedan, suv)
  LOOP
    IF position(dest.needle in other) > 0 AND length(dest.needle) > best_len THEN
      best_len := length(dest.needle);
      best_sedan := dest.sedan;
      best_suv := dest.suv;
    END IF;
  END LOOP;

  IF best_len = 0 THEN
    RETURN NULL;
  END IF;

  RETURN round(
    (CASE WHEN p_rate_class = 'suv' THEN best_suv ELSE best_sedan END)
    * (CASE WHEN coalesce(p_round_trip, false) THEN 2 ELSE 1 END),
    2
  );
END;
$$;

-- Guest create_reservation: flat fare when the MCO rule matches, otherwise
-- base + miles (minimum applies only to mileage). Charters stay hourly.
CREATE OR REPLACE FUNCTION public.create_reservation(
  p_customer_name    text,
  p_customer_email   text,
  p_customer_phone   text,
  p_pickup_address   text,
  p_dropoff_address  text,
  p_pickup_time      timestamptz,
  p_vehicle_id       uuid,
  p_passengers       integer,
  p_luggage          integer,
  p_duration_hours   numeric,
  p_special_requests text,
  p_distance_miles   numeric,
  p_gratuity_percent numeric DEFAULT 18
)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_duration         numeric(10,2) := greatest(coalesce(p_duration_hours, 1.0), 0.25);
  v_distance         numeric(10,2) := greatest(coalesce(p_distance_miles, 0.0), 0.0);
  v_base_price       numeric(10,2);
  v_price_per_mile   numeric(10,2);
  v_minimum_price    numeric(10,2);
  v_hourly_rate      numeric(10,2);
  v_vehicle_name     text;
  v_vehicle_type     text;
  v_flat             numeric;
  v_fare             numeric(10,2);
  v_gratuity_percent numeric(5,2);
  v_gratuity_amount  numeric(10,2);
  v_total            numeric(10,2);
  v_booking          text;
  v_reservation_id   uuid;
  v_is_charter       boolean := btrim(coalesce(p_special_requests, '')) LIKE 'Trip type: Charter%';
  v_is_round         boolean := btrim(coalesce(p_special_requests, '')) LIKE 'Trip type: Round trip%';
BEGIN
  IF coalesce(btrim(p_customer_name), '')  = '' THEN RAISE EXCEPTION 'Customer name is required'; END IF;
  IF coalesce(btrim(p_customer_email), '') = '' THEN RAISE EXCEPTION 'Customer email is required'; END IF;
  IF coalesce(btrim(p_customer_phone), '') = '' THEN RAISE EXCEPTION 'Customer phone is required'; END IF;
  IF p_pickup_time IS NULL OR p_pickup_time < now() + interval '10 minutes' THEN
    RAISE EXCEPTION 'Pickup must be at least 15 minutes from now';
  END IF;

  v_gratuity_percent := coalesce(p_gratuity_percent, 18);
  IF v_gratuity_percent NOT IN (15, 18, 22) THEN
    RAISE EXCEPTION 'Gratuity must be 15, 18, or 22 percent';
  END IF;

  BEGIN
    SELECT name, type, base_price, price_per_mile, coalesce(minimum_price, 0),
           coalesce(nullif(hourly_rate, 0), base_price)
      INTO v_vehicle_name, v_vehicle_type, v_base_price, v_price_per_mile, v_minimum_price, v_hourly_rate
      FROM public.fleet WHERE id = p_vehicle_id;
  EXCEPTION WHEN undefined_column THEN
    SELECT name, type, base_price, price_per_mile, coalesce(minimum_price, 0), base_price
      INTO v_vehicle_name, v_vehicle_type, v_base_price, v_price_per_mile, v_minimum_price, v_hourly_rate
      FROM public.fleet WHERE id = p_vehicle_id;
  END;
  IF NOT FOUND THEN RAISE EXCEPTION 'Selected vehicle not found'; END IF;

  IF v_is_charter THEN
    v_flat := NULL;
  ELSE
    v_flat := public.mco_flat_fare(
      p_pickup_address,
      p_dropoff_address,
      public.fleet_rate_class(v_vehicle_name, v_vehicle_type),
      v_is_round
    );
  END IF;

  IF v_is_charter THEN
    v_duration := greatest(v_duration, 3);
    v_distance := 0;
    v_fare := round(v_duration * coalesce(v_hourly_rate, v_base_price), 2);
  ELSIF v_flat IS NOT NULL THEN
    v_fare := v_flat;
  ELSE
    v_fare := greatest(round((v_base_price + (v_distance * v_price_per_mile)), 2), v_minimum_price);
  END IF;
  v_gratuity_amount := round(v_fare * v_gratuity_percent / 100, 2);
  v_total := round(v_fare + v_gratuity_amount, 2);

  INSERT INTO public.reservations (
    customer_name, customer_email, customer_phone,
    pickup_address, dropoff_address, pickup_time,
    vehicle_id, passengers, luggage, duration_hours, distance_miles,
    fare_subtotal, gratuity_percent, gratuity_amount,
    total_price, status, payment_status, special_requests
  ) VALUES (
    p_customer_name, p_customer_email, p_customer_phone,
    p_pickup_address, p_dropoff_address, p_pickup_time,
    p_vehicle_id, greatest(coalesce(p_passengers, 1), 1), greatest(coalesce(p_luggage, 0), 0),
    v_duration, v_distance,
    v_fare, v_gratuity_percent, v_gratuity_amount,
    v_total, 'pending', 'unpaid', nullif(btrim(p_special_requests), '')
  )
  RETURNING id, booking_number INTO v_reservation_id, v_booking;

  BEGIN
    PERFORM public.create_notification(
      'new_booking',
      'New booking ' || v_booking,
      p_customer_name || ' · ' || p_pickup_address || ' -> ' || p_dropoff_address ||
        ' · $' || v_total || ' (incl. ' || v_gratuity_percent || '% gratuity)',
      v_reservation_id,
      'info'
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN v_booking;
END;
$$;

REVOKE ALL ON FUNCTION public.create_reservation(text, text, text, text, text, timestamptz, uuid, integer, integer, numeric, text, numeric, numeric) FROM public;
GRANT EXECUTE ON FUNCTION public.create_reservation(text, text, text, text, text, timestamptz, uuid, integer, integer, numeric, text, numeric, numeric) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Bookable classes. Does not invent plates, VINs, or unit numbers.
-- The 12 company SUVs still need real vehicle_units from the owner.
-- ---------------------------------------------------------------------------
UPDATE public.fleet
SET status = 'unavailable', featured = false, updated_at = now()
WHERE type IN ('sprinter_van', 'stretch_limo', 'party_bus')
   OR name ~* '(sprinter|stretch|party bus|escalade)';

DELETE FROM public.vehicle_units
WHERE label ~* '(escalade|sprinter|stretch|party bus)';

DO $$
DECLARE
  v_suv uuid;
  v_sedan uuid;
  v_tesla uuid;
BEGIN
  SELECT id INTO v_suv
  FROM public.fleet
  WHERE status = 'available'
    AND name !~* '(tesla|model y|sprinter|stretch|escalade|party)'
    AND (
      type IN ('luxury_suv', 'executive_suburban')
      OR name ~* '(suv|suburban|yukon|expedition)'
    )
  ORDER BY CASE WHEN type = 'luxury_suv' THEN 0 ELSE 1 END, display_order
  LIMIT 1;

  IF v_suv IS NULL THEN
    INSERT INTO public.fleet (
      name, type, capacity, luggage_capacity, base_price, price_per_mile, minimum_price,
      hourly_rate, image_url, tier, featured, display_order, description, status
    ) VALUES (
      'Full-Size SUV', 'luxury_suv', 6, 6, 60.00, 3.10, 95.00,
      110.00, '/images/fleet-suv.webp', 'executive', true, 10,
      'Company fleet: 12 full-size SUVs, model years 2021-2024 (Chevrolet Suburban, GMC Yukon XL SLT, and 2024 Ford Expedition MAX Limited). Charter is $110/hour with a 3-hour minimum. Transfers use the mileage calculator, or the published flat rate when one end is MCO.',
      'available'
    )
    RETURNING id INTO v_suv;
  ELSE
    UPDATE public.fleet
    SET name = 'Full-Size SUV',
        type = 'luxury_suv',
        hourly_rate = 110.00,
        featured = true,
        status = 'available',
        display_order = 10,
        image_url = CASE
          WHEN coalesce(image_url, '') ~* '(sprinter|luxury-sedan|escalade)' THEN '/images/fleet-suv.webp'
          ELSE coalesce(nullif(image_url, ''), '/images/fleet-suv.webp')
        END,
        description = 'Company fleet: 12 full-size SUVs, model years 2021-2024 (Chevrolet Suburban, GMC Yukon XL SLT, and 2024 Ford Expedition MAX Limited). Charter is $110/hour with a 3-hour minimum. Transfers use the mileage calculator, or the published flat rate when one end is MCO.',
        updated_at = now()
    WHERE id = v_suv;
  END IF;

  UPDATE public.vehicle_units u
  SET model_id = v_suv, updated_at = now()
  FROM public.fleet f
  WHERE u.model_id = f.id
    AND f.id <> v_suv
    AND u.label !~* '(escalade|sprinter|stretch|party bus)'
    AND (
      f.type IN ('luxury_suv', 'executive_suburban')
      OR f.name ~* '(suv|suburban|yukon|expedition|full-size)'
    );

  UPDATE public.fleet
  SET status = 'unavailable', featured = false, updated_at = now()
  WHERE id <> v_suv
    AND name !~* '(tesla|model y)'
    AND (
      type IN ('luxury_suv', 'executive_suburban', 'sprinter_van', 'stretch_limo', 'party_bus')
      OR name ~* '(suv|suburban|yukon|expedition|sprinter|stretch|escalade|party bus)'
    );

  SELECT id INTO v_sedan
  FROM public.fleet
  WHERE type = 'luxury_sedan'
    AND name !~* '(tesla|model y)'
  ORDER BY CASE WHEN status = 'available' THEN 0 ELSE 1 END, display_order
  LIMIT 1;

  IF v_sedan IS NULL THEN
    INSERT INTO public.fleet (
      name, type, capacity, luggage_capacity, base_price, price_per_mile, minimum_price,
      hourly_rate, image_url, tier, featured, display_order, description, status
    ) VALUES (
      'Luxury Sedan', 'luxury_sedan', 3, 2, 50.00, 2.60, 80.00,
      100.00, '/images/fleet-sedan.webp', 'premium', true, 30,
      'Contracted partner drivers, not company-owned. Luxury sedans such as Mercedes-Benz S-Class. Charter is $100/hour with a 3-hour minimum.',
      'available'
    )
    RETURNING id INTO v_sedan;
  ELSE
    UPDATE public.fleet
    SET name = 'Luxury Sedan',
        type = 'luxury_sedan',
        hourly_rate = 100.00,
        featured = true,
        status = 'available',
        display_order = 30,
        image_url = CASE
          WHEN coalesce(image_url, '') ~* '(sprinter|luxury-sedan.png|escalade)' THEN '/images/fleet-sedan.webp'
          ELSE coalesce(nullif(image_url, ''), '/images/fleet-sedan.webp')
        END,
        description = 'Contracted partner drivers, not company-owned. Luxury sedans such as Mercedes-Benz S-Class. Charter is $100/hour with a 3-hour minimum.',
        updated_at = now()
    WHERE id = v_sedan;
  END IF;

  UPDATE public.fleet
  SET status = 'unavailable', featured = false, updated_at = now()
  WHERE id <> v_sedan
    AND type = 'luxury_sedan'
    AND name !~* '(tesla|model y)';

  SELECT id INTO v_tesla
  FROM public.fleet
  WHERE name ~* '(tesla|model y)'
  ORDER BY display_order
  LIMIT 1;

  IF v_tesla IS NULL THEN
    INSERT INTO public.fleet (
      name, type, capacity, luggage_capacity, base_price, price_per_mile, minimum_price,
      hourly_rate, image_url, tier, featured, display_order, description, status
    ) VALUES (
      '2023 Tesla Model Y', 'luxury_sedan', 4, 3, 50.00, 2.60, 80.00,
      100.00, '/images/fleet-wash.webp', 'premium', true, 20,
      'Company-owned 2023 Tesla Model Y, booked as its own vehicle. Charter uses the sedan rate of $100/hour with a 3-hour minimum. Not a partner sedan and not a full-size SUV.',
      'available'
    );
  ELSE
    UPDATE public.fleet
    SET name = '2023 Tesla Model Y',
        hourly_rate = 100.00,
        featured = true,
        status = 'available',
        display_order = 20,
        description = 'Company-owned 2023 Tesla Model Y, booked as its own vehicle. Charter uses the sedan rate of $100/hour with a 3-hour minimum. Not a partner sedan and not a full-size SUV.',
        updated_at = now()
    WHERE id = v_tesla;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Stop promoting every new Auth user to manager. Existing staff rows stay.
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- New signups are not staff. Add a public.staff row by hand for a real manager.
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.bootstrap_staff_registry()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- No longer backfills every Auth user into staff.
  RETURN 0;
END;
$$;

REVOKE ALL ON FUNCTION public.bootstrap_staff_registry() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_staff_registry() TO service_role;
