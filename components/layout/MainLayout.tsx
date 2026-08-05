'use client'

import { useState } from 'react'
import Sidebar from './Sidebar'
import Header from './Header'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  const sidebarWidth = isCollapsed
    ? 'var(--sidebar-collapsed)'
    : 'var(--sidebar-width)'

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      backgroundColor: 'var(--notion-bg)'
    }}>
      <Sidebar
        isCollapsed={isCollapsed}
        toggleSidebar={() => setIsCollapsed(!isCollapsed)}
      />

      <div style={{
        marginLeft: sidebarWidth,
        transition: 'margin-left 0.3s ease',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0
      }}>
        <Header />

        <main style={{
          flex: 1,
          padding: 'var(--main-pad-top) var(--main-pad-right) var(--main-pad-bottom) var(--main-pad-left)',
          backgroundColor: 'var(--notion-bg)',
          overflowY: 'auto',
          overflowX: 'hidden'
        }}>
          <div className="pageShell">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
