-- Auto-provision public.staff when a user is added in Supabase Auth.
-- Also backfills any existing auth users who are missing a staff row.

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role text;
BEGIN
  v_role := CASE
    WHEN NEW.raw_user_meta_data->>'role' = 'admin' THEN 'admin'
    ELSE 'manager'
  END;

  INSERT INTO public.staff (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    v_role
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

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
    CASE WHEN u.raw_user_meta_data->>'role' = 'admin' THEN 'admin' ELSE 'manager' END
  FROM auth.users u
  WHERE NOT EXISTS (SELECT 1 FROM public.staff s WHERE s.id = u.id);

  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN inserted;
END;
$$;
REVOKE ALL ON FUNCTION public.bootstrap_staff_registry() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_staff_registry() TO service_role;

-- Backfill existing auth users (safe to re-run).
SELECT public.bootstrap_staff_registry();