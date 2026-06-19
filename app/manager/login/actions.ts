'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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

  try {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      console.error('[managerLogin] auth error:', error.message)
      return { error: 'Invalid email or password.' }
    }

    if (!data.user) {
      return { error: 'Authentication failed — no user returned.' }
    }

    const admin = createAdminClient()
    const { data: staffRow, error: staffError } = await admin
      .from('staff')
      .select('id')
      .eq('id', data.user.id)
      .maybeSingle()

    if (staffError) {
      console.error('[managerLogin] staff lookup error:', staffError.message)
      return { error: 'Staff lookup failed. Please try again.' }
    }

    if (!staffRow) {
      await supabase.auth.signOut()
      redirect('/manager/login?error=not_staff')
    }

    redirect('/manager')
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[managerLogin] exception:', message)
    // Network or other runtime errors
    if (message.includes('fetch') || message.includes('network')) {
      return { error: 'Network error — please check your connection and try again.' }
    }
    return { error: 'Authentication service is temporarily unavailable. Please try again.' }
  }
}