'use client'

import React, { useMemo, useRef, useState } from 'react'
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
  onFocus,
  onBlur,
  ...props
}: SuggestInputProps) {
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
    <div style={{ marginBottom: '16px', position: 'relative' }}>
      <label style={{
        display: 'block', marginBottom: '4px', fontSize: '0.75rem',
        fontWeight: 500, color: 'var(--notion-sub-text)',
      }}>
        {label}
      </label>
      <input
        {...props}
        value={value ?? ''}
        onChange={handleChange}
        onFocus={(e) => {
          if (blurTimer.current) clearTimeout(blurTimer.current)
          setOpen(true)
          e.currentTarget.style.boxShadow = '0 0 0 2px var(--notion-blue-light)'
          onFocus?.(e)
        }}
        onBlur={(e) => {
          e.currentTarget.style.boxShadow = 'none'
          // 클릭으로 선택하려면 blur를 잠깐 늦춤
          blurTimer.current = setTimeout(() => setOpen(false), 150)
          onBlur?.(e)
        }}
        style={{
          width: '100%',
          padding: '8px 10px',
          border: '1px solid var(--notion-border)',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.9rem',
          outline: 'none',
          backgroundColor: 'var(--notion-bg)',
          color: 'var(--notion-main-text)',
          boxSizing: 'border-box',
          ...style,
        }}
        autoComplete="off"
      />

      {showList && (
        <div
          style={{
            marginTop: 6,
            border: '1px solid var(--notion-border)',
            borderRadius: 'var(--radius-sm)',
            background: '#fff',
            overflow: 'hidden',
          }}
          // mousedown으로 blur보다 먼저 선택
          onMouseDown={(e) => e.preventDefault()}
        >
          <div style={{
            padding: '4px 10px', fontSize: '0.7rem', color: 'var(--notion-sub-text)',
            background: 'var(--notion-soft-bg)', borderBottom: '1px solid var(--notion-border)',
          }}>
            기존 데이터와 비슷한 항목 — 클릭하여 선택
          </div>
          {ranked.map((item) => (
            <button
              key={`${item.value}|${item.hint || ''}`}
              type="button"
              onClick={() => apply(item.value)}
              style={{
                display: 'flex', width: '100%', textAlign: 'left',
                justifyContent: 'space-between', gap: 8,
                padding: '8px 10px', border: 'none', borderBottom: '1px solid #f0f0f0',
                background: 'transparent', cursor: 'pointer', fontSize: '0.85rem',
                color: 'var(--notion-main-text)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--notion-blue-light)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ fontWeight: 600 }}>{item.value}</span>
              {item.hint ? (
                <span style={{ color: 'var(--notion-sub-text)', fontSize: '0.75rem', flexShrink: 0 }}>
                  {item.hint}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      )}

      {!showList && emptyHint && open && String(value || '').trim().length > 0 && ranked.length === 0 ? (
        <div style={{ marginTop: 4, fontSize: '0.72rem', color: 'var(--notion-sub-text)' }}>
          {emptyHint}
        </div>
      ) : null}
    </div>
  )
}
