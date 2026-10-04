// Service-role Supabase client — SERVER ONLY. Bypasses RLS.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseUrl } from './env'

let _admin: SupabaseClient | null = null

const SERVICE_ROLE_ENV_NAMES = ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY'] as const
/** Must match OpenNext's worker ALS key (`Symbol.for("__cloudflare-context__")`). */
const CLOUDFLARE_CONTEXT = Symbol.for('__cloudflare-context__')

function readTrimmedString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

/** Dynamic lookup so Next.js does not inline a missing build-time value as undefined. */
function readProcessEnv(name: string): string | undefined {
  return readTrimmedString(process.env[name])
}

function readCloudflareBinding(name: string): string | undefined {
  try {
    const ctx = (globalThis as unknown as Record<symbol, { env?: Record<string, unknown> }>)[
      CLOUDFLARE_CONTEXT
    ]
    return readTrimmedString(ctx?.env?.[name])
  } catch {
    return undefined
  }
}

/** Resolve the service-role key from the Worker secret first, then process.env. Never log the value. */
export function getServiceRoleKey(): string | undefined {
  for (const name of SERVICE_ROLE_ENV_NAMES) {
    const fromWorker = readCloudflareBinding(name)
    if (fromWorker) return fromWorker
  }
  for (const name of SERVICE_ROLE_ENV_NAMES) {
    const fromProcess = readProcessEnv(name)
    if (fromProcess) return fromProcess
  }
  return undefined
}

export function createAdminClient(): SupabaseClient {
  const url =
    getSupabaseUrl() ||
    readCloudflareBinding('NEXT_PUBLIC_SUPABASE_URL') ||
    readProcessEnv('NEXT_PUBLIC_SUPABASE_URL')
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