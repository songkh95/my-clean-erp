'use client'

import { usePathname } from 'next/navigation'
import "./globals.css"
import MainLayout from "@/components/layout/MainLayout"
import DisplaySettingsSync from "@/components/layout/DisplaySettingsSync"
import { ConfirmProvider } from "@/components/ui/ConfirmDialog"
import { ToastViewport } from "@/components/ui/Toast"
import { APP_SETTINGS_STORAGE_KEY } from "@/utils/appSettings"
import { BODY_FONTS, HEADING_FONTS, buildDisplayBootScript } from "@/utils/displaySettings"

function isAuthShellPath(pathname: string | null) {
  if (!pathname) return false
  return (
    pathname === '/login' ||
    pathname.startsWith('/login/') ||
    pathname === '/signup' ||
    pathname.startsWith('/auth/')
  )
}

const DISPLAY_BOOT_SCRIPT = buildDisplayBootScript(APP_SETTINGS_STORAGE_KEY)

/** 기본 글꼴은 미리 불러오고, 저장된 화면 설정은 첫 페인트 전에 적용 */
function DisplayHead() {
  return (
    <head>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="" />
      <link rel="stylesheet" href={HEADING_FONTS[0].href} data-font-id={HEADING_FONTS[0].id} />
      <link rel="stylesheet" href={BODY_FONTS[0].href} data-font-id={BODY_FONTS[0].id} />
      <script dangerouslySetInnerHTML={{ __html: DISPLAY_BOOT_SCRIPT }} />
    </head>
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
      <html lang="ko" suppressHydrationWarning>
        <DisplayHead />
        <body>
          <DisplaySettingsSync />
          <ConfirmProvider>
            {children}
          </ConfirmProvider>
          <ToastViewport />
        </body>
      </html>
    )
  }

  return (
    <html lang="ko" suppressHydrationWarning>
      <DisplayHead />
      <body>
        <DisplaySettingsSync />
        <ConfirmProvider>
          <MainLayout>
            {children}
          </MainLayout>
        </ConfirmProvider>
        <ToastViewport />
      </body>
    </html>
  )
}
