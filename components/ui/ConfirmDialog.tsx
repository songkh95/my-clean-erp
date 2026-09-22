'use client'

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import Modal from './Modal'
import Button from './Button'
import styles from './ui.module.css'

export type ConfirmOptions = {
  title: string
  description?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** 삭제처럼 되돌릴 수 없는 동작: 확인 버튼이 danger */
  danger?: boolean
  /** 확인 버튼만 표시 (꼭 읽어야 하는 오류 안내용) */
  alertOnly?: boolean
}

type ConfirmFn = (options: ConfirmOptions | string) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

/**
 * 브라우저 confirm() 대체 (DESIGN_SYSTEM.md 7.7).
 * const confirm = useConfirm()
 * if (!(await confirm({ title: '삭제할까요?', danger: true }))) return
 */
export function useConfirm(): ConfirmFn {
  const fn = useContext(ConfirmContext)
  if (!fn) throw new Error('useConfirm 은 ConfirmProvider 안에서만 쓸 수 있습니다.')
  return fn
}

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void }

/** 루트 레이아웃에 한 번만 둠 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null)
  const pendingRef = useRef<Pending | null>(null)

  const confirm = useCallback<ConfirmFn>((options) => {
    const opts = typeof options === 'string' ? { title: options } : options
    // 이미 열린 확인창이 있으면 취소로 닫고 새 요청을 띄움
    pendingRef.current?.resolve(false)
    return new Promise<boolean>((resolve) => {
      const next = { ...opts, resolve }
      pendingRef.current = next
      setPending(next)
    })
  }, [])

  const settle = useCallback((ok: boolean) => {
    pendingRef.current?.resolve(ok)
    pendingRef.current = null
    setPending(null)
  }, [])

  const cancel = useCallback(() => settle(false), [settle])

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={pending !== null}
        onClose={cancel}
        title={pending?.title ?? ''}
        size="sm"
        showClose={false}
        footer={
          <>
            {!pending?.alertOnly ? (
              <Button variant="danger" onClick={cancel}>
                {pending?.cancelLabel ?? '취소'}
              </Button>
            ) : null}
            <Button variant={pending?.danger ? 'danger' : 'primary'} onClick={() => settle(true)} autoFocus>
              {pending?.confirmLabel ?? '확인'}
            </Button>
          </>
        }
      >
        {pending?.description ? <p className={styles.confirmText}>{pending.description}</p> : null}
      </Modal>
    </ConfirmContext.Provider>
  )
}
