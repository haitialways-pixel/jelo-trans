import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient, isAdminConfigured } from '@/lib/supabase/admin'

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
    error: userError,
  } = await supabase.auth.getUser()

  if (userError) {
    console.warn('[auth] getUser failed:', userError.message)
    return null
  }
  if (!user) return null

  // Prefer SECURITY DEFINER RPC — avoids circular RLS on staff table and does not
  // require the service role key for the auth gate itself.
  const { data: profileRows, error: profileError } = await supabase.rpc('get_my_staff_profile')
  const profile = Array.isArray(profileRows) ? profileRows[0] : profileRows

  if (!profileError && profile) {
    return {
      userId: user.id,
      email: user.email ?? null,
      fullName: profile.full_name,
      role: profile.role,
    }
  }

  if (profileError) {
    const hint =
      profileError.message.includes('get_my_staff_profile') ||
      profileError.code === 'PGRST202'
        ? ' — run supabase/migrations/20260701_manual_dispatch_auth.sql on your Supabase project'
        : ''
    console.warn('[auth] get_my_staff_profile RPC failed:', profileError.message + hint)
  }

  // Fallback: service-role lookup (for projects that have not run the migration yet).
  if (isAdminConfigured()) {
    try {
      const admin = createAdminClient()
      const { data: staffRow, error } = await admin
        .from('staff')
        .select('full_name, role')
        .eq('id', user.id)
        .maybeSingle()

      if (!error && staffRow) {
        return {
          userId: user.id,
          email: user.email ?? null,
          fullName: staffRow.full_name,
          role: staffRow.role,
        }
      }
      if (error) console.warn('[auth] admin staff lookup failed:', error.message)
    } catch (e) {
      console.warn('[auth] admin client unavailable:', e instanceof Error ? e.message : e)
    }
  }

  return null
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

/** Used after browser sign-in to confirm staff registry membership. */
export async function verifyStaffMembership(userId: string): Promise<StaffSession | null> {
  const supabase = await createClient()
  const { data: profileRows, error } = await supabase.rpc('get_my_staff_profile')
  if (error) {
    const hint =
      error.message.includes('get_my_staff_profile') || error.code === 'PGRST202'
        ? ' — run supabase/migrations/20260701_manual_dispatch_auth.sql'
        : ''
    console.warn('[auth] verifyStaffMembership RPC failed:', error.message + hint)
  }
  if (!error && profileRows) {
    const profile = Array.isArray(profileRows) ? profileRows[0] : profileRows
    if (profile) {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      return {
        userId,
        email: user?.email ?? null,
        fullName: profile.full_name,
        role: profile.role,
      }
    }
  }

  if (isAdminConfigured()) {
    const admin = createAdminClient()
    const { data: staffRow } = await admin
      .from('staff')
      .select('full_name, role')
      .eq('id', userId)
      .maybeSingle()
    if (staffRow) {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      return {
        userId,
        email: user?.email ?? null,
        fullName: staffRow.full_name,
        role: staffRow.role,
      }
    }
  }

  return null
}