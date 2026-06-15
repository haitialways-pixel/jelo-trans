// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  const cookieStore = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          // Handle the Promise case properly
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              // @ts-expect-error - Next.js types vs Supabase
              cookieStore.set(name, value, options)
            })
          } catch {
            // The `setAll` method was called from a Server Component.
            // This use case is not supported in Cloudflare / Edge.
            // We ignore it for now (Supabase will still work for most flows).
          }
        },
      },
    }
  )
}

// Add other helpers if needed (createAdminClient, etc.)
export function createAdminClient() {
  // your existing admin client code
}