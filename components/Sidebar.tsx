'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Sidebar() {
  const pathname = usePathname()

  // 메뉴 스타일 (현재 페이지일 때 색상을 다르게 표시)
  const linkStyle = (path: string) => ({
    display: 'block',
    padding: '12px 20px',
    textDecoration: 'none',
    color: pathname === path ? '#0070f3' : '#333',
    backgroundColor: pathname === path ? '#e6f0ff' : 'transparent',
    fontWeight: pathname === path ? 'bold' : 'normal',
    borderRadius: '8px',
    marginBottom: '5px'
  })

  return (
    <aside style={{
      width: '240px',
      height: '100vh',
      borderRight: '1px solid #ddd',
      padding: '20px',
      backgroundColor: '#fcfcfc',
      position: 'fixed', // 화면에 고정
      left: 0,
      top: 0
    }}>
      <h2 style={{ fontSize: '1.2rem', marginBottom: '30px' }}>🧼 My Clean ERP</h2>
      
      <nav>
        <Link href="/" style={linkStyle('/')}>
          🏠 홈 (대시보드)
        </Link>
        <Link href="/clients" style={linkStyle('/clients')}>
          👥 거래처 관리
        </Link>
      </nav>
    </aside>
  )
}