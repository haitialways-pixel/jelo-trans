import { createMiddlewareClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  console.log("Middleware session check:", session ? "Found" : "None")

  if (req.nextUrl.pathname.startsWith('/manager') && 
      !req.nextUrl.pathname.includes('/login')) {
    
    if (!session) {
      return NextResponse.redirect(new URL('/manager/login', req.url))
    }

    const role = session.user?.user_metadata?.role
    if (role !== 'manager') {
      await supabase.auth.signOut()
      return NextResponse.redirect(new URL('/manager/login?error=not_staff', req.url))
    }
  }

  if (req.nextUrl.pathname === '/manager/login' && session) {
    const role = session.user?.user_metadata?.role
    if (role === 'manager') {
      return NextResponse.redirect(new URL('/manager', req.url))
    }
  }

  return res
}

export const config = {
  matcher: ['/manager/:path*'],
}