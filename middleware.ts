import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // 1. 초기 응답 객체 생성
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // 2. Supabase 클라이언트 생성 (쿠키 제어 포함)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          // 쿠키 설정 시 request와 response 동기화 (Next.js 14+ 호환)
          request.cookies.set({ name: name, value: value, ...options })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({ name: name, value: value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          // 쿠키 삭제 시 동기화
          request.cookies.set({ name: name, value: '', ...options })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({ name: name, value: '', ...options })
        },
      },
    }
  )

  // 3. 현재 로그인된 유저 확인
  const { data: { user } } = await supabase.auth.getUser()

  // 🔒 보안 강화: 비로그인 접근을 막을 경로들 정의
  const protectedPaths = [
    '/clients',    // 거래처 관리
    '/inventory',  // 자산 및 재고
    '/accounting', // 정산 및 회계
    '/mypage',     // (예시) 마이페이지
  ]
  
  // 현재 접속하려는 주소가 보호된 경로 중 하나인지 확인
  const isProtectedPath = protectedPaths.some(path => 
    request.nextUrl.pathname.startsWith(path)
  )

  // 🚫 차단 1: 비로그인 유저가 보호된 경로 접근 시 -> 로그인 페이지로 이동
  if (!user && isProtectedPath) {
    const url = new URL('/login', request.url)
    // "로그인이 필요합니다" 알림을 위해 쿼리 파라미터 추가
    url.searchParams.set('error', 'unauthorized')
    return NextResponse.redirect(url)
  }

  // 🔄 UX 개선: 이미 로그인한 유저가 로그인 페이지(/login) 접근 시 -> 홈으로 이동
  if (user && request.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return response
}

export const config = {
  // _next/static, 이미지, 파비콘 등을 제외한 모든 경로에서 미들웨어 실행
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}