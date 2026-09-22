import type { ReactNode } from 'react'
import styles from './ui.module.css'
import { cx } from './cx'

type PageHeaderProps = {
  title: ReactNode
  description?: ReactNode
  /** 오른쪽 끝 동작 버튼. 주 버튼은 1개만 */
  actions?: ReactNode
  className?: string
}

/** 페이지 헤더: 제목(h1) 왼쪽, 동작 버튼 오른쪽 (DESIGN_SYSTEM.md 6장) */
export default function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <header className={cx(styles.pageHeader, className)}>
      <div className={styles.pageHeaderText}>
        <h1 className={styles.pageTitle}>{title}</h1>
        {description ? <p className={styles.pageDescription}>{description}</p> : null}
      </div>
      {actions ? <div className={styles.pageActions}>{actions}</div> : null}
    </header>
  )
}
