// middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  const isAuthPage =
    path === '/login' ||
    path.startsWith('/login/') ||
    path === '/signup' ||
    path.startsWith('/auth/')

  // 이미 로그인된 사용자가 로그인/가입 페이지로 오면 홈으로
  // (이메일 확인 안내·verified 쿼리가 있는 로그인은 그대로 둠)
  if (user && (path === '/signup' || (path === '/login' && !request.nextUrl.searchParams.get('verified')))) {
    return NextResponse.redirect(new URL('/', request.url))
  }
  if (user && path.startsWith('/login/') && path !== '/login') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  const protectedPaths = [
    '/clients',
    '/inventory',
    '/accounting',
    '/service',
    '/settings',
  ]

  const isProtectedPath = protectedPaths.some((p) => path.startsWith(p))
  const isHomePage = path === '/'

  if (!user && (isProtectedPath || isHomePage) && !isAuthPage) {
    return NextResponse.redirect(new URL('/login?error=unauthorized', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
