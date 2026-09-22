import type { ReactNode } from 'react'
import styles from './ui.module.css'
import { cx } from './cx'

/** 빈 상태: 가운데 한 줄 흐린 글자 (DESIGN_SYSTEM.md 7.6) */
export default function EmptyState({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx(styles.empty, className)}>{children}</div>
}
