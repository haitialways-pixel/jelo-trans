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
          // Support both sync and async cookieStore
          const allCookies = cookieStore.getAll instanceof Function 
            ? cookieStore.getAll() 
            : [];
          return Array.isArray(allCookies) ? allCookies : [];
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              // @ts-expect-error Cloudflare / Next.js cookie type differences
              cookieStore.set(name, value, options)
            })
          } catch (error) {
            // Ignore errors in Server Components / Edge environments
            console.warn('Cookie setAll failed (expected in some Cloudflare contexts)', error)
          }
        },
      },
    }
  )
}

// Keep your other functions (createAdminClient, etc.)
export function createAdminClient() {
  // ... your existing admin client code here
}