'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase'
import { useRouter, usePathname } from 'next/navigation'
import Button from './../ui/Button'

export default function Header() {
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const supabase = createClient()
  const router = useRouter()
  const pathname = usePathname()

  // 유저 정보 가져오기 (기능 보존)
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserEmail(user.email ?? null)
      }
    }
    getUser()
  }, [])

  // 로그아웃 로직 (기능 보존)
  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // 경로에 따른 제목 생성 (기능 보존)
  const getPageTitle = (path: string) => {
    if (path === '/') return '🏠 홈 (대시보드)'
    if (path.startsWith('/clients')) return '👥 거래처 관리'
    if (path.startsWith('/inventory')) return '📦 자산 및 재고 관리'
    if (path.startsWith('/accounting')) return '💰 정산 및 회계 관리'
    return '🧼 My Clean ERP'
  }

  return (
    <header style={{
      height: '60px', // 노션 스타일의 조금 더 슬림한 높이
      backgroundColor: 'var(--notion-bg)',
      borderBottom: '1px solid var(--notion-border)',
      color: 'var(--notion-main-text)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px', // 여백 조정
      position: 'sticky',
      top: 0,
      zIndex: 90
    }}>
      {/* 왼쪽: 현재 페이지 타이틀 */}
      <h2 style={{ 
        fontSize: '1.1rem', 
        fontWeight: '600', 
        margin: 0,
        letterSpacing: '-0.01em'
      }}>
        {getPageTitle(pathname)}
      </h2>

      {/* 오른쪽: 유저 정보 및 로그아웃 버튼 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {userEmail ? (
          <>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              fontSize: '0.85rem',
              color: 'var(--notion-sub-text)'
            }}>
              <span style={{ 
                width: '24px', 
                height: '24px', 
                backgroundColor: 'var(--notion-soft-bg)', 
                borderRadius: '50%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                fontSize: '0.7rem',
                border: '1px solid var(--notion-border)'
              }}>
                👤
              </span>
              <span style={{ fontWeight: '500' }}>{userEmail}</span>
            </div>
            
            {/* 공통 Button 컴포넌트 적용 */}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleLogout}
              style={{ fontWeight: '500' }}
            >
              로그아웃
            </Button>
          </>
        ) : (
          <span style={{ fontSize: '0.85rem', color: 'var(--notion-sub-text)' }}>
            사용자 확인 중...
          </span>
        )}
      </div>
    </header>
  )
}