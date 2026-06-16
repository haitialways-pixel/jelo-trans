-- ============================================================================
-- PHALO TRANSPORTATION, LLC - Complete Supabase Schema + RLS
-- Single source of truth. Runs top-to-bottom on a FRESH project (idempotent on
-- a re-run thanks to the DROP block at the top).
--
-- Model:
--   fleet          = customer-facing CATALOG (bookable models)
--   vehicle_units  = physical INVENTORY (the real cars; e.g. 2 Suburbans) — staff only
--   reservations   = bookings (reference a catalog model; manager assigns a physical unit)
--   chauffeurs     = drivers (staff-managed)
--   staff          = invite-only authorization gate for the /manager area
--   audit_log      = every staff write (who / what / when)
--   stripe_events  = Stripe webhook idempotency
--   api_attempts   = sliding-window rate-limiting log
--
-- Security: anon/customers NEVER touch tables directly. Guests act through
-- SECURITY DEFINER RPCs; staff read via their own JWT (RLS + is_staff()) and
-- write via audited SECURITY DEFINER RPCs or RLS-gated direct writes.
--
-- IMPORTANT (external to this DB):
--   The Google Maps integration (address autocomplete + distance) lives in the
--   Next.js app at /api/places/*. It requires a SERVER-ONLY env var named
--   GOOGLE_MAPS_API_KEY (with Places API + Distance Matrix API enabled) to be
--   set on the *app host* (Vercel, Cloudflare Pages/Workers, etc.), NOT inside
--   the database. Missing key → "Google Maps API key is missing on the server".
--   See .env.example, HANDOFF_README.md, and your hosting dashboard.
--   Supabase keys (URL + service_role) are also required on the app host.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- Idempotent DROPs (reverse dependency order). Safe on a fresh project — these
-- are all no-ops. On a re-run, they clear conflicting objects with different
-- parameter names (Postgres error 42P13 happens when CREATE OR REPLACE FUNCTION
-- only changes a parameter name; the explicit DROP avoids that).
-- ============================================================================
DROP TABLE IF EXISTS public.notifications    CASCADE;
DROP TABLE IF EXISTS public.api_attempts     CASCADE;
DROP TABLE IF EXISTS public.stripe_events    CASCADE;
DROP TABLE IF EXISTS public.audit_log        CASCADE;
DROP TABLE IF EXISTS public.staff            CASCADE;
DROP TABLE IF EXISTS public.chauffeurs       CASCADE;
DROP TABLE IF EXISTS public.support_requests CASCADE;
DROP TABLE IF EXISTS public.payments         CASCADE;
DROP TABLE IF EXISTS public.reservations     CASCADE;
DROP TABLE IF EXISTS public.vehicle_units    CASCADE;
DROP TABLE IF EXISTS public.fleet            CASCADE;

DROP FUNCTION IF EXISTS public.generate_booking_number() CASCADE;
DROP FUNCTION IF EXISTS public.normalize_phone()         CASCADE;
DROP FUNCTION IF EXISTS public.normalize_phone_value(text);
DROP FUNCTION IF EXISTS public.is_staff();
DROP FUNCTION IF EXISTS public.write_audit(text, uuid, jsonb);
DROP FUNCTION IF EXISTS public.get_reservation_by_booking(text, text);
DROP FUNCTION IF EXISTS public.update_guest_reservation(text, text, jsonb);
DROP FUNCTION IF EXISTS public.cancel_guest_reservation(text, text);
DROP FUNCTION IF EXISTS public.check_vehicle_availability(uuid, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS public.create_reservation(text, text, text, text, text, timestamptz, uuid, integer, integer, numeric, text, numeric);
DROP FUNCTION IF EXISTS public.create_reservation(text, text, text, text, text, timestamptz, uuid, integer, integer, integer, text);
DROP FUNCTION IF EXISTS public.create_support_request(text, text, text, text, text, jsonb);
DROP FUNCTION IF EXISTS public.staff_advance_reservation(uuid, text);
DROP FUNCTION IF EXISTS public.staff_assign_reservation(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.staff_set_unit_status(uuid, text);
DROP FUNCTION IF EXISTS public.check_rate_limit(text, text, int, int);
DROP FUNCTION IF EXISTS public.create_notification(text, text, text, uuid, text);

-- ============================================================================
-- FLEET — customer-facing catalog (models). minimum_price is the floor charged
-- per ride for this model — protects against ultra-short trips going below cost.
-- ============================================================================
CREATE TABLE public.fleet (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('luxury_sedan', 'luxury_suv', 'stretch_limo', 'sprinter_van', 'party_bus', 'executive_suburban')),
  license_plate text,
  capacity integer NOT NULL DEFAULT 4,
  luggage_capacity integer NOT NULL DEFAULT 4,
  year integer,
  make text,
  model text,
  color text,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'in_service', 'maintenance', 'unavailable')),
  base_price     numeric(10,2) NOT NULL DEFAULT 125.00,
  price_per_mile numeric(10,2) NOT NULL DEFAULT 3.50,
  minimum_price  numeric(10,2) NOT NULL DEFAULT 0,
  image_url text,
  description text,
  featured boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  tier text CHECK (tier IN ('executive', 'premium')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- VEHICLE UNITS — physical inventory. Each catalog model can have several units
-- (e.g. 2 Suburbans). Availability for a model = count of operational units.
-- ============================================================================
CREATE TABLE public.vehicle_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES public.fleet(id) ON DELETE CASCADE,
  label text NOT NULL,
  year integer,
  license_plate text,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'in_service', 'maintenance', 'unavailable')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_vehicle_units_model ON public.vehicle_units (model_id, status);

-- ============================================================================
-- RESERVATIONS — includes lifecycle timestamps + Stripe payment columns.
-- ============================================================================
CREATE TABLE public.reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_number text NOT NULL UNIQUE,
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text NOT NULL,
  pickup_address text NOT NULL,
  dropoff_address text NOT NULL,
  pickup_time timestamptz NOT NULL,
  vehicle_id uuid REFERENCES public.fleet(id) ON DELETE SET NULL,                  -- booked catalog model
  assigned_unit_id uuid REFERENCES public.vehicle_units(id) ON DELETE SET NULL,    -- physical car (manager-assigned)
  passengers integer NOT NULL DEFAULT 1,
  luggage integer NOT NULL DEFAULT 0,
  duration_hours numeric(10,2) NOT NULL DEFAULT 3.00 CHECK (duration_hours > 0),
  distance_miles numeric(10,2),
  total_price numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled')),
  payment_status text NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'refunded', 'partial')),
  special_requests text,
  chauffeur_name text,
  -- Stripe (deposit + balance)
  stripe_customer_id        text,
  stripe_payment_method_id  text,
  deposit_amount    numeric(10,2),
  deposit_intent_id text,
  deposit_paid_at   timestamptz,
  balance_amount    numeric(10,2),
  balance_intent_id text,
  balance_paid_at   timestamptz,
  -- Lifecycle milestones (manager ops)
  dispatched_at      timestamptz,
  arrived_pickup_at  timestamptz,
  onboard_at         timestamptz,
  arrived_dropoff_at timestamptz,
  completed_at       timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- PAYMENTS (audit ledger; Stripe is the source of truth for amounts)
-- ============================================================================
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid REFERENCES public.reservations(id) ON DELETE CASCADE NOT NULL,
  amount numeric(10,2) NOT NULL,
  payment_method text,
  transaction_id text,
  status text NOT NULL DEFAULT 'succeeded' CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- SUPPORT REQUESTS — chatbot escalation queue
-- ============================================================================
CREATE TABLE public.support_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  kind text NOT NULL DEFAULT 'escalation' CHECK (kind IN ('escalation','lead','big_task','feedback')),
  customer_name text,
  customer_phone text,
  customer_email text,
  message text NOT NULL,
  context jsonb,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','in_progress','handled'))
);
CREATE INDEX idx_support_requests_status ON public.support_requests (status, created_at);

-- ============================================================================
-- CHAUFFEURS — staff-managed list of drivers (assignment lookup)
-- ============================================================================
CREATE TABLE public.chauffeurs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available','busy','off_duty')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- STAFF — invite-only authorization gate. Rows created out-of-band (Supabase
-- Auth → Add user, then INSERT INTO staff). NEVER public signup.
-- ============================================================================
CREATE TABLE public.staff (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name  text,
  role       text NOT NULL DEFAULT 'manager' CHECK (role IN ('manager','admin')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- AUDIT LOG — every staff write recorded (who/what/when)
-- ============================================================================
CREATE TABLE public.audit_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at     timestamptz NOT NULL DEFAULT now(),
  actor_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email    text,
  action         text NOT NULL,
  reservation_id uuid REFERENCES public.reservations(id) ON DELETE SET NULL,
  details        jsonb
);
CREATE INDEX idx_audit_log_created     ON public.audit_log (created_at DESC);
CREATE INDEX idx_audit_log_reservation ON public.audit_log (reservation_id, created_at DESC);

-- ============================================================================
-- STRIPE EVENTS — webhook idempotency: each event id is recorded exactly once,
-- so retried/duplicate deliveries are no-ops.
-- ============================================================================
CREATE TABLE public.stripe_events (
  id           text PRIMARY KEY,
  type         text,
  processed_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- API ATTEMPTS — sliding-window rate-limit log. One row per allowed request.
-- The check_rate_limit() function cleans itself up opportunistically (5%/call).
-- ============================================================================
CREATE TABLE public.api_attempts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip         text NOT NULL,
  action     text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_api_attempts_lookup  ON public.api_attempts (ip, action, created_at DESC);
CREATE INDEX idx_api_attempts_cleanup ON public.api_attempts (created_at);

-- ============================================================================
-- NOTIFICATIONS — operational events for the manager dashboard.
-- One row = one event (new booking, deposit paid, balance failed, cancellation,
-- chat escalation, ride completed). The manager UI subscribes via Supabase
-- Realtime and renders a bell icon with unread badge.
-- ============================================================================
CREATE TABLE public.notifications (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind           text NOT NULL CHECK (kind IN (
    'new_booking',
    'deposit_paid',
    'balance_paid',
    'balance_failed',
    'cancellation',
    'chat_escalation',
    'ride_completed'
  )),
  title          text NOT NULL,
  body           text,
  reservation_id uuid REFERENCES public.reservations(id) ON DELETE SET NULL,
  severity       text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','critical')),
  read_at        timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_unread ON public.notifications (created_at DESC) WHERE read_at IS NULL;
CREATE INDEX idx_notifications_kind   ON public.notifications (kind, created_at DESC);

-- ============================================================================
-- RESERVATION INDEXES
-- ============================================================================
CREATE INDEX idx_reservations_booking_phone ON public.reservations (booking_number, customer_phone);
CREATE INDEX idx_reservations_pickup_time   ON public.reservations (pickup_time);
CREATE INDEX idx_reservations_vehicle       ON public.reservations (vehicle_id, pickup_time);

-- ============================================================================
-- TRIGGERS — booking number generator + phone normalization
-- ============================================================================

-- Booking number: PT + YYYYMMDD + 6-char CSPRNG from an unambiguous alphabet
-- (no I/O/0/1). 256 mod 32 = 0 → no modulo bias. 32^6 ≈ 1.07B combos per day.
CREATE OR REPLACE FUNCTION public.generate_booking_number()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public, extensions AS $$
DECLARE
  date_part text := to_char(now(), 'YYYYMMDD');
  alphabet  text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  suffix    text;
BEGIN
  IF NEW.booking_number IS NULL THEN
    LOOP
      suffix := (
        SELECT string_agg(substr(alphabet, 1 + (get_byte(b, i) % 32), 1), '' ORDER BY i)
        FROM (SELECT gen_random_bytes(6) AS b) g, generate_series(0, 5) AS i
      );
      NEW.booking_number := 'PT' || date_part || suffix;
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.reservations WHERE booking_number = NEW.booking_number
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER reservations_booking_number
  BEFORE INSERT ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.generate_booking_number();

-- Phone normalization — SINGLE SOURCE OF TRUTH. Used by both the write trigger
-- AND the guest lookup/cancel/update RPCs, so stored ↔ searched can never drift.
CREATE OR REPLACE FUNCTION public.normalize_phone_value(p_phone text)
RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE v text;
BEGIN
  v := regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g');
  IF v !~ '^\+' THEN v := '+1' || v; END IF;
  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_phone()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.customer_phone := public.normalize_phone_value(NEW.customer_phone);
  RETURN NEW;
END;
$$;

CREATE TRIGGER reservations_normalize_phone
  BEFORE INSERT OR UPDATE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.normalize_phone();

-- ============================================================================
-- AUTHORIZATION PREDICATE — is_staff()
-- Single source of truth for "is this caller a staff member?". SECURITY DEFINER
-- avoids RLS recursion on the staff table. Used by every staff RLS policy + RPC.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.staff WHERE id = auth.uid());
$$;
REVOKE ALL ON FUNCTION public.is_staff() FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.is_staff() TO authenticated;

-- ============================================================================
-- AUDIT WRITER — called from other SECURITY DEFINER fns only
-- ============================================================================
CREATE OR REPLACE FUNCTION public.write_audit(p_action text, p_reservation_id uuid, p_details jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor uuid := auth.uid();
BEGIN
  INSERT INTO public.audit_log (actor_id, actor_email, action, reservation_id, details)
  VALUES (v_actor, (SELECT email FROM auth.users WHERE id = v_actor), p_action, p_reservation_id, p_details);
END;
$$;
REVOKE ALL ON FUNCTION public.write_audit(text, uuid, jsonb) FROM public, anon, authenticated;

-- ============================================================================
-- GUEST RPCs (SECURITY DEFINER) — the ONLY paths anon can use to act on data
-- ============================================================================

-- Lookup: returns only the columns the manage-booking page renders (no PII over-fetch).
CREATE OR REPLACE FUNCTION public.get_reservation_by_booking(p_booking_number text, p_phone text)
RETURNS TABLE (
  booking_number text,
  customer_name  text,
  customer_phone text,
  status         text,
  pickup_time    timestamptz,
  total_price    numeric,
  payment_status text
)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT r.booking_number, r.customer_name, r.customer_phone, r.status,
         r.pickup_time, r.total_price, r.payment_status
  FROM public.reservations r
  WHERE r.booking_number = upper(trim(p_booking_number))
    AND r.customer_phone = public.normalize_phone_value(p_phone)
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_reservation_by_booking(text, text) TO anon, authenticated;

-- Self-service update (special_requests only, future bookings only).
CREATE OR REPLACE FUNCTION public.update_guest_reservation(p_booking_number text, p_phone text, p_updates jsonb)
RETURNS public.reservations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_res public.reservations;
BEGIN
  SELECT * INTO v_res FROM public.reservations
  WHERE booking_number = upper(trim(p_booking_number))
    AND customer_phone = public.normalize_phone_value(p_phone)
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found or phone does not match'; END IF;
  IF v_res.pickup_time <= now() THEN RAISE EXCEPTION 'Cannot modify past bookings'; END IF;

  UPDATE public.reservations SET
    special_requests = COALESCE(p_updates->>'special_requests', special_requests),
    updated_at = now()
  WHERE id = v_res.id RETURNING * INTO v_res;
  RETURN v_res;
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_guest_reservation(text, text, jsonb) TO anon, authenticated;

-- Self-service cancellation.
CREATE OR REPLACE FUNCTION public.cancel_guest_reservation(p_booking_number text, p_phone text)
RETURNS public.reservations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_res public.reservations;
BEGIN
  SELECT * INTO v_res FROM public.reservations
  WHERE booking_number = upper(trim(p_booking_number))
    AND customer_phone = public.normalize_phone_value(p_phone)
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found or phone does not match'; END IF;
  IF v_res.status IN ('completed', 'cancelled') THEN RAISE EXCEPTION 'Cannot cancel'; END IF;

  UPDATE public.reservations SET status = 'cancelled', updated_at = now()
  WHERE id = v_res.id RETURNING * INTO v_res;

  BEGIN
    PERFORM public.create_notification(
      'cancellation',
      '❌ Booking cancelled by customer · ' || v_res.booking_number,
      v_res.customer_name || ' cancelled their reservation',
      v_res.id,
      'warning'
    );
  EXCEPTION WHEN OTHERS THEN /* swallow */ END;

  RETURN v_res;
