import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/** Server Actions POST with an action id — must never be redirected or they hang client-side. */
function isServerActionRequest(request: NextRequest): boolean {
  if (request.method !== 'POST') return false
  return (
    request.headers.has('next-action') ||
    request.headers.has('Next-Action') ||
    request.headers.get('accept')?.includes('text/x-component') === true
  )
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })
  const serverAction = isServerActionRequest(request)

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
    console.error('[proxy] auth.getUser failed:', error instanceof Error ? error.message : error)
  }

  const { pathname } = request.nextUrl
  const isLogin = pathname === '/manager/login'
  const isProtected = pathname.startsWith('/manager') && !isLogin

  // Never redirect Server Action POSTs — the client awaits a response and will spin forever.
  if (isProtected && !user && !serverAction) {
    const url = request.nextUrl.clone()
    url.pathname = '/manager/login'
    return NextResponse.redirect(url)
  }

  if (isLogin && user && !request.nextUrl.searchParams.has('error') && !serverAction) {
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