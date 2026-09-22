'use client'

import React, { useId, useMemo, useRef, useState } from 'react'
import styles from './ui.module.css'
import { cx } from './cx'

export interface ComboOption {
  id: string
  label: string
  hint?: string
}

interface ComboBoxSelectProps {
  label: string
  /** 선택된 옵션의 id ('' = 선택 없음) */
  value: string
  onChange: (id: string) => void
  options: ComboOption[]
  placeholder?: string
  /** 목록 맨 위 "선택 해제" 항목 문구 */
  emptyOptionLabel?: string
  style?: React.CSSProperties
}

/** 드롭박스 대신 텍스트로 검색해서 부분일치 항목을 클릭 선택하는 콤보박스 */
export default function ComboBoxSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
  emptyOptionLabel = '(선택 안 함)',
  style,
}: ComboBoxSelectProps) {
  const inputId = useId()
  const selected = useMemo(() => options.find((o) => o.id === value) || null, [options, value])
  // null = 편집 중이 아님 → 선택된 항목의 이름을 그대로 보여줌
  // string = 사용자가 입력 중인 검색어
  const [draft, setDraft] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const displayValue = draft ?? selected?.label ?? ''

  const filtered = useMemo(() => {
    const q = (draft ?? '').trim().toLowerCase()
    if (!q) return options.slice(0, 8)
    return options.filter((o) => o.label.toLowerCase().includes(q)).slice(0, 8)
  }, [options, draft])

  const commit = (opt: ComboOption | null) => {
    onChange(opt ? opt.id : '')
    setDraft(null)
    setOpen(false)
  }

  return (
    <div className={styles.field} style={style}>
      <label className={styles.label} htmlFor={inputId}>{label}</label>
      <input
        id={inputId}
        className={cx(styles.control, styles.controlBox)}
        value={displayValue}
        onChange={(e) => { setDraft(e.target.value); setOpen(true) }}
        onFocus={() => {
          if (blurTimer.current) clearTimeout(blurTimer.current)
          setOpen(true)
        }}
        onBlur={() => {
          // 클릭으로 선택하려면 blur를 잠깐 늦춤. 선택 없이 벗어나면 원래 값으로 복귀.
          blurTimer.current = setTimeout(() => {
            setDraft(null)
            setOpen(false)
          }, 150)
        }}
        placeholder={placeholder}
        autoComplete="off"
      />

      {open && (
        <div
          className={cx(styles.dropdown, styles.dropdownFloat)}
          // mousedown으로 blur보다 먼저 선택 처리
          onMouseDown={(e) => e.preventDefault()}
        >
          <button
            type="button"
            onClick={() => commit(null)}
            className={cx(styles.option, styles.optionMuted, value === '' && styles.optionSelected)}
          >
            {emptyOptionLabel}
          </button>
          {filtered.length === 0 ? (
            <div className={styles.optionEmpty}>일치하는 항목이 없습니다.</div>
          ) : (
            filtered.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => commit(opt)}
                className={cx(styles.option, opt.id === value && styles.optionSelected)}
              >
                <span>{opt.label}</span>
                {opt.hint ? <span className={styles.optionHint}>{opt.hint}</span> : null}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
