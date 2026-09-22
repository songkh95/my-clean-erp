'use client'

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
  ...props
}: ButtonProps) {
  return (
    <button
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
