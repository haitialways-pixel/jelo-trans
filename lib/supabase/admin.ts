// Service-role Supabase client — SERVER ONLY. Bypasses RLS.
// Used exclusively by trusted server code that has NO user session: the Stripe
// webhook and the payment server actions. NEVER import from a client component.
//
// Requires SUPABASE_SERVICE_ROLE_KEY (.env.local, server-only — no NEXT_PUBLIC prefix).
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let _admin: SupabaseClient | null = null

export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_SERVICE_ROLE_KEY (or URL) is not set')
  if (!_admin) {
    _admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  }
  return _admin
}

export function isAdminConfigured(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
}
