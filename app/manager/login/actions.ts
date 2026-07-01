'use server'

import { createClient } from '@/lib/supabase/server'
import { verifyStaffMembership } from '@/lib/manager/auth'

export type LoginState = { error?: string }

/** Called after the browser client establishes the session (reliable on Cloudflare). */
export async function verifyStaffAccess(): Promise<LoginState> {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    console.warn('[auth] verifyStaffAccess: no session', userError?.message)
    return {
      error:
        'Session could not be established. If this persists after deploy, confirm NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY match your Supabase project.',
    }
  }

  const staff = await verifyStaffMembership(user.id)
  if (!staff) {
    console.warn('[auth] verifyStaffAccess: not in staff registry', user.id, user.email)
    await supabase.auth.signOut()
    return {
      error:
        'This account is not authorized for the manager area. Ask an administrator to add you to the staff registry.',
    }
  }

  console.info('[auth] staff session verified:', user.email, staff.role)
  return {}
}