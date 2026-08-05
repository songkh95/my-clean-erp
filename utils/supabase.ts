import { createBrowserClient } from '@supabase/ssr'
import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/supabase'

let browserClient: SupabaseClient<Database, 'public'> | null = null

/** 브라우저용 Supabase 클라이언트 (모듈 싱글톤 — 렌더마다 새로 만들면 fetch 루프 발생) */
export function createClient(): SupabaseClient<Database, 'public'> {
  if (browserClient) return browserClient

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error(
      'Supabase URL/Key가 없습니다. .env.local에 NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY를 설정하세요.'
    )
  }

  browserClient = createBrowserClient<Database, 'public'>(url, key, {
    isSingleton: true,
  })

  return browserClient
}
