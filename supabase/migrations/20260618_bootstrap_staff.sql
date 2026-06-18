-- One-time bootstrap: grant staff access to every existing auth user.
-- Safe to re-run (skips users who already have a staff row).
CREATE OR REPLACE FUNCTION public.bootstrap_staff_registry()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  inserted integer;
BEGIN
  INSERT INTO public.staff (id, full_name, role)
  SELECT
    u.id,
    COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
    'admin'
  FROM auth.users u
  WHERE NOT EXISTS (SELECT 1 FROM public.staff s WHERE s.id = u.id);

  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.bootstrap_staff_registry() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_staff_registry() TO service_role;