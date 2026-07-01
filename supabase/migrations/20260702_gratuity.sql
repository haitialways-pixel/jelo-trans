-- Gratuity on online bookings: fare subtotal + 15/18/22% gratuity = total_price

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS fare_subtotal numeric(10,2),
  ADD COLUMN IF NOT EXISTS gratuity_percent numeric(5,2),
  ADD COLUMN IF NOT EXISTS gratuity_amount numeric(10,2);

UPDATE public.reservations
SET
  fare_subtotal = total_price,
  gratuity_percent = 0,
  gratuity_amount = 0
WHERE fare_subtotal IS NULL;

DROP FUNCTION IF EXISTS public.create_reservation(text, text, text, text, text, timestamptz, uuid, integer, integer, numeric, text, numeric);

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
  v_end              timestamptz;
  v_booking          text;
  v_reservation_id   uuid;
  v_units            integer;
  v_booked           integer;
BEGIN
  IF coalesce(btrim(p_customer_name), '')  = '' THEN RAISE EXCEPTION 'Customer name is required'; END IF;
  IF coalesce(btrim(p_customer_email), '') = '' THEN RAISE EXCEPTION 'Customer email is required'; END IF;
  IF coalesce(btrim(p_customer_phone), '') = '' THEN RAISE EXCEPTION 'Customer phone is required'; END IF;
  IF p_pickup_time IS NULL OR p_pickup_time <= now() THEN RAISE EXCEPTION 'Pickup time must be in the future'; END IF;

  v_gratuity_percent := coalesce(p_gratuity_percent, 18);
  IF v_gratuity_percent NOT IN (15, 18, 22) THEN
    RAISE EXCEPTION 'Gratuity must be 15, 18, or 22 percent';
  END IF;

  SELECT base_price, price_per_mile, coalesce(minimum_price, 0)
    INTO v_base_price, v_price_per_mile, v_minimum_price
  FROM public.fleet WHERE id = p_vehicle_id AND status = 'available';
  IF NOT FOUND THEN RAISE EXCEPTION 'Selected vehicle is not available'; END IF;

  v_fare := greatest(round((v_base_price + (v_distance * v_price_per_mile)), 2), v_minimum_price);
  v_gratuity_amount := round(v_fare * v_gratuity_percent / 100, 2);
  v_total := round(v_fare + v_gratuity_amount, 2);

  v_end := p_pickup_time + (v_duration * interval '1 hour');

  SELECT count(*) INTO v_units FROM public.vehicle_units
    WHERE model_id = p_vehicle_id AND status IN ('available', 'in_service');
  IF v_units = 0 THEN v_units := 1; END IF;

  SELECT count(*) INTO v_booked FROM public.reservations r
    WHERE r.vehicle_id = p_vehicle_id
      AND r.status NOT IN ('cancelled', 'completed')
      AND r.pickup_time < v_end
      AND r.pickup_time + (r.duration_hours * interval '1 hour') > p_pickup_time;

  IF v_booked >= v_units THEN
    RAISE EXCEPTION 'This vehicle is no longer available for the selected time';
  END IF;

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