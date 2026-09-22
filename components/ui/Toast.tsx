'use client'

import { useEffect, useState } from 'react'
import styles from './ui.module.css'
import { cx } from './cx'

type ToastKind = 'info' | 'error'
type ToastItem = { id: number; message: string; kind: ToastKind }

const MAX_TOASTS = 3
const DURATION_MS = 3000

let items: ToastItem[] = []
let nextId = 1
const listeners = new Set<(list: ToastItem[]) => void>()

const emit = () => listeners.forEach((l) => l(items))

function dismiss(id: number) {
  items = items.filter((t) => t.id !== id)
  emit()
}

function push(message: string, kind: ToastKind) {
  const id = nextId++
  items = [...items, { id, message, kind }].slice(-MAX_TOASTS)
  emit()
  setTimeout(() => dismiss(id), DURATION_MS)
}

/**
 * 결과 알림 (브라우저 alert() 대체, DESIGN_SYSTEM.md 7.7).
 * toast('저장했습니다.')  /  toast.error('저장하지 못했습니다.')
 */
export function toast(message: string) {
  push(message, 'info')
}
toast.error = (message: string) => push(message, 'error')

/** 루트 레이아웃에 한 번만 둠 */
export function ToastViewport() {
  const [list, setList] = useState<ToastItem[]>(items)

  useEffect(() => {
    listeners.add(setList)
    return () => { listeners.delete(setList) }
  }, [])

  return (
    <div className={styles.toastViewport} aria-live="polite" role="status">
      {list.map((t) => (
        <div key={t.id} className={cx(styles.toast, t.kind === 'error' && styles.toastError)}>
          {t.message}
        </div>
      ))}
    </div>
  )
}
