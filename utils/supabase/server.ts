import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/supabase'

// 👇 : Promise<SupabaseClient<Database, 'public'>> 으로 변경
export async function createClient(): Promise<SupabaseClient<Database, 'public'>> {
  const cookieStore = await cookies()

  // 👇 여기도 <Database, 'public'> 추가
  return createServerClient<Database, 'public'>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
          }
        },
      },
    }
  )
}