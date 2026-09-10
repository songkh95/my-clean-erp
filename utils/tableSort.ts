// utils/tableSort.ts
// 표 헤더 클릭 정렬용 공용 훅. 헤더를 누르면 오름차순 → 내림차순 → (다시 누르면) 기본 정렬로 순환한다.
'use client'

import { useMemo, useState } from 'react'

export type SortDirection = 'asc' | 'desc'
export type SortState<K extends string> = { key: K; direction: SortDirection } | null

export function useSortableData<T, K extends string>(
  items: T[],
  getValue: (item: T, key: K) => string | number | null | undefined
) {
  const [sortState, setSortState] = useState<SortState<K>>(null)

  const sortedItems = useMemo(() => {
    if (!sortState) return items
    const { key, direction } = sortState
    const dir = direction === 'asc' ? 1 : -1
    return [...items].sort((a, b) => {
      const va = getValue(a, key)
      const vb = getValue(b, key)
      const aEmpty = va === null || va === undefined || va === ''
      const bEmpty = vb === null || vb === undefined || vb === ''
      if (aEmpty && bEmpty) return 0
      if (aEmpty) return 1 // 빈 값은 정렬 방향과 무관하게 항상 뒤로
      if (bEmpty) return -1
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir
      return String(va).localeCompare(String(vb), 'ko') * dir
    })
    // getValue는 매 렌더마다 새로 만들어지는 인라인 함수로 넘기는 경우가 많아 deps에서 제외
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, sortState])

  /** 헤더 클릭 핸들러: 오름차순 → 내림차순 → 기본 정렬 순으로 순환 */
  const requestSort = (key: K) => {
    setSortState((prev) => {
      if (!prev || prev.key !== key) return { key, direction: 'asc' }
      if (prev.direction === 'asc') return { key, direction: 'desc' }
      return null
    })
  }

  /** 헤더에 붙일 화살표 표시 (정렬 중인 컬럼만) */
  const sortIndicator = (key: K) => {
    if (!sortState || sortState.key !== key) return ''
    return sortState.direction === 'asc' ? ' ▲' : ' ▼'
  }

  return { sortedItems, sortState, requestSort, sortIndicator }
}
