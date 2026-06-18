import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export type StaffSession = {
  userId: string
  email: string | null
  fullName: string | null
  role: string
}

async function resolveStaffSession(): Promise<StaffSession | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  // Staff registry is managed out-of-band; read via service role after session
  // is verified so RLS quirks cannot block legitimate staff members.
  const admin = createAdminClient()
  const { data: staffRow, error } = await admin
    .from('staff')
    .select('full_name, role')
    .eq('id', user.id)
    .maybeSingle()

  if (error || !staffRow) return null

  return {
    userId: user.id,
    email: user.email ?? null,
    fullName: staffRow.full_name,
    role: staffRow.role,
  }
}

/**
 * Server-side guard for the manager area.
 * Verifies Supabase session + staff registry membership.
 */
export async function requireStaff(): Promise<StaffSession> {
  const session = await resolveStaffSession()
  if (!session) {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    // Do not sign out here — Server Components cannot reliably clear auth
    // cookies (especially on edge). The login page signs out client-side when
    // it receives ?error=not_staff so the user can try another account.
    redirect(user ? '/manager/login?error=not_staff' : '/manager/login')
  }
  return session
}

/** Non-redirecting variant for server actions. */
export async function assertStaff(): Promise<StaffSession> {
  const session = await resolveStaffSession()
  if (!session) throw new Error('Not authenticated or not authorized')
  return session
}