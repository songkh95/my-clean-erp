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
    if (path.startsWith('/accounting')) return '💰 정산 및 회계 관리'
    return '🧼 My Clean ERP'
  }

  return (
    <header style={{
      height: '70px', // 높이 약간 증가
      backgroundColor: '#FFFFFF', // White
      borderBottom: '1px solid #E5E5E5', // Soft Gray
      color: '#171717', // Off Black
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 40px',
      position: 'sticky',
      top: 0,
      zIndex: 90
    }}>
      <h2 style={{ fontSize: '1.4rem', fontWeight: '700', margin: 0 }}>
        {getPageTitle(pathname)}
      </h2>

      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', fontSize: '0.9rem' }}>
        {userEmail ? (
          <>
            <span style={{color: '#666666', fontWeight:'500'}}>👤 {userEmail} 님</span>
            <button 
              onClick={handleLogout}
              style={{
                padding: '8px 16px',
                backgroundColor: '#FFFFFF',
                border: '1px solid #E5E5E5',
                color: '#171717',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: '600',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#F5F5F5'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#FFFFFF'}
            >
              로그아웃
            </button>
          </>
        ) : (
          <span style={{color:'#666666'}}>확인 중...</span>
        )}
      </div>
    </header>
  )
}