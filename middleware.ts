import { createMiddlewareClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  // Protect manager routes (except login page)
  if (req.nextUrl.pathname.startsWith('/manager') && 
      !req.nextUrl.pathname.includes('/login')) {
    
    if (!session) {
      return NextResponse.redirect(new URL('/manager/login', req.url))
    }

    // Check role
    const role = session.user?.user_metadata?.role || 
                 session.user?.app_metadata?.role

    if (role !== 'manager') {
      console.log("Access denied - not a manager. Role:", role)
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