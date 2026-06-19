'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type LoginState = { error?: string; debug?: string }

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

  // Debug role
  const role = data.user?.user_metadata?.role || data.user?.app_metadata?.role
  console.log("Login role check:", { email, role, metadata: data.user?.user_metadata })

  if (role !== 'manager') {
    await supabase.auth.signOut()
    return { 
      error: 'This account is not authorized for the manager area.',
      debug: `Role found: ${role}` 
    }
  }

  redirect('/manager')
}