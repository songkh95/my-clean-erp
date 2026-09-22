'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import Button from './Button'
import styles from './ui.module.css'
import { cx } from './cx'

type ModalProps = {
  open: boolean
  onClose: () => void
  title: ReactNode
  children?: ReactNode
  /** 하단 버튼 (취소 → 주 버튼 순) */
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  /** 배경 클릭과 Esc 로 닫기 (기본 true) */
  dismissible?: boolean
  /** 오른쪽 위 X 버튼 (기본 true) */
  showClose?: boolean
}

/** 모달 (DESIGN_SYSTEM.md 7.5) */
export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  dismissible = true,
  showClose = true,
}: ModalProps) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose })

  useEffect(() => {
    if (!open) return
    const prevFocus = document.activeElement as HTMLElement | null
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // autoFocus 가 있는 요소가 먼저 포커스를 가져가지 않았을 때만 대화상자에 포커스
    if (!dialogRef.current?.contains(document.activeElement)) dialogRef.current?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissible) {
        e.stopPropagation()
        onCloseRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      prevFocus?.focus?.()
    }
  }, [open, dismissible])

  if (!open || typeof document === 'undefined') return null

  const sizeClass = size === 'sm' ? styles.modalSm : size === 'lg' ? styles.modalLg : styles.modalMd

  return createPortal(
    <div
      className={styles.backdrop}
      onMouseDown={(e) => {
        if (dismissible && e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        className={cx(styles.modal, sizeClass)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className={styles.modalHead}>
          <h2 id={titleId} className={styles.modalTitle}>{title}</h2>
          {showClose ? (
            <Button variant="ghost" size="sm" iconOnly aria-label="닫기" onClick={onClose}>
              <X size="1em" strokeWidth={1.5} aria-hidden />
            </Button>
          ) : null}
        </div>
        {children ? <div className={styles.modalBody}>{children}</div> : null}
        {footer ? <div className={styles.modalFoot}>{footer}</div> : null}
      </div>
    </div>,
    document.body,
  )
}
