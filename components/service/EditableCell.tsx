'use client'

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import styles from '@/app/service/service.module.css'

type SelectOption = { value: string; label: string }

interface EditableCellProps {
  value: string
  display?: ReactNode
  type?: 'text' | 'date' | 'select' | 'textarea'
  options?: SelectOption[]
  disabled?: boolean
  /** 긴 텍스트: 평소 말줄임, 호버 시 전체 표시 */
  clamp?: boolean
  className?: string
  title?: string
  onBeforeEdit?: () => Promise<void> | void
  onSave: (next: string) => Promise<void> | void
}

export default function EditableCell({
  value,
  display,
  type = 'text',
  options = [],
  disabled = false,
  clamp = false,
  className = '',
  title,
  onBeforeEdit,
  onSave,
}: EditableCellProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(null)
  const closedRef = useRef(false)

  useEffect(() => {
    if (!editing) setDraft(value)
  }, [value, editing])

  useEffect(() => {
    if (!editing || !inputRef.current) return
    inputRef.current.focus()
    if (inputRef.current instanceof HTMLInputElement) {
      inputRef.current.select()
    }
    if (inputRef.current instanceof HTMLTextAreaElement) {
      autoGrow(inputRef.current)
    }
  }, [editing])

  const autoGrow = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto'
    el.style.height = `${Math.max(el.scrollHeight, 48)}px`
  }

  const startEdit = async () => {
    if (disabled || saving) return
    if (onBeforeEdit) await onBeforeEdit()
    closedRef.current = false
    setDraft(value)
    setEditing(true)
  }

  const commit = async (next = draft) => {
    if (closedRef.current || saving) return
    closedRef.current = true
    setEditing(false)
    if (next === value) return
    setSaving(true)
    try {
      await onSave(next)
    } finally {
      setSaving(false)
    }
  }

  const cancel = () => {
    closedRef.current = true
    setDraft(value)
    setEditing(false)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && type !== 'textarea') {
      e.preventDefault()
      commit()
    } else if (e.key === 'Enter' && type === 'textarea' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      commit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancel()
    }
  }

  if (editing) {
    return (
      <td className={`${styles.td} ${styles.tdEditing} ${className}`}>
        {type === 'select' ? (
          <select
            ref={inputRef as React.RefObject<HTMLSelectElement>}
            className={styles.cellInput}
            value={draft}
            onChange={(e) => commit(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={() => commit()}
          >
            {options.map((opt) => (
              <option key={opt.value || '__empty'} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        ) : type === 'textarea' ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            className={`${styles.cellInput} ${styles.cellTextarea}`}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              autoGrow(e.target)
            }}
            onKeyDown={onKeyDown}
            onBlur={() => commit()}
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            className={styles.cellInput}
            type={type}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={() => commit()}
          />
        )}
      </td>
    )
  }

  const content = display ?? (value || <span className={styles.emptyCell}>-</span>)
  const fullText = typeof value === 'string' ? value : undefined

  return (
    <td
      className={`${styles.td} ${disabled ? styles.tdReadonly : styles.tdEditable} ${clamp ? styles.tdClamp : ''} ${className}`}
      onClick={startEdit}
      title={disabled ? fullText : (title ?? fullText ?? '클릭하여 수정')}
    >
      {saving ? (
        <span className={styles.savingDot}>저장중…</span>
      ) : clamp ? (
        <div className={styles.clampInner} data-full={fullText || ''}>
          {content}
        </div>
      ) : (
        content
      )}
    </td>
  )
}
