'use client'

import { useRef, type ReactNode } from 'react'
import styles from '@/app/service/service.module.css'

interface Props {
  width: number
  minWidth?: number
  onResize: (next: number) => void
  className?: string
  children: ReactNode
}

/** 헤더 오른쪽 세로바 드래그로 열 너비 조절 */
export default function ResizableTh({
  width,
  minWidth = 36,
  onResize,
  className = '',
  children,
}: Props) {
  const startX = useRef(0)
  const startW = useRef(0)

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    startX.current = e.clientX
    startW.current = width

    const onMove = (ev: MouseEvent) => {
      onResize(Math.max(minWidth, startW.current + (ev.clientX - startX.current)))
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  return (
    <th className={className} style={{ width, minWidth, maxWidth: width }}>
      <div className={styles.thInner}>
        {children}
        <span
          className={styles.colResize}
          onMouseDown={onMouseDown}
          title="드래그하여 열 너비 조절"
        />
      </div>
    </th>
  )
}
