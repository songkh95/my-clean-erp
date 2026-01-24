'use client' // 1. 주소를 확인하기 위해 클라이언트 컴포넌트로 바꿉니다.

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import { usePathname } from 'next/navigation'




export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname() // 3. 현재 주소 가져오기 (예: '/', '/login', '/clients')

  // 4. 만약 현재 주소가 '/login' 이라면?
  // 사이드바와 헤더 없이 알맹이(로그인 박스)만 보여줍니다.
  if (pathname === '/login') {
    return (
      <html lang="ko">
        <body>{children}</body>
      </html>
    )
  }

  // 5. 로그인 페이지가 아닐 때만 기존의 레이아웃(사이드바+헤더)을 보여줍니다.
  return (
    <html lang="ko">
      <body>
        <div style={{ display: 'flex' }}>
          <Sidebar />

          <div style={{ flex: 1, marginLeft: '240px', display: 'flex', flexDirection: 'column' }}>
            <Header />
            
            <main style={{ flex: 1, backgroundColor: '#fff' }}>
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  )
}