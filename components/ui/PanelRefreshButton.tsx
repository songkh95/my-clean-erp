'use client'

import { useState, type CSSProperties, type MouseEvent } from 'react'
import { RefreshCw } from 'lucide-react'
import Button from './Button'

type Props = {
  onRefresh: () => void | Promise<void>
  label?: string
  title?: string
  className?: string
  style?: CSSProperties
}

/** 페이지 전체 새로고침 대신 해당 목록/패널만 다시 불러오기 */
export default function PanelRefreshButton({
  onRefresh,
  label = '새로고침',
  title = '이 목록만 다시 불러옵니다 (페이지는 유지)',
  className,
  style,
}: Props) {
  const [busy, setBusy] = useState(false)

  const handleClick = async (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (busy) return
    setBusy(true)
    try {
      await onRefresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      className={className}
      style={style}
      title={title}
      aria-label={label}
      aria-busy={busy}
      disabled={busy}
      onClick={handleClick}
    >
      <RefreshCw size="1em" strokeWidth={1.5} aria-hidden />
      {busy ? '불러오는 중…' : label}
    </Button>
  )
}
