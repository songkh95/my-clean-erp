import type { ReactNode } from 'react'
import styles from './ui.module.css'
import { cx } from './cx'

export type BadgeTone = 'success' | 'warning' | 'danger' | 'neutral'

type BadgeProps = {
  tone?: BadgeTone
  children: ReactNode
  className?: string
}

/** 상태 배지: 6px 점 + 글자, 배경 없음 (DESIGN_SYSTEM.md 7.4) */
export default function Badge({ tone = 'neutral', children, className }: BadgeProps) {
  return (
    <span className={cx(styles.badge, className)} data-tone={tone}>
      <span className={styles.badgeDot} aria-hidden />
      {children}
    </span>
  )
}
