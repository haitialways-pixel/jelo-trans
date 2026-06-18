-- Run in Supabase Dashboard → SQL Editor AFTER creating the auth user.
-- Authentication → Users → Add user → copy the user's UUID below.

-- Example (replace the UUID with your auth user's id):
-- INSERT INTO public.staff (id, full_name, role)
-- VALUES ('00000000-0000-0000-0000-000000000000', 'Phalo Manager', 'admin')
-- ON CONFLICT (id) DO UPDATE
--   SET full_name = EXCLUDED.full_name,
--       role = EXCLUDED.role;

-- Or grant staff to every existing auth user (dev/bootstrap only):
INSERT INTO public.staff (id, full_name, role)
SELECT u.id, COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)), 'admin'
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.staff s WHERE s.id = u.id);