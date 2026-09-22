'use client'

import styles from './ui.module.css'
import { cx } from './cx'

export type TabItem<T extends string> = { id: T; label: string }

type TabsProps<T extends string> = {
  items: TabItem<T>[]
  value: T
  onChange: (id: T) => void
  className?: string
  'aria-label'?: string
}

/** 밑줄형 탭 (DESIGN_SYSTEM.md 6장 5번) */
export default function Tabs<T extends string>({ items, value, onChange, className, ...rest }: TabsProps<T>) {
  return (
    <div className={cx(styles.tabs, className)} role="tablist" aria-label={rest['aria-label']}>
      {items.map((item) => {
        const active = item.id === value
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={cx(styles.tab, active && styles.tabActive)}
            onClick={() => onChange(item.id)}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
