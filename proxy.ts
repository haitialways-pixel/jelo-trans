import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return new Response(
      'Proxy middleware needs NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.',
      { status: 500 },
    )
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  let user = null
  try {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()
    user = authUser
  } catch (error) {
    // Edge runtime network errors: let the request through.
    // The server-side requireStaff() guard will enforce auth.
    console.error('[proxy] auth.getUser failed (edge runtime):', error instanceof Error ? error.message : error)
  }

  const { pathname } = request.nextUrl
  const isLogin = pathname === '/manager/login'
  const isProtected = pathname.startsWith('/manager') && !isLogin

  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/manager/login'
    return NextResponse.redirect(url)
  }

  // Let authenticated users stay on the login page when staff check failed
  // (requireStaff redirects here with ?error=not_staff). Redirecting them
  // straight back to /manager creates an infinite loop.
  if (isLogin && user && !request.nextUrl.searchParams.has('error')) {
    const url = request.nextUrl.clone()
    url.pathname = '/manager'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: ['/manager', '/manager/:path*'],
}