-- Additive privacy and driver-pay update. This migration does not remove data or secrets.

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS driver_pay numeric(10,2);

DO $$ BEGIN
  ALTER TABLE public.reservations
    ADD CONSTRAINT reservations_driver_pay_nonnegative
    CHECK (driver_pay IS NULL OR driver_pay >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN public.reservations.driver_pay IS
  'Manual chauffeur compensation for this run. Never derived from customer pricing.';

DROP FUNCTION IF EXISTS public.staff_assign_reservation(uuid, uuid, text, uuid);

CREATE OR REPLACE FUNCTION public.staff_assign_reservation(
  p_reservation_id uuid,
  p_unit_id uuid,
  p_chauffeur_name text DEFAULT NULL,
  p_chauffeur_id uuid DEFAULT NULL,
  p_driver_pay numeric DEFAULT NULL
)
RETURNS public.reservations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_res public.reservations;
  v_model uuid;
  v_chauffeur_name text;
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_driver_pay IS NOT NULL AND p_driver_pay < 0 THEN
    RAISE EXCEPTION 'Driver pay cannot be negative';
  END IF;

  IF p_chauffeur_id IS NOT NULL THEN
    SELECT name INTO v_chauffeur_name FROM public.chauffeurs WHERE id = p_chauffeur_id;
    IF v_chauffeur_name IS NULL THEN RAISE EXCEPTION 'Chauffeur not found'; END IF;
  ELSE
    v_chauffeur_name := nullif(btrim(p_chauffeur_name), '');
  END IF;

  IF p_unit_id IS NOT NULL THEN
    SELECT model_id INTO v_model FROM public.vehicle_units WHERE id = p_unit_id;
    IF v_model IS NULL THEN RAISE EXCEPTION 'Unit not found'; END IF;
  END IF;

  UPDATE public.reservations
     SET assigned_unit_id = p_unit_id,
         vehicle_id = COALESCE(v_model, vehicle_id),
         chauffeur_id = p_chauffeur_id,
         chauffeur_name = v_chauffeur_name,
         driver_pay = CASE WHEN p_driver_pay IS NULL THEN driver_pay ELSE round(p_driver_pay, 2) END,
         updated_at = now()
   WHERE id = p_reservation_id
   RETURNING * INTO v_res;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reservation not found'; END IF;

  PERFORM public.write_audit('reservation_assign', p_reservation_id,
    jsonb_build_object('unit_id', p_unit_id, 'chauffeur_id', p_chauffeur_id, 'chauffeur', v_res.chauffeur_name));
  RETURN v_res;
END;
$$;
REVOKE ALL ON FUNCTION public.staff_assign_reservation(uuid, uuid, text, uuid, numeric) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.staff_assign_reservation(uuid, uuid, text, uuid, numeric) TO authenticated;
