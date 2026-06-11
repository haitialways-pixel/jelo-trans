import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type StaffSession = {
  userId: string
  email: string | null
  fullName: string | null
  role: string
}

/**
 * Server-side guard for the manager area.
 *
 * Two independent checks, both server-side:
 *   1. getUser() — verifies the session WITH the Supabase auth server (never the
 *      spoofable getSession()/cookie alone).
 *   2. staff membership — the user must have a row in public.staff.
 *
 * This is the FIRST of three layers (layout guard → server action re-check → DB
 * RLS/RPC). A customer has no account, so step 1 already stops them; even a
 * self-signed-up account is stopped at step 2. Redirects to the login page on
 * any failure — the protected content is never rendered or sent.
 */
export async function requireStaff(): Promise<StaffSession> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/manager/login')

  // Membership check. Under RLS, a non-staff user reads 0 rows here, so a missing
  // row == not authorized. (is_staff() in the DB enforces the same predicate.)
  const { data: staffRow } = await supabase
    .from('staff')
    .select('full_name, role')
    .eq('id', user.id)
    .maybeSingle()

  if (!staffRow) {
    await supabase.auth.signOut()
    redirect('/manager/login?error=not_staff')
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    fullName: staffRow.full_name,
    role: staffRow.role,
  }
}

/**
 * Non-redirecting variant for server actions: returns the session or throws.
 * Server actions are a separate entry point from page rendering, so they must
 * re-verify on their own (defense in depth).
 */
export async function assertStaff(): Promise<StaffSession> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: staffRow } = await supabase
    .from('staff')
    .select('full_name, role')
    .eq('id', user.id)
    .maybeSingle()
  if (!staffRow) throw new Error('Not authorized')

  return {
    userId: user.id,
    email: user.email ?? null,
    fullName: staffRow.full_name,
    role: staffRow.role,
  }
}
