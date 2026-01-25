'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type SidebarProps = {
  isCollapsed: boolean;
  toggleSidebar: () => void;
}

export default function Sidebar({ isCollapsed, toggleSidebar }: SidebarProps) {
  const pathname = usePathname()

  const getNavStyle = (path: string) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: isCollapsed ? 'center' : 'flex-start',
    padding: isCollapsed ? '12px 0' : '12px 20px',
    borderRadius: '8px',
    marginBottom: '8px',
    textDecoration: 'none',
    fontSize: '0.95rem',
    fontWeight: '500',
    transition: 'all 0.2s',
    backgroundColor: pathname === path ? '#0070f3' : 'transparent',
    color: pathname === path ? '#fff' : '#475569',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    height: '45px',
    boxSizing: 'border-box' as const
  })

  const navItems = [
    { name: '홈 (대시보드)', path: '/', icon: '🏠' },
    { name: '거래처 관리', path: '/clients', icon: '👥' },
    { name: '자산 및 재고', path: '/inventory', icon: '📦' },
    // 🔴 [추가] 정산 및 회계 관리 메뉴
    { name: '정산 및 회계', path: '/accounting', icon: '💰' },
  ]

  return (
    <aside style={{
      width: isCollapsed ? '70px' : '240px',
      height: '100vh',
      borderRight: '1px solid #ddd',
      padding: '20px 12px',
      backgroundColor: '#fcfcfc',
      position: 'fixed',
      left: 0,
      top: 0,
      transition: 'width 0.3s ease',
      zIndex: 100,
      overflow: 'hidden'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: isCollapsed ? 'center' : 'space-between', 
        alignItems: 'center', 
        marginBottom: '30px',
        padding: '0 5px',
        height: '40px'
      }}>
        {!isCollapsed && (
          <h2 style={{ fontSize: '1.2rem', margin: 0, whiteSpace: 'nowrap' }}>
            🧼 ERP
          </h2>
        )}
        
        <button 
          onClick={toggleSidebar}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '1.2rem',
            color: '#333',
            padding: '5px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          ☰
        </button>
      </div>
      
      <nav>
        {navItems.map((item) => (
          <Link 
            key={item.path} 
            href={item.path} 
            style={getNavStyle(item.path)}
            title={isCollapsed ? item.name : ''}
          >
            <span style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {item.icon}
            </span>
            
            <span style={{ 
              marginLeft: isCollapsed ? 0 : '12px', 
              opacity: isCollapsed ? 0 : 1, 
              width: isCollapsed ? 0 : 'auto',
              transition: 'all 0.2s',
              visibility: isCollapsed ? 'hidden' : 'visible'
            }}>
              {item.name}
            </span>
          </Link>
        ))}
      </nav>
    </aside>
  )
}