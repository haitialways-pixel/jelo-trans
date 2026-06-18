import { createMiddlewareClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  const { data: { session } } = await supabase.auth.getSession()

  // Protect manager routes
  if (req.nextUrl.pathname.startsWith('/manager') && !session) {
    return NextResponse.redirect(new URL('/manager/login', req.url))
  }

  // Redirect logged-in managers away from login page
  if (req.nextUrl.pathname === '/manager/login' && session) {
    return NextResponse.redirect(new URL('/manager', req.url))
  }

  return res
}

export const config = {
  matcher: ['/manager/:path*'],
}