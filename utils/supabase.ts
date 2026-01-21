import { createBrowserClient } from '@supabase/ssr'

// 우리 집(Next.js)과 창고(Supabase)를 연결해주는 함수입니다.
export function createClient() {  //export (내보내기)
  return createBrowserClient(
    // .env.local에 적어둔 주소를 가져옵니다.
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    // .env.local에 적어둔 입장권을 가져옵니다.
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}