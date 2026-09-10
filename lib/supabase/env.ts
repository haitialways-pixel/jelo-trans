/** Project URL from Dashboard → Project Settings → API. */
export function getSupabaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL
}

/**
 * Public client key. Newer dashboards issue NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
 * (`sb_publishable_...`); older ones use the JWT anon key.
 */
export function getSupabasePublicKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}
