-- Backfill staff rows for auth users missing from public.staff.
-- New users added in Supabase Auth are auto-provisioned by on_auth_user_created
-- (see supabase/migrations/20260704_auto_staff_on_auth_user.sql).
--
-- Run this only if you need a manual backfill:
SELECT public.bootstrap_staff_registry();