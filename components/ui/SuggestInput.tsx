'use client'

import React, { useId, useMemo, useRef, useState } from 'react'
import styles from './ui.module.css'
import { cx } from './cx'
import { rankSuggestions } from '@/utils/suggestMatch'

type Candidate = string | { value: string; hint?: string }

interface SuggestInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label: string
  value: string
  onChange: (value: string) => void
  suggestions?: Candidate[]
  /** 입력값을 변환 (예: 모델명 대문자) */
  transform?: (value: string) => string
  emptyHint?: string
}

export default function SuggestInput({
  label,
  value,
  onChange,
  suggestions = [],
  transform,
  emptyHint,
  style,
  className,
  id,
  onFocus,
  onBlur,
  ...props
}: SuggestInputProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  const [open, setOpen] = useState(false)
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const ranked = useMemo(
    () => rankSuggestions(String(value ?? ''), suggestions, 6),
    [value, suggestions]
  )

  const showList = open && ranked.length > 0

  const apply = (next: string) => {
    onChange(transform ? transform(next) : next)
    setOpen(false)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    onChange(transform ? transform(raw) : raw)
    setOpen(true)
  }

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={inputId}>{label}</label>
      <input
        id={inputId}
        {...props}
        className={cx(styles.control, styles.controlBox, className)}
        style={style}
        value={value ?? ''}
        onChange={handleChange}
        onFocus={(e) => {
          if (blurTimer.current) clearTimeout(blurTimer.current)
          setOpen(true)
          onFocus?.(e)
        }}
        onBlur={(e) => {
          // 클릭으로 선택하려면 blur를 잠깐 늦춤
          blurTimer.current = setTimeout(() => setOpen(false), 150)
          onBlur?.(e)
        }}
        autoComplete="off"
      />

      {showList && (
        <div
          className={styles.dropdown}
          // mousedown으로 blur보다 먼저 선택
          onMouseDown={(e) => e.preventDefault()}
        >
          <div className={styles.dropdownCaption}>기존 데이터와 비슷한 항목 — 클릭하여 선택</div>
          {ranked.map((item) => (
            <button
              key={`${item.value}|${item.hint || ''}`}
              type="button"
              onClick={() => apply(item.value)}
              className={styles.option}
            >
              <span>{item.value}</span>
              {item.hint ? <span className={styles.optionHint}>{item.hint}</span> : null}
            </button>
          ))}
        </div>
      )}

      {!showList && emptyHint && open && String(value || '').trim().length > 0 && ranked.length === 0 ? (
        <div className={styles.hintText}>{emptyHint}</div>
      ) : null}
    </div>
  )
}
