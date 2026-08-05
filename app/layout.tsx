'use client'

import { usePathname } from 'next/navigation'
import "./globals.css"
import MainLayout from "@/components/layout/MainLayout"

function isAuthShellPath(pathname: string | null) {
  if (!pathname) return false
  return (
    pathname === '/login' ||
    pathname.startsWith('/login/') ||
    pathname === '/signup' ||
    pathname.startsWith('/auth/')
  )
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  if (isAuthShellPath(pathname)) {
    return (
      <html lang="ko">
        <body>{children}</body>
      </html>
    )
  }

  return (
    <html lang="ko">
      <body>
        <MainLayout>
          {children}
        </MainLayout>
      </body>
    </html>
  )
}
