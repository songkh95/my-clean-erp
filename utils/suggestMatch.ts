/** 입력값과 기존 목록에서 가까운 후보를 고름 */

export function normalizeForCompare(s: string): string {
  return (s || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

/** 레벤슈타인 거리 (짧은 문자열용) */
function editDistance(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 0; i < a.length; i++) {
    let prev = i
    for (let j = 0; j < b.length; j++) {
      const cur = row[j + 1]
      const cost = a[i] === b[j] ? 0 : 1
      row[j + 1] = Math.min(row[j + 1] + 1, row[j] + 1, prev + cost)
      prev = cur
    }
  }
  return row[b.length]
}

export type SuggestItem = {
  value: string
  /** 보조 표시 (예: S/N, 주소) */
  hint?: string
  score: number
}

/**
 * query에 가까운 후보를 score 높은 순으로 반환
 * - 완전 일치 / 시작 일치 / 포함 / 편집거리 순
 */
export function rankSuggestions(
  query: string,
  candidates: Array<string | { value: string; hint?: string }>,
  limit = 5
): SuggestItem[] {
  const q = normalizeForCompare(query)
  if (!q || q.length < 1) return []

  const seen = new Set<string>()
  const scored: SuggestItem[] = []

  for (const raw of candidates) {
    const value = typeof raw === 'string' ? raw : raw.value
    const hint = typeof raw === 'string' ? undefined : raw.hint
    const trimmed = (value || '').trim()
    if (!trimmed) continue
    const key = normalizeForCompare(trimmed)
    if (seen.has(key)) continue
    // 입력과 완전 동일하면 제안 불필요
    if (key === q) continue
    seen.add(key)

    let score = 0
    if (key.startsWith(q)) score = 1000 - (key.length - q.length)
    else if (key.includes(q)) score = 700 - key.indexOf(q)
    else {
      const dist = editDistance(q, key.slice(0, Math.max(q.length + 2, 12)))
      if (dist > Math.max(3, Math.floor(q.length * 0.6))) continue
      score = 400 - dist * 40
    }
    if (score <= 0) continue
    scored.push({ value: trimmed, hint, score })
  }

  return scored
    .sort((a, b) => b.score - a.score || a.value.localeCompare(b.value, 'ko'))
    .slice(0, limit)
}

/** 기계 모델명: 영어 대문자·숫자·일부 기호만 허용 */
export function toMachineModelName(input: string): string {
  return (input || '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s\-_./]/g, '')
    .replace(/\s+/g, ' ')
}
