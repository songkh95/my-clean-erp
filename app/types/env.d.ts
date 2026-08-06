declare namespace NodeJS {
  interface ProcessEnv {
    NEXT_PUBLIC_SUPABASE_URL: string
    NEXT_PUBLIC_SUPABASE_ANON_KEY: string
    /** 선택: 카카오 로컬 REST 키 (한국 주소 지오코딩 정확도 향상) */
    KAKAO_REST_API_KEY?: string
  }
}