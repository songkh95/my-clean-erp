// middleware.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr'
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

  // 1. 하위 경로까지 모두 보호할 메뉴들 (startsWith로 검사)
  const protectedPaths = [
    '/clients',    // 거래처 관리
    '/inventory',  // 자산 및 재고
    '/accounting', // 정산 및 회계
  ]

  // 2. 경로 검사 로직
  // (1) protectedPaths에 포함된 경로로 시작하는지 확인
  const isProtectedPath = protectedPaths.some(path => request.nextUrl.pathname.startsWith(path))
  
  // (2) 대시보드(홈)인지 확인 (정확히 '/' 일 때만! 그래야 /login이 안 막힘)
  const isHomePage = request.nextUrl.pathname === '/'

  // 로그인이 안 된 상태에서 -> (보호된 경로 OR 홈 화면)에 접근하면 -> 로그인 페이지로 튕겨냄
  if (!user && (isProtectedPath || isHomePage)) {
    return NextResponse.redirect(new URL('/login?error=unauthorized', request.url))
  }

  return response
}

export const config = {
  // _next, static 파일, 이미지 등은 미들웨어 검사 제외
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}