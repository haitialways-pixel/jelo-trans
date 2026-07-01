import { createClient } from '@/lib/supabase/server'
import { createAdminClient, isAdminConfigured } from '@/lib/supabase/admin'
import { assertStaff } from '@/lib/manager/auth'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Staff-scoped Supabase client for manager reads/writes.
 *
 * Prefers the service-role client when SUPABASE_SERVICE_ROLE_KEY is set (local dev).
 * Falls back to the authenticated user session + RLS on Cloudflare/production
 * deployments where the service role secret is often missing — without this
 * fallback the dashboard crashes immediately after a successful login.
 */
export async function staffDb(): Promise<SupabaseClient> {
  await assertStaff()
  if (isAdminConfigured()) {
    try {
      return createAdminClient()
    } catch (e) {
      console.warn('[staffDb] admin client failed, using session client:', e)
    }
  }
  return createClient()
}