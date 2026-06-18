import { createMiddlewareClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  // Protect all /manager routes
  if (req.nextUrl.pathname.startsWith('/manager')) {
    if (!session) {
      // Not logged in → redirect to login
      return NextResponse.redirect(new URL('/manager/login', req.url))
    }

    // Check if user is manager
    const role = session.user?.user_metadata?.role
    if (role !== 'manager') {
      // Not a manager → sign out and redirect
      await supabase.auth.signOut()
      return NextResponse.redirect(new URL('/manager/login?error=not_staff', req.url))
    }
  }

  // If already logged in as manager, redirect away from login page
  if (req.nextUrl.pathname === '/manager/login' && session) {
    const role = session.user?.user_metadata?.role
    if (role === 'manager') {
      return NextResponse.redirect(new URL('/manager', req.url))
    }
  }

  return res
}

// Apply middleware only to manager routes
export const config = {
  matcher: ['/manager/:path*'],
}