'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type SidebarProps = {
  isCollapsed: boolean;
  toggleSidebar: () => void;
}

export default function Sidebar({ isCollapsed, toggleSidebar }: SidebarProps) {
  const pathname = usePathname()

  // 🎨 [디자인] 새로운 컬러 시스템 적용
  const getNavStyle = (path: string) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: isCollapsed ? 'center' : 'flex-start',
    padding: isCollapsed ? '12px 0' : '12px 20px',
    borderRadius: '8px',
    marginBottom: '8px',
    textDecoration: 'none',
    fontSize: '0.95rem',
    fontWeight: '600', // 폰트 두께 상향
    transition: 'all 0.2s',
    // 활성화: Accent Blue / 비활성: Transparent
    backgroundColor: pathname.startsWith(path) && path !== '/' || pathname === path 
      ? '#0070f3' 
      : 'transparent',
    // 활성화: White / 비활성: Deep Gray
    color: pathname.startsWith(path) && path !== '/' || pathname === path 
      ? '#FFFFFF' 
      : '#666666',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    height: '45px',
    boxSizing: 'border-box' as const
  })

  const navItems = [
    { name: '홈 (대시보드)', path: '/', icon: '🏠' },
    { name: '거래처 관리', path: '/clients', icon: '👥' },
    { name: '자산 및 재고', path: '/inventory', icon: '📦' },
    { name: '정산 및 회계', path: '/accounting', icon: '💰' },
  ]

  return (
    <aside style={{
      width: isCollapsed ? '70px' : '240px',
      height: '100vh',
      borderRight: '1px solid #E5E5E5', // Soft Gray
      padding: '20px 12px',
      backgroundColor: '#FFFFFF', // White
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
        marginBottom: '40px',
        padding: '0 5px',
        height: '40px'
      }}>
        {!isCollapsed && (
          <h2 style={{ fontSize: '1.3rem', margin: 0, whiteSpace: 'nowrap', fontWeight:'800', color:'#171717' }}>
            🧼 ERP
          </h2>
        )}
        
        <button 
          onClick={toggleSidebar}
          style={{
            background: 'none',
            border: '1px solid #E5E5E5',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '1rem',
            color: '#171717',
            padding: '4px 8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {isCollapsed ? '☰' : '◀'}
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