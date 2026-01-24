'use client' // 1. 주소를 확인하기 위해 클라이언트 컴포넌트로 바꿉니다.

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import { usePathname } from 'next/navigation'
import MainLayout from "@/components/MainLayout";


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
        {/* 🔴 이제 모든 페이지는 MainLayout의 보호를 받습니다 */}
        <MainLayout>
          {children}
        </MainLayout>
      </body>
    </html>
  );
}

/** [ RootLayout (app/layout.tsx) ]
      ⬇️
[ MainLayout (사이드바 + 여백 조절 기능) ]
      ⬇️
-----------------------------------
|  여기에 들어가는 페이지들 (children) |
-----------------------------------
   1. 🏠 홈 (app/page.tsx)
   2. 👥 거래처 관리 (app/clients/page.tsx)
   3. 📦 자산 및 재고 (app/inventory/page.tsx)
   4. 🔧 (미래에 만들) 설정, A/S 관리 등... */