'use client'

import React, { useMemo, useRef, useState } from 'react'

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
    <div style={{ marginBottom: '16px', position: 'relative', ...style }}>
      <label style={{
        display: 'block', marginBottom: '4px', fontSize: '0.75rem',
        fontWeight: 500, color: 'var(--notion-sub-text)',
      }}>
        {label}
      </label>
      <input
        value={displayValue}
        onChange={(e) => { setDraft(e.target.value); setOpen(true) }}
        onFocus={(e) => {
          if (blurTimer.current) clearTimeout(blurTimer.current)
          setOpen(true)
          e.currentTarget.style.boxShadow = '0 0 0 2px var(--notion-blue-light)'
        }}
        onBlur={(e) => {
          e.currentTarget.style.boxShadow = 'none'
          // 클릭으로 선택하려면 blur를 잠깐 늦춤. 선택 없이 벗어나면 원래 값으로 복귀.
          blurTimer.current = setTimeout(() => {
            setDraft(null)
            setOpen(false)
          }, 150)
        }}
        placeholder={placeholder}
        autoComplete="off"
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
        }}
      />

      {open && (
        <div
          style={{
            marginTop: 6,
            border: '1px solid var(--notion-border)',
            borderRadius: 'var(--radius-sm)',
            background: '#fff',
            overflow: 'hidden',
            maxHeight: 220,
            overflowY: 'auto',
            position: 'absolute',
            width: '100%',
            zIndex: 20,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          }}
          // mousedown으로 blur보다 먼저 선택 처리
          onMouseDown={(e) => e.preventDefault()}
        >
          <button
            type="button"
            onClick={() => commit(null)}
            style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: '8px 10px', border: 'none', borderBottom: '1px solid #f0f0f0',
              background: value === '' ? 'var(--notion-blue-light)' : 'transparent',
              cursor: 'pointer', fontSize: '0.85rem', color: 'var(--notion-sub-text)',
            }}
          >
            {emptyOptionLabel}
          </button>
          {filtered.length === 0 ? (
            <div style={{ padding: '10px 12px', fontSize: '0.8rem', color: 'var(--notion-sub-text)' }}>
              일치하는 항목이 없습니다.
            </div>
          ) : (
            filtered.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => commit(opt)}
                style={{
                  display: 'flex', width: '100%', textAlign: 'left',
                  justifyContent: 'space-between', gap: 8,
                  padding: '8px 10px', border: 'none', borderBottom: '1px solid #f0f0f0',
                  background: opt.id === value ? 'var(--notion-blue-light)' : 'transparent',
                  cursor: 'pointer', fontSize: '0.85rem', color: 'var(--notion-main-text)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--notion-blue-light)' }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = opt.id === value ? 'var(--notion-blue-light)' : 'transparent'
                }}
              >
                <span style={{ fontWeight: 600 }}>{opt.label}</span>
                {opt.hint ? (
                  <span style={{ color: 'var(--notion-sub-text)', fontSize: '0.75rem', flexShrink: 0 }}>
                    {opt.hint}
                  </span>
                ) : null}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
