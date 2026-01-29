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

  // 노션 스타일 내비게이션 아이템 스타일 정의 (기능 보존)
  const getNavStyle = (path: string) => {
    const isActive = (pathname.startsWith(path) && path !== '/') || pathname === path

    return {
      display: 'flex',
      alignItems: 'center',
      justifyContent: isCollapsed ? 'center' : 'flex-start',
      padding: '8px 12px',
      borderRadius: 'var(--radius-sm)',
      marginBottom: '2px',
      textDecoration: 'none',
      fontSize: '0.9rem',
      fontWeight: isActive ? '600' : '500',
      transition: 'background 0.2s',
      // 활성화 시 노션 특유의 연한 배경색 적용
      backgroundColor: isActive ? 'var(--notion-soft-bg)' : 'transparent',
      // 활성화 시 메인 텍스트, 비활성 시 서브 텍스트 색상
      color: isActive ? 'var(--notion-main-text)' : 'var(--notion-sub-text)',
      whiteSpace: 'nowrap' as const,
      overflow: 'hidden',
      height: '36px',
      boxSizing: 'border-box' as const
    }
  }

  const navItems = [
    { name: '홈 (대시보드)', path: '/', icon: '🏠' },
    { name: '거래처 관리', path: '/clients', icon: '👥' },
    { name: '자산 및 재고', path: '/inventory', icon: '📦' },
    { name: '정산 및 회계', path: '/accounting', icon: '💰' },
  ]

  return (
    <aside style={{
      width: isCollapsed ? '72px' : '240px',
      height: '100vh',
      borderRight: '1px solid var(--notion-border)', // 노션 스타일 구분선
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
      {/* 상단 로고 및 토글 영역 */}
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
        
        {/* 공통 Button 컴포넌트의 ghost 스타일 적용 */}
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
      
      {/* 내비게이션 메뉴 */}
      <nav style={{ flex: 1 }}>
        {navItems.map((item) => (
          <Link 
            key={item.path} 
            href={item.path} 
            style={getNavStyle(item.path)}
            title={isCollapsed ? item.name : ''}
            onMouseOver={(e) => {
              const isActive = (pathname.startsWith(item.path) && item.path !== '/') || pathname === item.path
              if (!isActive) e.currentTarget.style.backgroundColor = 'var(--notion-soft-bg)'
            }}
            onMouseOut={(e) => {
              const isActive = (pathname.startsWith(item.path) && item.path !== '/') || pathname === item.path
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

      {/* 하단 버전 표시 (디테일) */}
      {!isCollapsed && (
        <div style={{ 
          padding: '12px 4px', 
          fontSize: '0.75rem', 
          color: 'var(--notion-sub-text)',
          borderTop: '1px solid var(--notion-border)'
        }}>
          v0.1.0-alpha
        </div>
      )}
    </aside>
  )
}