'use client'

import { useState, type CSSProperties, type MouseEvent } from 'react'

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
    <button
      type="button"
      className={className}
      title={title}
      aria-label={label}
      disabled={busy}
      onClick={handleClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '0 10px',
        height: 30,
        borderRadius: 4,
        border: '1px solid #d1d5db',
        background: '#fff',
        color: '#374151',
        fontSize: '0.78rem',
        fontWeight: 600,
        cursor: busy ? 'wait' : 'pointer',
        opacity: busy ? 0.7 : 1,
        whiteSpace: 'nowrap',
        flexShrink: 0,
        ...style,
      }}
    >
      <span aria-hidden style={{ fontSize: '0.9rem', lineHeight: 1 }}>
        {busy ? '…' : '↻'}
      </span>
      {busy ? '불러오는 중' : label}
    </button>
  )
}
