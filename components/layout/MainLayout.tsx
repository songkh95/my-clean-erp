'use client'

import { useState } from 'react'
import Sidebar from './Sidebar'
import Header from './Header'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  // 사이드바 접힘 상태 관리 (기능 보존)
  const [isCollapsed, setIsCollapsed] = useState(false)

  // 노션 스타일 레이아웃 수치 정의 (기능 보존)
  const sidebarWidth = isCollapsed ? '72px' : '240px'

  return (
    <div style={{ 
      display: 'flex', 
      minHeight: '100vh', 
      backgroundColor: 'var(--notion-bg)' // 색상 계획 적용
    }}>
      {/* 1. 사이드바 (접기/펴기 기능 및 상태 전달) */}
      <Sidebar 
        isCollapsed={isCollapsed} 
        toggleSidebar={() => setIsCollapsed(!isCollapsed)} 
      />

      {/* 2. 오른쪽 메인 영역 (헤더 + 본문) */}
      <div style={{ 
        marginLeft: sidebarWidth, // 사이드바 너비만큼 유동적으로 비켜주기 (기능 보존)
        transition: 'margin-left 0.3s ease', // 부드러운 움직임 보존
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0 
      }}>
        
        {/* 상단 고정 헤더 */}
        <Header />

        {/* 3. 실제 페이지 내용 (본문 영역) */}
        <main style={{
          flex: 1,
          padding: '40px 60px', // 노션 스타일 여백 적용
          backgroundColor: 'var(--notion-bg)',
          overflowY: 'auto'
        }}>
          {/* 중앙 집중형 레이아웃으로 시독성 향상 */}
          <div style={{
            maxWidth: '1400px', 
            margin: '0 auto',
            width: '100%'
          }}>
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}