END;
$$;
GRANT EXECUTE ON FUNCTION public.cancel_guest_reservation(text, text) TO anon, authenticated;

-- Availability — UNIT-COUNT-AWARE. A model is free if its overlapping active
-- bookings are fewer than its operational unit count.
CREATE OR REPLACE FUNCTION public.check_vehicle_availability(
  p_vehicle_id uuid, p_start timestamptz, p_end timestamptz
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (
    (SELECT count(*) FROM public.reservations r
       WHERE r.vehicle_id = p_vehicle_id
         AND r.status NOT IN ('cancelled', 'completed')
         AND r.pickup_time < p_end
         AND r.pickup_time + (r.duration_hours * interval '1 hour') > p_start)
    <
    GREATEST(
      (SELECT count(*) FROM public.vehicle_units u
         WHERE u.model_id = p_vehicle_id AND u.status IN ('available', 'in_service')),
      1)
  );
$$;
GRANT EXECUTE ON FUNCTION public.check_vehicle_availability(uuid, timestamptz, timestamptz) TO anon, authenticated;

-- Reservation creation — the ONLY sanctioned write path for guests.
-- Server-authoritative pricing: total = max(base + miles × per_mile, minimum).
-- NO automatic gratuity (gratuity is arranged at payment time).
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
  p_distance_miles   numeric
)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_duration       numeric(10,2) := greatest(coalesce(p_duration_hours, 1.0), 0.25);
  v_distance       numeric(10,2) := greatest(coalesce(p_distance_miles, 0.0), 0.0);
  v_base_price     numeric(10,2);
  v_price_per_mile numeric(10,2);
  v_minimum_price  numeric(10,2);
  v_total          numeric(10,2);
  v_end            timestamptz;
  v_booking        text;
  v_reservation_id uuid;
  v_units          integer;
  v_booked         integer;
