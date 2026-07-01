-- Manual reservations, driver dispatch contact prefs, and auth helper.
-- Safe to re-run (IF NOT EXISTS / OR REPLACE).

-- Chauffeur contact preferences for dispatch notifications
ALTER TABLE public.chauffeurs
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS notify_email boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_sms boolean NOT NULL DEFAULT true;

-- Reservation provenance + chauffeur FK
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'web'
    CHECK (source IN ('web', 'manual')),
  ADD COLUMN IF NOT EXISTS chauffeur_id uuid REFERENCES public.chauffeurs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_reservations_source ON public.reservations (source, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reservations_chauffeur ON public.reservations (chauffeur_id);

-- Auth helper: avoids circular RLS on staff table (is_staff() requires reading staff).
CREATE OR REPLACE FUNCTION public.get_my_staff_profile()
RETURNS TABLE (full_name text, role text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.full_name, s.role FROM public.staff s WHERE s.id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.get_my_staff_profile() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_my_staff_profile() TO authenticated;

-- Staff manual reservation creation (manager sets price; skips guest availability RPC).
CREATE OR REPLACE FUNCTION public.staff_create_reservation(
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
  p_total_price      numeric,
  p_distance_miles   numeric DEFAULT NULL
)
RETURNS public.reservations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_res public.reservations;
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF coalesce(btrim(p_customer_name), '')  = '' THEN RAISE EXCEPTION 'Customer name is required'; END IF;
  IF coalesce(btrim(p_customer_email), '') = '' THEN RAISE EXCEPTION 'Customer email is required'; END IF;
  IF coalesce(btrim(p_customer_phone), '') = '' THEN RAISE EXCEPTION 'Customer phone is required'; END IF;
  IF p_total_price IS NULL OR p_total_price < 0 THEN RAISE EXCEPTION 'Valid price is required'; END IF;

  INSERT INTO public.reservations (
    customer_name, customer_email, customer_phone,
    pickup_address, dropoff_address, pickup_time,
    vehicle_id, passengers, luggage, duration_hours, distance_miles,
    total_price, status, payment_status, special_requests, source
  ) VALUES (
    btrim(p_customer_name), lower(btrim(p_customer_email)), btrim(p_customer_phone),
    btrim(p_pickup_address), btrim(p_dropoff_address), p_pickup_time,
    p_vehicle_id,
    greatest(coalesce(p_passengers, 1), 1),
    greatest(coalesce(p_luggage, 0), 0),
    greatest(coalesce(p_duration_hours, 3.0), 0.25),
    p_distance_miles,
    round(p_total_price, 2),
    'pending', 'unpaid',
    nullif(btrim(p_special_requests), ''),
    'manual'
  )
  RETURNING * INTO v_res;

  PERFORM public.write_audit('reservation_manual_create', v_res.id,
    jsonb_build_object('booking_number', v_res.booking_number, 'total_price', v_res.total_price));

  BEGIN
    PERFORM public.create_notification(
      'new_booking',
      '📝 Manual booking ' || v_res.booking_number,
      v_res.customer_name || ' · ' || v_res.pickup_address || ' → ' || v_res.dropoff_address,
      v_res.id, 'info'
    );
  EXCEPTION WHEN OTHERS THEN /* swallow */ END;

  RETURN v_res;
END;
$$;
REVOKE ALL ON FUNCTION public.staff_create_reservation(text, text, text, text, text, timestamptz, uuid, integer, integer, numeric, text, numeric, numeric) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.staff_create_reservation(text, text, text, text, text, timestamptz, uuid, integer, integer, numeric, text, numeric, numeric) TO authenticated;

-- Assign unit + chauffeur (by id or name).
DROP FUNCTION IF EXISTS public.staff_assign_reservation(uuid, uuid, text);
CREATE OR REPLACE FUNCTION public.staff_assign_reservation(
  p_reservation_id uuid,
  p_unit_id uuid,
  p_chauffeur_name text DEFAULT NULL,
  p_chauffeur_id uuid DEFAULT NULL
)
RETURNS public.reservations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_res public.reservations;
  v_model uuid;
  v_chauffeur_name text;
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'Not authorized'; END IF;

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
         vehicle_id       = COALESCE(v_model, vehicle_id),
         chauffeur_id     = p_chauffeur_id,
         chauffeur_name   = v_chauffeur_name,
         updated_at       = now()
   WHERE id = p_reservation_id
   RETURNING * INTO v_res;

  IF NOT FOUND THEN RAISE EXCEPTION 'Reservation not found'; END IF;

  PERFORM public.write_audit('reservation_assign', p_reservation_id,
    jsonb_build_object('unit_id', p_unit_id, 'chauffeur_id', p_chauffeur_id, 'chauffeur', v_res.chauffeur_name));

  RETURN v_res;
END;
$$;
REVOKE ALL ON FUNCTION public.staff_assign_reservation(uuid, uuid, text, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.staff_assign_reservation(uuid, uuid, text, uuid) TO authenticated;