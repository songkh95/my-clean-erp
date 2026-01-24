'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase'
import { useRouter, usePathname } from 'next/navigation'

export default function Header() {
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const supabase = createClient()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // 🔴 [수정] 이메일이 없으면 null을 넣도록 '?? null' 추가
        setUserEmail(user.email ?? null)
      }
    }
    getUser()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const getPageTitle = (path: string) => {
    if (path === '/') return '🏠 홈 (대시보드)'
    if (path.startsWith('/clients')) return '👥 거래처 관리'
    if (path.startsWith('/inventory')) return '📦 자산 및 재고 관리'
    return '🧼 My Clean ERP'
  }

  return (
    <header style={{
      height: '60px',
      backgroundColor: '#333',
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 30px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    }}>
      <h2 style={{ fontSize: '1.1rem', fontWeight: 'bold', margin: 0 }}>
        {getPageTitle(pathname)}
      </h2>

      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', fontSize: '0.9rem' }}>
        {userEmail ? (
          <>
            <span>👤 {userEmail} 님</span>
            <button 
              onClick={handleLogout}
              style={{
                padding: '6px 12px',
                backgroundColor: '#555',
                border: '1px solid #777',
                color: '#fff',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.8rem'
              }}
            >
              로그아웃
            </button>
          </>
        ) : (
          <span>로그인 정보 확인 중...</span>
        )}
      </div>
    </header>
  )
}