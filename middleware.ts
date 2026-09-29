import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabasePublicKey, getSupabaseUrl } from '@/lib/supabase/env'

/** Server Actions POST with an action id — must never be redirected or they hang client-side. */
function isServerActionRequest(request: NextRequest): boolean {
  if (request.method !== 'POST') return false
  return (
    request.headers.has('next-action') ||
    request.headers.has('Next-Action') ||
    request.headers.get('accept')?.includes('text/x-component') === true
  )
}


type StaffGate = 'manager' | 'admin' | 'none' | 'unknown'

async function staffGate(supabase: ReturnType<typeof createServerClient>): Promise<StaffGate> {
  try {
    const { data, error } = await supabase.rpc('get_my_staff_profile')
    if (error) {
      console.error('[middleware] get_my_staff_profile failed:', error.message)
      return 'unknown'
    }
    const profile = Array.isArray(data) ? data[0] : data
    const role = profile?.role
    if (role === 'manager' || role === 'admin') return role
    return 'none'
  } catch (error) {
    console.error('[middleware] staff lookup failed:', error instanceof Error ? error.message : error)
    return 'unknown'
  }
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })
  const serverAction = isServerActionRequest(request)

  const supabaseUrl = getSupabaseUrl()
  const supabaseKey = getSupabasePublicKey()
  if (!supabaseUrl || !supabaseKey) {
    return new Response(
      'Middleware needs NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY).',
      { status: 500 },
    )
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
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
    console.error('[middleware] auth.getUser failed:', error instanceof Error ? error.message : error)
  }

  const { pathname } = request.nextUrl

  // PWA shell assets must stay public (no auth redirect) so install / SW work
  // even before login, and so the service worker can precache them.
  const isManagerPwaAsset =
    pathname === '/manager/sw.js' ||
    pathname === '/manager/manifest.webmanifest' ||
    pathname === '/manager/offline.html' ||
    pathname.startsWith('/manager/icons/')

  if (isManagerPwaAsset) {
    return response
  }

  const isLogin = pathname === '/manager/login'
  const isApi = pathname.startsWith('/api/manager')
  const isProtected = (pathname.startsWith('/manager') && !isLogin) || isApi

  let gate: StaffGate = 'none'
  if (user && (isProtected || isLogin)) {
    gate = await staffGate(supabase)
  }

  if (isProtected && !user && !serverAction) {
    if (isApi) return NextResponse.json({ error: 'Not authorized' }, { status: 401 })
    const url = request.nextUrl.clone()
    url.pathname = '/manager/login'
    return NextResponse.redirect(url)
  }

  // Role values are manager | admin (staff.role check). A definitive empty
  // profile is rejected. If the RPC itself errors, do not lock out the owner.
  if (isProtected && user && gate === 'none' && !serverAction) {
    if (isApi) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    const url = request.nextUrl.clone()
    url.pathname = '/manager/login'
    url.search = '?error=not_staff'
    return NextResponse.redirect(url)
  }

  if (isLogin && user && gate !== 'none' && !request.nextUrl.searchParams.has('error') && !serverAction) {
    const url = request.nextUrl.clone()
    url.pathname = '/manager'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: ['/manager', '/manager/:path*', '/api/manager/:path*'],
}