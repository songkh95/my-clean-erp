'use client'

import { useEffect, useState } from 'react'
import Sidebar from './Sidebar'
import Header from './Header'
import styles from './layout.module.css'

const MOBILE_MQ = '(max-width: 768px)'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ)
    const sync = () => {
      const mobile = mq.matches
      setIsMobile(mobile)
      if (!mobile) setMobileOpen(false)
    }
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    if (!mobileOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [mobileOpen])

  const sidebarWidth = isMobile
    ? '0px'
    : isCollapsed
      ? 'var(--sidebar-collapsed)'
      : 'var(--sidebar-width)'

  return (
    <div className={styles.shell}>
      {isMobile && mobileOpen ? (
        <button
          type="button"
          className={styles.overlay}
          aria-label="메뉴 닫기"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <Sidebar
        isCollapsed={isMobile ? false : isCollapsed}
        isMobile={isMobile}
        mobileOpen={mobileOpen}
        toggleSidebar={() => {
          if (isMobile) setMobileOpen((v) => !v)
          else setIsCollapsed((v) => !v)
        }}
        onNavigate={() => setMobileOpen(false)}
      />

      <div className={styles.content} style={{ ['--shell-offset' as string]: sidebarWidth }}>
        <Header
          onMenuClick={() => setMobileOpen(true)}
          showMenuButton={isMobile}
        />

        <main className={styles.main}>
          <div className="pageShell">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
