// Service-role Supabase client — SERVER ONLY. Bypasses RLS.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let _admin: SupabaseClient | null = null

/** Resolve the service-role key (Supabase renamed this to SUPABASE_SECRET_KEY in newer dashboards). */
export function getServiceRoleKey(): string | undefined {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY
}

export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = getServiceRoleKey()
  if (!url || !key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY is not set (server-only, no NEXT_PUBLIC prefix)',
    )
  }
  if (!_admin) {
    _admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  }
  return _admin
}

export function isAdminConfigured(): boolean {
  return Boolean(getServiceRoleKey())
}