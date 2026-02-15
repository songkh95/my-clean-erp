'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Button from './../ui/Button'

type SidebarProps = {
  isCollapsed: boolean;
  toggleSidebar: () => void;
}

export default function Sidebar({ isCollapsed, toggleSidebar }: SidebarProps) {
  const pathname = usePathname()

  const getNavStyle = (path: string) => {
    // 하위 경로까지 포함하여 활성화 상태 체크
    const isActive = pathname === path || (pathname.startsWith(path) && path !== '/');

    return {
      display: 'flex',
      alignItems: 'center',
      justifyContent: isCollapsed ? 'center' : 'flex-start',
      padding: '8px 12px',
      borderRadius: 'var(--radius-sm)',
      marginBottom: '4px',
      textDecoration: 'none',
      fontSize: '0.9rem',
      fontWeight: isActive ? '600' : '500',
      transition: 'background 0.2s',
      backgroundColor: isActive ? 'var(--notion-soft-bg)' : 'transparent',
      color: isActive ? 'var(--notion-main-text)' : 'var(--notion-sub-text)',
      whiteSpace: 'nowrap' as const,
      overflow: 'hidden',
      height: '36px',
      boxSizing: 'border-box' as const
    }
  }

  // ✅ 메뉴 구조 업데이트: 서비스 일지 추가
  const navItems = [
    { name: '홈 (대시보드)', path: '/', icon: '🏠' },
    { name: '거래처 관리', path: '/clients', icon: '👥' },
    { name: '자산 및 재고', path: '/inventory', icon: '📦' },
    { name: '서비스 일지', path: '/service', icon: '🛠️' }, // ✨ 추가됨
    { name: '월 정산 등록', path: '/accounting/registration', icon: '📝' },
    { name: '청구 이력/수정', path: '/accounting/history', icon: '🕒' },
  ]

  return (
    <aside style={{
      width: isCollapsed ? '72px' : '240px',
      height: '100vh',
      borderRight: '1px solid var(--notion-border)',
      padding: '12px',
      backgroundColor: 'var(--notion-bg)',
      position: 'fixed',
      left: 0,
      top: 0,
      transition: 'width 0.3s ease',
      zIndex: 100,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: isCollapsed ? 'center' : 'space-between', 
        alignItems: 'center', 
        marginBottom: '24px',
        padding: '0 4px',
        height: '40px'
      }}>
        {!isCollapsed && (
          <h2 style={{ 
            fontSize: '1rem', 
            margin: 0, 
            whiteSpace: 'nowrap', 
            fontWeight: '700', 
            color: 'var(--notion-main-text)',
            letterSpacing: '-0.02em'
          }}>
            🧼 My Clean ERP
          </h2>
        )}
        
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={toggleSidebar}
          style={{ 
            padding: '4px', 
            minWidth: '28px', 
            height: '28px',
            color: 'var(--notion-sub-text)' 
          }}
        >
          {isCollapsed ? '☰' : '◀'}
        </Button>
      </div>
      
      <nav style={{ flex: 1 }}>
        {navItems.map((item) => (
          <Link 
            key={item.path} 
            href={item.path} 
            style={getNavStyle(item.path)}
            title={isCollapsed ? item.name : ''}
            onMouseOver={(e) => {
              const isActive = pathname === item.path || (pathname.startsWith(item.path) && item.path !== '/');
              if (!isActive) e.currentTarget.style.backgroundColor = 'var(--notion-soft-bg)'
            }}
            onMouseOut={(e) => {
              const isActive = pathname === item.path || (pathname.startsWith(item.path) && item.path !== '/');
              if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            <span style={{ 
              fontSize: '1.1rem', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              width: '24px'
            }}>
              {item.icon}
            </span>
            
            {!isCollapsed && (
              <span style={{ 
                marginLeft: '10px',
                transition: 'opacity 0.2s'
              }}>
                {item.name}
              </span>
            )}
          </Link>
        ))}
      </nav>

      {!isCollapsed && (
        <div style={{ 
          padding: '12px 4px', 
          fontSize: '0.75rem', 
          color: 'var(--notion-sub-text)',
          borderTop: '1px solid var(--notion-border)'
        }}>
          v0.2.1-beta
        </div>
      )}
    </aside>
  )
}