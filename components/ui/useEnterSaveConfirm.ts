'use client'

import type { KeyboardEvent } from 'react'
import { useConfirm } from './ConfirmDialog'

type Options = {
  /** 확인창 제목 (기본: 저장하시겠습니까?) */
  title?: string
  description?: string
  confirmLabel?: string
}

/**
 * 팝업 폼에서 Enter 를 눌렀을 때 바로 저장되지 않게 하고,
 * 화면 가운데 확인창으로 한 번 묻는다 (DESIGN_SYSTEM.md 7.7).
 *
 * <form onSubmit={handleSubmit} onKeyDown={useEnterSaveConfirm()}>
 *
 * - 여러 줄 입력(textarea)과 버튼 위에서는 Enter 가 원래대로 동작한다.
 * - 자동완성 목록 선택처럼 입력칸이 이미 Enter 를 처리한 경우에는 끼어들지 않는다.
 */
export function useEnterSaveConfirm(save?: (() => void) | null, options: Options = {}) {
  const confirm = useConfirm()

  return async (e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'Enter' || e.defaultPrevented) return
    if (e.nativeEvent.isComposing) return // 한글 조합 중 Enter
    if (e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return

    const target = e.target as HTMLElement | null
    if (!target) return
    // 확인창을 기다리는 동안 currentTarget 이 사라지므로 먼저 잡아 둔다
    const form = target.closest('form')
    const tag = target.tagName
    if (tag === 'TEXTAREA' || tag === 'BUTTON' || target.isContentEditable) return
    if (tag === 'INPUT' && (target as HTMLInputElement).type === 'submit') return

    e.preventDefault()
    e.stopPropagation()

    const ok = await confirm({
      title: options.title ?? '저장하시겠습니까?',
      description: options.description,
      confirmLabel: options.confirmLabel ?? '저장',
    })
    if (ok) {
      if (save) save()
      else form?.requestSubmit()
    }
  }
}
