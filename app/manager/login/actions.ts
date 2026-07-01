'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { verifyStaffMembership } from '@/lib/manager/auth'

export type LoginState = { error?: string }

export async function managerLogin(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!email || !password) {
    return { error: 'Email and password are required.' }
  }

  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    console.warn('[auth] signInWithPassword failed:', error.message, { email })
    return { error: 'Invalid email or password.' }
  }

  if (!data.user) {
    return { error: 'Sign-in succeeded but no user session was returned.' }
  }

  const staff = await verifyStaffMembership(data.user.id)
  if (!staff) {
    console.warn('[auth] user authenticated but not in staff registry:', data.user.id, email)
    await supabase.auth.signOut()
    return {
      error:
        'This account is not authorized for the manager area. Ask an administrator to add you to the staff registry.',
    }
  }

  console.info('[auth] manager login success:', email, staff.role)
  redirect('/manager')
}