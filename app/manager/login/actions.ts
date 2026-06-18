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

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: 'Invalid email or password.' }
  }

  const admin = createAdminClient()
  const { data: staffRow, error: staffError } = await admin
    .from('staff')
    .select('id')
    .eq('id', data.user.id)
    .maybeSingle()

  if (staffError || !staffRow) {
    await supabase.auth.signOut()
    redirect('/manager/login?error=not_staff')
  }

  redirect('/manager')
}