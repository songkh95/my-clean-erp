'use client'

import { useState } from 'react'
import Sidebar from './Sidebar'
import Header from './Header' // 🔴 원래 쓰시던 헤더 컴포넌트 불러오기

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  // 사이드바 너비 변수
  const sidebarWidth = isCollapsed ? '70px' : '240px'

  return (
    <div>
      {/* 1. 사이드바 (접기/펴기 기능 포함) */}
      <Sidebar isCollapsed={isCollapsed} toggleSidebar={() => setIsCollapsed(!isCollapsed)} />

      {/* 2. 오른쪽 메인 영역 (헤더 + 본문) */}
      <div style={{ 
        marginLeft: sidebarWidth, // 사이드바 너비만큼 비켜주기
        transition: 'margin-left 0.3s ease', // 부드럽게 움직임
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column'
      }}>
        
        {/* 🔴 여기에 원래 쓰시던 헤더를 넣었습니다! */}
        <Header />

        {/* 3. 실제 페이지 내용 (본문) */}
        <main style={{
          flex: 1,
          backgroundColor: '#fff', // 혹은 원하시는 배경색
          overflowY: 'auto'
        }}>
          {children}
        </main>
      </div>
    </div>
  )
}