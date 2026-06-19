import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => 
            res.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { session },
  } = await supabase.auth.getSession()

  // Protect manager routes
  if (req.nextUrl.pathname.startsWith('/manager') && 
      !req.nextUrl.pathname.includes('/login')) {
    
    if (!session) {
      return NextResponse.redirect(new URL('/manager/login', req.url))
    }

    const role = session.user?.user_metadata?.role || 
                 session.user?.app_metadata?.role

    if (role !== 'manager') {
      await supabase.auth.signOut()
      return NextResponse.redirect(new URL('/manager/login?error=not_staff', req.url))
    }
  }

  // Redirect logged-in managers away from login page
  if (req.nextUrl.pathname === '/manager/login' && session) {
    const role = session.user?.user_metadata?.role || 
                 session.user?.app_metadata?.role
    if (role === 'manager') {
      return NextResponse.redirect(new URL('/manager', req.url))
    }
  }

  return res
}

export const config = {
  matcher: ['/manager/:path*'],
}