BEGIN
  IF coalesce(btrim(p_customer_name), '')  = '' THEN RAISE EXCEPTION 'Customer name is required'; END IF;
  IF coalesce(btrim(p_customer_email), '') = '' THEN RAISE EXCEPTION 'Customer email is required'; END IF;
  IF coalesce(btrim(p_customer_phone), '') = '' THEN RAISE EXCEPTION 'Customer phone is required'; END IF;
  IF p_pickup_time IS NULL OR p_pickup_time <= now() THEN RAISE EXCEPTION 'Pickup time must be in the future'; END IF;

  SELECT base_price, price_per_mile, coalesce(minimum_price, 0)
    INTO v_base_price, v_price_per_mile, v_minimum_price
  FROM public.fleet WHERE id = p_vehicle_id AND status = 'available';
  IF NOT FOUND THEN RAISE EXCEPTION 'Selected vehicle is not available'; END IF;

  -- Subtotal (no automatic gratuity) + per-vehicle minimum applied.
  v_total := greatest(round((v_base_price + (v_distance * v_price_per_mile)), 2), v_minimum_price);

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
    total_price, status, payment_status, special_requests
  ) VALUES (
    p_customer_name, p_customer_email, p_customer_phone,
    p_pickup_address, p_dropoff_address, p_pickup_time,
    p_vehicle_id, greatest(coalesce(p_passengers, 1), 1), greatest(coalesce(p_luggage, 0), 0),
    v_duration, v_distance,
    v_total, 'pending', 'unpaid', nullif(btrim(p_special_requests), '')
  )
  RETURNING id, booking_number INTO v_reservation_id, v_booking;

  -- Notify the manager dashboard (best-effort; failures don't block the booking).
  BEGIN
    PERFORM public.create_notification(
      'new_booking',
      '🚗 New booking ' || v_booking,
      p_customer_name || ' · ' || p_pickup_address || ' → ' || p_dropoff_address || ' · $' || v_total,
      v_reservation_id,
      'info'
    );
  EXCEPTION WHEN OTHERS THEN /* swallow */ END;

  RETURN v_booking;
END;
$$;
REVOKE ALL ON FUNCTION public.create_reservation(text, text, text, text, text, timestamptz, uuid, integer, integer, numeric, text, numeric) FROM public;
GRANT  EXECUTE ON FUNCTION public.create_reservation(text, text, text, text, text, timestamptz, uuid, integer, integer, numeric, text, numeric) TO anon, authenticated;

-- Chatbot escalation queue write.
CREATE OR REPLACE FUNCTION public.create_support_request(
  p_kind text, p_customer_name text, p_customer_phone text, p_customer_email text,
  p_message text, p_context jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id   uuid;
  v_kind text := coalesce(nullif(btrim(p_kind), ''), 'escalation');
BEGIN
  IF v_kind NOT IN ('escalation','lead','big_task','feedback') THEN v_kind := 'escalation'; END IF;
  IF coalesce(btrim(p_message), '') = '' THEN RAISE EXCEPTION 'A message is required'; END IF;

  INSERT INTO public.support_requests (kind, customer_name, customer_phone, customer_email, message, context)
  VALUES (
    v_kind,
    nullif(btrim(p_customer_name), ''),
    CASE WHEN coalesce(btrim(p_customer_phone), '') = '' THEN NULL
         ELSE public.normalize_phone_value(p_customer_phone) END,
    nullif(btrim(p_customer_email), ''),
    btrim(p_message),
    p_context
  )
  RETURNING id INTO v_id;

  BEGIN
    PERFORM public.create_notification(
      'chat_escalation',
      '💬 Chatbot escalation' || coalesce(' · ' || nullif(btrim(p_customer_name), ''), ''),
      left(btrim(p_message), 200),
      NULL, 'warning'
    );
  EXCEPTION WHEN OTHERS THEN /* swallow */ END;

  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_support_request(text, text, text, text, text, jsonb) FROM public;
GRANT  EXECUTE ON FUNCTION public.create_support_request(text, text, text, text, text, jsonb) TO anon, authenticated;

-- ============================================================================
-- MANAGER RPCs — staff-gated + audited
-- ============================================================================

-- Lifecycle transition (the only sanctioned status write path).
CREATE OR REPLACE FUNCTION public.staff_advance_reservation(p_reservation_id uuid, p_stage text)
RETURNS public.reservations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_res public.reservations;
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT * INTO v_res FROM public.reservations WHERE id = p_reservation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reservation not found'; END IF;
  IF v_res.status IN ('cancelled','completed') THEN
    RAISE EXCEPTION 'Reservation is closed (%)', v_res.status;
  END IF;

  CASE p_stage
    WHEN 'confirm'        THEN UPDATE public.reservations SET status='confirmed',   updated_at=now() WHERE id=p_reservation_id RETURNING * INTO v_res;
    WHEN 'dispatch'       THEN UPDATE public.reservations SET dispatched_at=now(),   updated_at=now() WHERE id=p_reservation_id RETURNING * INTO v_res;
    WHEN 'arrive_pickup'  THEN UPDATE public.reservations SET arrived_pickup_at=now(), updated_at=now() WHERE id=p_reservation_id RETURNING * INTO v_res;
    WHEN 'onboard'        THEN UPDATE public.reservations SET onboard_at=now(), status='in_progress', updated_at=now() WHERE id=p_reservation_id RETURNING * INTO v_res;
    WHEN 'arrive_dropoff' THEN UPDATE public.reservations SET arrived_dropoff_at=now(), updated_at=now() WHERE id=p_reservation_id RETURNING * INTO v_res;
    WHEN 'complete'       THEN UPDATE public.reservations SET completed_at=now(), status='completed', updated_at=now() WHERE id=p_reservation_id RETURNING * INTO v_res;
    WHEN 'cancel'         THEN UPDATE public.reservations SET status='cancelled', updated_at=now() WHERE id=p_reservation_id RETURNING * INTO v_res;
    ELSE RAISE EXCEPTION 'Unknown stage: %', p_stage;
  END CASE;

  PERFORM public.write_audit('reservation_' || p_stage, p_reservation_id,
    jsonb_build_object('booking_number', v_res.booking_number, 'status', v_res.status));

  -- Only the milestones the manager will want to SEE in the bell.
  -- Confirm/dispatch/arrive_* are routine; complete/cancel deserve a notification.
  BEGIN
    IF p_stage = 'complete' THEN
      PERFORM public.create_notification(
        'ride_completed',
        '🏁 Ride completed · ' || v_res.booking_number,
        v_res.customer_name || ' · ' || v_res.dropoff_address,
        v_res.id, 'info'
      );
    ELSIF p_stage = 'cancel' THEN
      PERFORM public.create_notification(
        'cancellation',
        '❌ Booking cancelled by staff · ' || v_res.booking_number,
        v_res.customer_name,
        v_res.id, 'warning'
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN /* swallow */ END;

  RETURN v_res;
END;
$$;
REVOKE ALL ON FUNCTION public.staff_advance_reservation(uuid, text) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.staff_advance_reservation(uuid, text) TO authenticated;

-- Assign a physical unit (+ chauffeur). Model is derived from the unit.
CREATE OR REPLACE FUNCTION public.staff_assign_reservation(p_reservation_id uuid, p_unit_id uuid, p_chauffeur_name text)
RETURNS public.reservations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_res public.reservations; v_model uuid;
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_unit_id IS NOT NULL THEN
    SELECT model_id INTO v_model FROM public.vehicle_units WHERE id = p_unit_id;
    IF v_model IS NULL THEN RAISE EXCEPTION 'Unit not found'; END IF;
  END IF;
  UPDATE public.reservations
     SET assigned_unit_id = p_unit_id,
         vehicle_id       = COALESCE(v_model, vehicle_id),
         chauffeur_name   = NULLIF(btrim(p_chauffeur_name), ''),
         updated_at       = now()
   WHERE id = p_reservation_id
   RETURNING * INTO v_res;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reservation not found'; END IF;
  PERFORM public.write_audit('reservation_assign', p_reservation_id,
    jsonb_build_object('unit_id', p_unit_id, 'chauffeur', v_res.chauffeur_name));
  RETURN v_res;
END;
$$;
REVOKE ALL ON FUNCTION public.staff_assign_reservation(uuid, uuid, text) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.staff_assign_reservation(uuid, uuid, text) TO authenticated;

-- Per-unit operational status (available/in_service/maintenance/unavailable).
CREATE OR REPLACE FUNCTION public.staff_set_unit_status(p_unit_id uuid, p_status text)
RETURNS public.vehicle_units
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_unit public.vehicle_units;
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_status NOT IN ('available','in_service','maintenance','unavailable') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;
  UPDATE public.vehicle_units SET status = p_status, updated_at = now()
   WHERE id = p_unit_id RETURNING * INTO v_unit;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unit not found'; END IF;
  PERFORM public.write_audit('unit_status', NULL,
    jsonb_build_object('unit_id', p_unit_id, 'status', p_status, 'label', v_unit.label));
  RETURN v_unit;
END;
$$;
REVOKE ALL ON FUNCTION public.staff_set_unit_status(uuid, text) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.staff_set_unit_status(uuid, text) TO authenticated;

-- ============================================================================
-- RATE LIMITING — sliding window per (ip × action). Called by lib/security/rateLimit.ts.
-- Only the trusted server (service_role) calls this. NEVER granted to anon — an
-- attacker who could call it would flood the table and break legitimate users.
-- Cleanup: opportunistic inside the function (~5%/call), keeping the table bounded.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_ip text, p_action text, p_max int, p_window_seconds int
) RETURNS boolean
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

  INSERT INTO public.api_attempts (ip, action) VALUES (p_ip, p_action);

  IF random() < 0.05 THEN
    DELETE FROM public.api_attempts WHERE created_at < now() - interval '1 hour';
  END IF;

  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.check_rate_limit(text, text, int, int) FROM public, anon, authenticated;

-- ============================================================================
-- NOTIFICATIONS HELPER — called from inside other SECURITY DEFINER fns to record
-- operational events. Never granted to anon/authenticated — only DB code and the
-- service_role app client can create notifications. Best-effort: failures are
-- caught by callers so the business action (booking, cancel…) never breaks.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_notification(
  p_kind           text,
  p_title          text,
  p_body           text DEFAULT NULL,
  p_reservation_id uuid DEFAULT NULL,
  p_severity       text DEFAULT 'info'
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.notifications (kind, title, body, reservation_id, severity)
  VALUES (p_kind, p_title, p_body, p_reservation_id, p_severity)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_notification(text, text, text, uuid, text) FROM public, anon, authenticated;

-- ============================================================================
-- ROW LEVEL SECURITY — every table enabled; policies follow.
-- ============================================================================
ALTER TABLE public.fleet            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_units    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chauffeurs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_events    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_attempts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications    ENABLE ROW LEVEL SECURITY;

-- Catalog: public can SELECT; staff can ALSO write (edit prices in manager UI).
CREATE POLICY "Public can view fleet" ON public.fleet
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Staff manages fleet" ON public.fleet
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- Reservations: anon blocked (writes go through create_reservation); staff read via JWT.
CREATE POLICY "Block direct access to reservations" ON public.reservations
  FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "Staff can read reservations" ON public.reservations
  FOR SELECT TO authenticated USING (public.is_staff());

-- Payments: service role + staff read.
CREATE POLICY "Service role manages payments" ON public.payments
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Staff can read payments" ON public.payments
  FOR SELECT TO authenticated USING (public.is_staff());

-- Support requests: anon blocked; staff read; service role full.
CREATE POLICY "Block direct access to support_requests" ON public.support_requests
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "Service role manages support_requests" ON public.support_requests
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Staff can read support_requests" ON public.support_requests
  FOR SELECT TO authenticated USING (public.is_staff());

-- Vehicle units: staff read AND staff manage; service role full.
CREATE POLICY "Staff read vehicle_units" ON public.vehicle_units
  FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "Service role manages vehicle_units" ON public.vehicle_units
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Staff manages vehicle_units" ON public.vehicle_units
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- Chauffeurs: staff read AND staff manage; service role full.
CREATE POLICY "Staff read chauffeurs" ON public.chauffeurs
  FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "Service role manages chauffeurs" ON public.chauffeurs
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Staff manages chauffeurs" ON public.chauffeurs
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- Staff registry: staff read; managed out-of-band by service role.
CREATE POLICY "Staff can read staff" ON public.staff
  FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "Service role manages staff" ON public.staff
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Audit log: staff read; written via SECURITY DEFINER (write_audit) only.
CREATE POLICY "Staff can read audit_log" ON public.audit_log
  FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "Service role manages audit_log" ON public.audit_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Stripe events & api_attempts: only the trusted server (service_role) ever touches them.
CREATE POLICY "Service role manages stripe_events" ON public.stripe_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role manages api_attempts" ON public.api_attempts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Notifications: staff read AND update (to mark as read); service role full
-- (used by app code to insert via admin client for events that happen outside RPCs,
-- e.g. Stripe balance charge results); anon has no access.
CREATE POLICY "Staff read notifications" ON public.notifications
  FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "Staff update notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "Service role manages notifications" ON public.notifications
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- REALTIME — opt the notifications table into Supabase Realtime so the
-- manager dashboard can subscribe to INSERTs and ring the bell instantly.
-- This is a no-op if the table is already in the publication.
-- ============================================================================
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN /* already added */ END $$;

-- ============================================================================
-- SEED DATA — mirrors the operator's current Phalo Transportation catalog.
-- All prices in USD. Minimum charge protects margin on very short rides.
-- Phalo can edit these in the manager UI (/manager/fleet) at any time.
-- ============================================================================
INSERT INTO public.fleet
  (name, type, capacity, luggage_capacity, base_price, price_per_mile, minimum_price, image_url, tier, featured, display_order, description)
VALUES
  ('Luxury Sedan',        'luxury_sedan',       4,  3,  50.00, 2.60,  80.00, '/images/luxury-sedan.png',                'premium',   true, 10,
   'Indulge in first-class comfort. The ultimate choice for executive travel, airport transfers, and private clients.'),
  ('Premium Executive',   'executive_suburban', 7,  6,  95.00, 3.75, 130.00, '/images/suburban-driver.jpg',             'executive', true, 20,
   'The dependable workhorse of executive transport. Unmatched space for passengers and cargo.'),
  ('Luxury SUV',          'luxury_suv',         7,  6,  60.00, 3.10,  95.00, '/images/IMG_20250715_144013465_HDR.jpg',  'executive', true, 30,
   'A perfect blend of luxury, power, and security. Standard-setting space and elite comfort.'),
  ('Luxury Sprinter Van', 'sprinter_van',      14, 14, 110.00, 4.25, 160.00, '/images/sprinter.png',                    'executive', true, 40,
   'Spacious and luxurious group travel. Ideal for corporate groups, events, and airport transfers.');

INSERT INTO public.vehicle_units (model_id, label, year)
SELECT id, 'Mercedes-Benz S-Class',  2023 FROM public.fleet WHERE name = 'Luxury Sedan'
UNION ALL SELECT id, 'Chevrolet Suburban #1',  2022 FROM public.fleet WHERE name = 'Premium Executive'
UNION ALL SELECT id, 'Chevrolet Suburban #2',  2023 FROM public.fleet WHERE name = 'Premium Executive'
UNION ALL SELECT id, 'GMC Yukon XL',           2023 FROM public.fleet WHERE name = 'Luxury SUV'
UNION ALL SELECT id, 'Cadillac Escalade',      2024 FROM public.fleet WHERE name = 'Luxury SUV'
UNION ALL SELECT id, 'Mercedes-Benz Sprinter', 2024 FROM public.fleet WHERE name = 'Luxury Sprinter Van';
