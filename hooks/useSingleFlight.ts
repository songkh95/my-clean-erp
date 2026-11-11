'use client'

import { useCallback, useRef } from 'react'

/**
 * 같은 동작이 끝나기 전에 다시 눌러도 한 번만 실행한다.
 *
 * 서버 응답이 늦을 때 사용자가 버튼을 여러 번 누르면 알림이 그만큼 쌓이던 문제를 막는다.
 * 무시된 클릭은 아무 일도 일어나지 않는다 (경고를 띄우지 않음).
 *
 *   const run = useSingleFlight()
 *   const handleDelete = (id: string) => run(`delete:${id}`, async () => { ... })
 */
export function useSingleFlight() {
  const inFlight = useRef<Set<string>>(new Set())

  return useCallback(async <T>(key: string, fn: () => Promise<T> | T): Promise<T | undefined> => {
    if (inFlight.current.has(key)) return undefined
    inFlight.current.add(key)
    try {
      return await fn()
    } finally {
      inFlight.current.delete(key)
    }
  }, [])
}
