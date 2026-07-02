-- Pickup: 14-minute server floor (1 min grace). Rate limit: optional record flag (failed attempts don't count).

DROP FUNCTION IF EXISTS public.check_rate_limit(text, text, int, int);

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_ip text,
  p_action text,
  p_max int,
  p_window_seconds int,
  p_record boolean DEFAULT true
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count  int;
  v_cutoff timestamptz := now() - make_interval(secs => p_window_seconds);
BEGIN
  SELECT count(*) INTO v_count
  FROM public.api_attempts
  WHERE ip = p_ip AND action = p_action AND created_at > v_cutoff;

  IF v_count >= p_max THEN
    RETURN false;
  END IF;

  IF coalesce(p_record, true) THEN
    INSERT INTO public.api_attempts (ip, action) VALUES (p_ip, p_action);
  END IF;

  IF random() < 0.05 THEN
    DELETE FROM public.api_attempts WHERE created_at < now() - interval '1 hour';
  END IF;

  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.check_rate_limit(text, text, int, int, boolean) FROM public, anon, authenticated;

-- Pickup validation: 14 min lead (1 min grace for clock skew).
DROP FUNCTION IF EXISTS public.create_reservation(text, text, text, text, text, timestamptz, uuid, integer, integer, numeric, text, numeric);
DROP FUNCTION IF EXISTS public.create_reservation(text, text, text, text, text, timestamptz, uuid, integer, integer, numeric, text, numeric, numeric);

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
  v_fare             numeric(10,2);
  v_gratuity_percent numeric(5,2);
  v_gratuity_amount  numeric(10,2);
  v_total            numeric(10,2);
  v_booking          text;
  v_reservation_id   uuid;
BEGIN
  IF coalesce(btrim(p_customer_name), '')  = '' THEN RAISE EXCEPTION 'Customer name is required'; END IF;
  IF coalesce(btrim(p_customer_email), '') = '' THEN RAISE EXCEPTION 'Customer email is required'; END IF;
  IF coalesce(btrim(p_customer_phone), '') = '' THEN RAISE EXCEPTION 'Customer phone is required'; END IF;
  IF p_pickup_time IS NULL OR p_pickup_time < now() + interval '14 minutes' THEN
    RAISE EXCEPTION 'Pickup must be at least 15 minutes from now';
  END IF;

  v_gratuity_percent := coalesce(p_gratuity_percent, 18);
  IF v_gratuity_percent NOT IN (15, 18, 22) THEN
    RAISE EXCEPTION 'Gratuity must be 15, 18, or 22 percent';
  END IF;

  SELECT base_price, price_per_mile, coalesce(minimum_price, 0)
    INTO v_base_price, v_price_per_mile, v_minimum_price
  FROM public.fleet WHERE id = p_vehicle_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Selected vehicle not found'; END IF;

  v_fare := greatest(round((v_base_price + (v_distance * v_price_per_mile)), 2), v_minimum_price);
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
      '🚗 New booking ' || v_booking,
      p_customer_name || ' · ' || p_pickup_address || ' → ' || p_dropoff_address ||
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