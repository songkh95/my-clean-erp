import type { ReactNode } from 'react'
import styles from './ui.module.css'
import { cx } from './cx'

type FilterBarProps = {
  /** 검색, 기간, 구분 입력과 조회 버튼 (왼쪽부터) */
  children: ReactNode
  /** 오른쪽 끝 요약 (예: 총 12건 · 합계 1,234,000원) */
  summary?: ReactNode
  className?: string
}

/** 필터 바: 박스 없이 한 줄, 아래 hairline (DESIGN_SYSTEM.md 6장) */
export default function FilterBar({ children, summary, className }: FilterBarProps) {
  return (
    <div className={cx(styles.filterBar, className)}>
      <div className={styles.filterInputs}>{children}</div>
      {summary ? <div className={styles.filterSummary}>{summary}</div> : null}
    </div>
  )
}
