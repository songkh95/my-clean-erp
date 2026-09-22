'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  Building2,
  ChevronDown,
  ChevronRight,
  FileText,
  History,
  LayoutGrid,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  SquarePen,
  Wallet,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react'
import { loadAppSettings } from '@/utils/appSettings'
import styles from './layout.module.css'

type SidebarProps = {
  isCollapsed: boolean
  isMobile?: boolean
  mobileOpen?: boolean
  toggleSidebar: () => void
  onNavigate?: () => void
}

type NavItem = {
  name: string
  path: string
  icon: LucideIcon
  children?: { name: string; path: string }[]
}

const ICON_STROKE = 1.5

const NAV_ITEMS: NavItem[] = [
  { name: '홈 (대시보드)', path: '/', icon: LayoutGrid },
  { name: '거래처', path: '/clients', icon: Building2 },
  { name: '재고', path: '/inventory', icon: Package },
  {
    name: '서비스',
    path: '/service',
    icon: Wrench,
    children: [
      { name: '서비스 일지', path: '/service' },
      { name: '판매_출장일지', path: '/service/sales-trip' },
      { name: '단기 렌탈', path: '/service/short-rental' },
    ],
  },
  { name: '견적서', path: '/quotes', icon: FileText },
  { name: '월 정산 등록', path: '/accounting/registration', icon: SquarePen },
  { name: '청구 이력', path: '/accounting/history', icon: History },
  { name: '수금 현황', path: '/accounting/dashboard', icon: Wallet },
  { name: '설정', path: '/settings', icon: Settings },
]

const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(' ')

export default function Sidebar({
  isCollapsed,
  isMobile = false,
  mobileOpen = false,
  toggleSidebar,
  onNavigate,
}: SidebarProps) {
  const pathname = usePathname()
  const [appName, setAppName] = useState('My Clean ERP')
  const [serviceOpen, setServiceOpen] = useState(true)

  useEffect(() => {
    const sync = () => setAppName(loadAppSettings().general.appDisplayName || 'My Clean ERP')
    sync()
    window.addEventListener('app-settings-changed', sync)
    return () => window.removeEventListener('app-settings-changed', sync)
  }, [])

  useEffect(() => {
    try {
      const v = sessionStorage.getItem('sidebar-service-open')
      if (v !== null) setServiceOpen(v === '1')
    } catch { /* ignore */ }
  }, [])

  const toggleServiceOpen = () => {
    setServiceOpen((prev) => {
      const next = !prev
      try { sessionStorage.setItem('sidebar-service-open', next ? '1' : '0') } catch { /* ignore */ }
      return next
    })
  }

  const collapsed = isCollapsed && !isMobile
  const serviceSectionOpen = pathname === '/service' || pathname.startsWith('/service/')

  const asideClass = cx(
    styles.sidebar,
    collapsed && styles.sidebarCollapsed,
    isMobile && mobileOpen && styles.sidebarOpen,
  )

  const ToggleIcon = isMobile ? X : isCollapsed ? PanelLeftOpen : PanelLeftClose
  const toggleLabel = isMobile
    ? (mobileOpen ? '메뉴 닫기' : '메뉴 열기')
    : (isCollapsed ? '사이드바 펼치기' : '사이드바 접기')

  return (
    <aside className={asideClass} aria-hidden={isMobile && !mobileOpen}>
      <div className={cx(styles.sidebarTop, collapsed && styles.sidebarTopCollapsed)}>
        {!collapsed && <span className={styles.appName}>{appName}</span>}
        <button
          type="button"
          className={styles.iconBtn}
          onClick={toggleSidebar}
          aria-label={toggleLabel}
          title={toggleLabel}
        >
          <ToggleIcon size="1em" strokeWidth={ICON_STROKE} aria-hidden />
        </button>
      </div>

      <nav className={styles.nav}>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const children = item.children
          const parentActive = children
            ? serviceSectionOpen
            : pathname === item.path || (pathname.startsWith(item.path) && item.path !== '/')

          if (children && !collapsed) {
            return (
              <div key={item.path} className={styles.navGroup}>
                <div className={styles.navGroupHead}>
                  <Link
                    href={item.path}
                    className={cx(styles.navLink, styles.navLinkFill, parentActive && styles.navLinkActive)}
                    onClick={() => onNavigate?.()}
                  >
                    <span className={styles.navIcon}>
                      <Icon size="1em" strokeWidth={ICON_STROKE} aria-hidden />
                    </span>
                    <span className={styles.navLabel}>{item.name}</span>
                  </Link>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleServiceOpen() }}
                    aria-label={serviceOpen ? '서비스 메뉴 접기' : '서비스 메뉴 펼치기'}
                    aria-expanded={serviceOpen}
                  >
                    {serviceOpen
                      ? <ChevronDown size="1em" strokeWidth={ICON_STROKE} aria-hidden />
                      : <ChevronRight size="1em" strokeWidth={ICON_STROKE} aria-hidden />}
                  </button>
                </div>
                {serviceOpen && (
                  <div className={styles.navChildren}>
                    {children.map((child) => {
                      const childActive =
                        child.path === '/service'
                          ? pathname === '/service'
                          : pathname === child.path || pathname.startsWith(`${child.path}/`)
                      return (
                        <Link
                          key={child.path}
                          href={child.path}
                          className={cx(styles.navLink, styles.navLinkChild, childActive && styles.navLinkActive)}
                          onClick={() => onNavigate?.()}
                        >
                          <span className={styles.navLabel}>{child.name}</span>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          }

          return (
            <Link
              key={item.path}
              href={item.path}
              className={cx(
                styles.navLink,
                parentActive && styles.navLinkActive,
                collapsed && styles.navLinkCollapsed,
              )}
              title={collapsed ? item.name : undefined}
              aria-label={collapsed ? item.name : undefined}
              onClick={() => onNavigate?.()}
            >
              <span className={styles.navIcon}>
                <Icon size="1em" strokeWidth={ICON_STROKE} aria-hidden />
              </span>
              {!collapsed && <span className={styles.navLabel}>{item.name}</span>}
            </Link>
          )
        })}
      </nav>

      {!collapsed && <div className={styles.sidebarFooter}>v0.2.1-beta</div>}
    </aside>
  )
}
