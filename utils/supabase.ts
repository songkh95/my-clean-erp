import { createBrowserClient } from '@supabase/ssr'
import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/supabase'

// 👇 : SupabaseClient<Database, 'public'> 으로 변경
export function createClient(): SupabaseClient<Database, 'public'> {
  // 👇 여기도 <Database, 'public'> 추가
  return createBrowserClient<Database, 'public'>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}