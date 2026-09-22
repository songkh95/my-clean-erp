import type { TableHTMLAttributes } from 'react'
import styles from './ui.module.css'
import { cx } from './cx'

/**
 * 표 (DESIGN_SYSTEM.md 7.3). 가로 스크롤 래퍼 포함.
 * 셀 클래스: `num` (숫자, 오른쪽 + tabular-nums), `center` (날짜, 배지, 체크박스), `unit` (단위 글자)
 * 행 클래스: `total` (합계 행)
 */
export default function Table({ className, children, ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className={styles.tableScroll}>
      <table className={cx(styles.table, className)} {...props}>
        {children}
      </table>
    </div>
  )
}
