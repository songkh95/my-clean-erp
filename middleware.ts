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
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name: name, value: value, ...options })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({ name: name, value: value, ...options })
        },
        remove(name: string, options: CookieOptions) {
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

  const { data: { user } } = await supabase.auth.getUser()

  // 🔒 보안 강화: 보호할 경로들을 배열로 정의
  const protectedPaths = ['/clients', '/inventory', '/accounting', '/mypage']
  
  // 현재 접속하려는 주소가 보호된 경로 중 하나로 시작하는지 확인
  const isProtectedPath = protectedPaths.some(path => 
    request.nextUrl.pathname.startsWith(path)
  )

  // 로그인을 안 했고 && 보호된 경로에 접근하려 한다면 -> 로그인 페이지로 쫓아냄
  if (!user && isProtectedPath) {
    const url = new URL('/login', request.url)
    url.searchParams.set('error', 'unauthorized')
    return NextResponse.redirect(url)
  }

  // (선택 사항) 이미 로그인했는데 로그인 페이지로 가려고 하면 홈으로 리다이렉트
  if (user && request.nextUrl.pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return response
}

export const config = {
  // _next/static, 이미지, 파비콘 등을 제외한 모든 경로에서 미들웨어 실행
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}