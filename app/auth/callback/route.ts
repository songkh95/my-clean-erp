import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { finalizeSignupFromMetadataAction } from '@/app/actions/auth'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') || '/auth/verified'
  const type = searchParams.get('type') // recovery | signup | email 등

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // 비밀번호 재설정은 바로 새 비밀번호 페이지로
      if (next.includes('reset-password') || type === 'recovery') {
        return NextResponse.redirect(`${origin}${next.startsWith('/') ? next : `/${next}`}`)
      }

      // 이메일 확인 / 일반 콜백 → 프로필·조직 마무리 후 안내 페이지
      await finalizeSignupFromMetadataAction()

      const dest = next.startsWith('/') ? next : `/${next}`
      // verified 페이지에서 안내 후 로그인으로 보냄
      if (dest === '/' || dest === '/signup' || dest === '/login') {
        return NextResponse.redirect(`${origin}/auth/verified`)
      }
      return NextResponse.redirect(`${origin}${dest}`)
    }
  }

  // code 없이 해시 토큰만 오는 경우 → 클라이언트 페이지에서 처리
  if (!code) {
    return NextResponse.redirect(`${origin}/auth/verified?pending=1`)
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback`)
}
