-- Fix manager portal RLS: reservations SELECT was failing with
-- "permission denied for table users" on some Supabase projects.
-- Re-apply clean policies (safe to run multiple times).

DROP POLICY IF EXISTS "Block direct access to reservations" ON public.reservations;
DROP POLICY IF EXISTS "Staff can read reservations" ON public.reservations;
DROP POLICY IF EXISTS "Service role manages reservations" ON public.reservations;

CREATE POLICY "Block direct access to reservations" ON public.reservations
  FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE POLICY "Staff can read reservations" ON public.reservations
  FOR SELECT TO authenticated USING (public.is_staff());

CREATE POLICY "Service role manages reservations" ON public.reservations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Staff-gated fleet pricing RPC (alternative to direct UPDATE)
CREATE OR REPLACE FUNCTION public.staff_update_fleet_pricing(
  p_fleet_id uuid,
  p_base_price numeric,
  p_price_per_mile numeric,
  p_minimum_price numeric
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
         updated_at = now()
   WHERE id = p_fleet_id
   RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fleet model not found'; END IF;
  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION public.staff_update_fleet_pricing(uuid, numeric, numeric, numeric) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.staff_update_fleet_pricing(uuid, numeric, numeric, numeric) TO authenticated;