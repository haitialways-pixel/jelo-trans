-- Dedicated charter hourly rate on fleet models (separate from transfer base_price).
-- Backfill: copy base_price so existing vehicles keep working until ops sets real rates.

ALTER TABLE public.fleet
  ADD COLUMN IF NOT EXISTS hourly_rate numeric(10,2);

UPDATE public.fleet
SET hourly_rate = base_price
WHERE hourly_rate IS NULL;

ALTER TABLE public.fleet
  ALTER COLUMN hourly_rate SET DEFAULT 125.00,
  ALTER COLUMN hourly_rate SET NOT NULL;

COMMENT ON COLUMN public.fleet.hourly_rate IS
  'Charter / as-directed hourly rate (USD). Transfer pricing still uses base_price + price_per_mile.';

-- Keep staff pricing RPC in sync (signature change: add hourly rate).
DROP FUNCTION IF EXISTS public.staff_update_fleet_pricing(uuid, numeric, numeric, numeric);

CREATE OR REPLACE FUNCTION public.staff_update_fleet_pricing(
  p_fleet_id uuid,
  p_base_price numeric,
  p_price_per_mile numeric,
  p_minimum_price numeric,
  p_hourly_rate numeric DEFAULT NULL
)
RETURNS public.fleet
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.fleet;
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  UPDATE public.fleet
     SET base_price = p_base_price,
         price_per_mile = p_price_per_mile,
         minimum_price = p_minimum_price,
         hourly_rate = coalesce(p_hourly_rate, hourly_rate, p_base_price),
         updated_at = now()
   WHERE id = p_fleet_id
   RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fleet model not found'; END IF;
  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.staff_update_fleet_pricing(uuid, numeric, numeric, numeric, numeric) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.staff_update_fleet_pricing(uuid, numeric, numeric, numeric, numeric) TO authenticated;
