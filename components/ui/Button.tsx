'use client'

import { useEffect, useRef, useState } from 'react'
import styles from './ui.module.css'
import { cx } from './cx'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary = 일반, danger = 취소·삭제, secondary = 보조. outline 은 secondary 의 이전 이름, ghost 는 아이콘 전용 */
  variant?: ButtonVariant
  /** sm 은 iconOnly 버튼에만 적용됨. 글자 버튼은 항상 기본 크기 */
  size?: 'sm' | 'md'
  /** 아이콘만 있는 버튼 (정사각형). aria-label 필수 */
  iconOnly?: boolean
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: styles.btnPrimary,
  secondary: styles.btnSecondary,
  outline: styles.btnSecondary,
  ghost: styles.btnGhost,
  danger: styles.btnDanger,
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  iconOnly = false,
  className,
  onClick,
  ...props
}: ButtonProps) {
  // 처리가 끝나기 전에 또 눌러도 한 번만 실행한다 (알림이 여러 번 뜨던 문제)
  const busyRef = useRef(false)
  const mountedRef = useRef(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => () => { mountedRef.current = false }, [])

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (busyRef.current) {
      e.preventDefault()
      return
    }
    const result = onClick?.(e) as unknown
    if (result && typeof (result as Promise<unknown>).then === 'function') {
      busyRef.current = true
      setBusy(true)
      void (result as Promise<unknown>).finally(() => {
        busyRef.current = false
        if (mountedRef.current) setBusy(false)
      })
    }
  }

  return (
    <button
      onClick={handleClick}
      aria-busy={busy || undefined}
      className={cx(
        styles.btn,
        // 글자 버튼은 크기 한 가지 (DESIGN_SYSTEM.md 7.1). sm 은 아이콘만 있는 버튼에만 적용
        size === 'sm' && iconOnly ? styles.btnSm : styles.btnMd,
        // 버튼 색은 세 가지만: 글자가 있는 ghost 는 secondary 로 그림 (DESIGN_SYSTEM.md 7.1)
        variant === 'ghost' && !iconOnly ? styles.btnSecondary : VARIANT_CLASS[variant],
        iconOnly && styles.btnIconOnly,
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
