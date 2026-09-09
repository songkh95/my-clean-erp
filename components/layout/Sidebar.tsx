'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import Button from './../ui/Button'
import { loadAppSettings } from '@/utils/appSettings'
import styles from './layout.module.css'

type SidebarProps = {
  isCollapsed: boolean
  isMobile?: boolean
  mobileOpen?: boolean
  toggleSidebar: () => void
  onNavigate?: () => void
}

export default function Sidebar({
  isCollapsed,
  isMobile = false,
  mobileOpen = false,
  toggleSidebar,
  onNavigate,
}: SidebarProps) {
  const pathname = usePathname()
  const [appName, setAppName] = useState('My Clean ERP')

  useEffect(() => {
    const sync = () => setAppName(loadAppSettings().general.appDisplayName || 'My Clean ERP')
    sync()
    window.addEventListener('app-settings-changed', sync)
    return () => window.removeEventListener('app-settings-changed', sync)
  }, [])

  const navItems = [
    { name: '홈 (대시보드)', path: '/', icon: '🏠' },
    { name: '거래처 관리', path: '/clients', icon: '👥' },
    { name: '자산 및 재고', path: '/inventory', icon: '📦' },
    {
      name: '서비스',
      path: '/service',
      icon: '🛠️',
      children: [
        { name: '서비스 일지', path: '/service' },
        { name: '판매_출장일지', path: '/service/sales-trip' },
        { name: '단기 렌탈', path: '/service/short-rental' },
      ],
    },
    { name: '견적서', path: '/quotes', icon: '📄' },
    { name: '월 정산 등록', path: '/accounting/registration', icon: '📝' },
    { name: '청구 이력/수정', path: '/accounting/history', icon: '🕒' },
    { name: '설정', path: '/settings', icon: '⚙️' },
  ]

  const asideClass = [
    styles.sidebar,
    !isMobile && isCollapsed ? styles.sidebarCollapsed : '',
    isMobile && mobileOpen ? styles.sidebarOpen : '',
  ]
    .filter(Boolean)
    .join(' ')

  const serviceSectionOpen = pathname === '/service' || pathname.startsWith('/service/')

  return (
    <aside className={asideClass} aria-hidden={isMobile && !mobileOpen}>
      <div
        style={{
          display: 'flex',
          justifyContent: isCollapsed && !isMobile ? 'center' : 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          padding: '0 2px',
          minHeight: '40px',
        }}
      >
        {(!isCollapsed || isMobile) && (
          <h2
            style={{
              fontSize: '1rem',
              margin: 0,
              whiteSpace: 'nowrap',
              fontWeight: 700,
              color: 'var(--notion-main-text)',
              letterSpacing: '-0.02em',
            }}
          >
            🧼 {appName}
          </h2>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSidebar}
          aria-label={isMobile ? (mobileOpen ? '메뉴 닫기' : '메뉴 열기') : '사이드바 접기'}
          style={{
            padding: '8px',
            minWidth: '40px',
            height: '40px',
            color: 'var(--notion-sub-text)',
          }}
        >
          {isMobile ? '✕' : isCollapsed ? '☰' : '◀'}
        </Button>
      </div>

      <nav style={{ flex: 1, overflowY: 'auto' }}>
        {navItems.map((item) => {
          const children = 'children' in item ? item.children : undefined
          const parentActive = children
            ? serviceSectionOpen
            : pathname === item.path || (pathname.startsWith(item.path) && item.path !== '/')

          if (children && (!isCollapsed || isMobile)) {
            return (
              <div key={item.path} style={{ marginBottom: 4 }}>
                <Link
                  href={item.path}
                  className={[styles.navLink, parentActive ? styles.navLinkActive : '']
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => onNavigate?.()}
                >
                  <span
                    style={{
                      fontSize: '1.1rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '24px',
                      flexShrink: 0,
                    }}
                  >
                    {item.icon}
                  </span>
                  <span style={{ marginLeft: '10px' }}>{item.name}</span>
                </Link>
                <div style={{ marginLeft: 12, paddingLeft: 8, borderLeft: '2px solid var(--notion-border)' }}>
                  {children.map((child) => {
                    const childActive =
                      child.path === '/service'
                        ? pathname === '/service'
                        : pathname === child.path || pathname.startsWith(`${child.path}/`)
                    return (
                      <Link
                        key={child.path}
                        href={child.path}
                        className={[styles.navLink, childActive ? styles.navLinkActive : '']
                          .filter(Boolean)
                          .join(' ')}
                        style={{ minHeight: 34, fontSize: '0.84rem', marginBottom: 2 }}
                        onClick={() => onNavigate?.()}
                      >
                        <span style={{ marginLeft: 8 }}>{child.name}</span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          }

          return (
            <Link
              key={item.path}
              href={item.path}
              className={[
                styles.navLink,
                parentActive ? styles.navLinkActive : '',
                isCollapsed && !isMobile ? styles.navLinkCollapsed : '',
              ]
                .filter(Boolean)
                .join(' ')}
              title={isCollapsed && !isMobile ? item.name : undefined}
              onClick={() => onNavigate?.()}
            >
              <span
                style={{
                  fontSize: '1.1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '24px',
                  flexShrink: 0,
                }}
              >
                {item.icon}
              </span>

              {(!isCollapsed || isMobile) && (
                <span style={{ marginLeft: '10px' }}>{item.name}</span>
              )}
            </Link>
          )
        })}
      </nav>

      {(!isCollapsed || isMobile) && (
        <div
          style={{
            padding: '12px 4px',
            fontSize: '0.75rem',
            color: 'var(--notion-sub-text)',
            borderTop: '1px solid var(--notion-border)',
          }}
        >
          v0.2.1-beta
        </div>
      )}
    </aside>
  )
}
