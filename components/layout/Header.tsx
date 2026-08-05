'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase'
import { useRouter, usePathname } from 'next/navigation'
import Button from './../ui/Button'
import styles from './layout.module.css'

type HeaderProps = {
  onMenuClick?: () => void
  showMenuButton?: boolean
}

function getPageTitle(path: string, compact: boolean) {
  if (path === '/') return compact ? '홈' : '홈 (대시보드)'
  if (path.startsWith('/clients')) return compact ? '거래처' : '거래처 관리'
  if (path.startsWith('/inventory')) return compact ? '재고' : '자산 및 재고 관리'
  if (path.startsWith('/service')) return compact ? '일지' : '서비스 일지'
  if (path.startsWith('/accounting/registration')) return compact ? '정산' : '월 정산 등록'
  if (path.startsWith('/accounting/history')) return compact ? '청구' : '청구 이력/수정'
  if (path.startsWith('/accounting')) return compact ? '정산' : '정산 및 회계 관리'
  if (path.startsWith('/settings')) return '설정'
  return 'My Clean ERP'
}

export default function Header({ onMenuClick, showMenuButton = false }: HeaderProps) {
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userName, setUserName] = useState<string | null>(null)
  const [compact, setCompact] = useState(false)
  const supabase = createClient()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const sync = () => setCompact(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserEmail(user.email ?? null)
        const { data: profile } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', user.id)
          .maybeSingle()
        setUserName(profile?.name || null)
      }
    }
    getUser()
  }, [pathname])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const displayName = userName || userEmail || ''

  return (
    <header className={styles.header}>
      <div className={styles.headerLeft}>
        {showMenuButton ? (
          <button
            type="button"
            className={styles.menuBtn}
            aria-label="메뉴 열기"
            onClick={onMenuClick}
          >
            ☰
          </button>
        ) : null}
        <h2 className={styles.pageTitle}>{getPageTitle(pathname, compact)}</h2>
      </div>

      <div className={styles.headerRight}>
        {userEmail ? (
          <>
            <div className={styles.userMeta} title={userEmail}>
              <span className={styles.userAvatar} aria-hidden>👤</span>
              <span className={styles.userName}>{displayName}</span>
              {userName && userEmail ? (
                <span className={styles.userEmail}>({userEmail})</span>
              ) : null}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className={styles.logoutBtn}
              aria-label="로그아웃"
            >
              {compact ? '나가기' : '로그아웃'}
            </Button>
          </>
        ) : (
          <span className={styles.userLoading}>…</span>
        )}
      </div>
    </header>
  )
}
