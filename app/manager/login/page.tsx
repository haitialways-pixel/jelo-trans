'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

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
    return { error: 'Invalid email or password.' }
  }

  // Check role from user metadata
  const role = data.user?.user_metadata?.role || data.user?.app_metadata?.role

  if (role !== 'manager') {
    await supabase.auth.signOut()
    return { error: 'This account is not authorized for the manager area.' }
  }

  // Success - redirect to manager dashboard
  redirect('/manager')
}