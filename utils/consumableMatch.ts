/** 토너/드럼 KCMY · 재생 소모품 매칭 */

export type TonerDrumColor = 'K' | 'C' | 'M' | 'Y'
export type TonerDrumKind = '토너' | '드럼'

export type ConsumableLike = {
  id: string
  category?: string | null
  model_name?: string | null
  code?: string | null
  current_stock?: number | null
  color?: string | null
  is_regenerated?: boolean | null
}

const COLOR_NAME: Record<TonerDrumColor, RegExp> = {
  K: /(?:^|[\s\-_/])(K|블랙|black|검정)(?:$|[\s\-_/])/i,
  C: /(?:^|[\s\-_/])(C|시안|cyan|청록)(?:$|[\s\-_/])/i,
  M: /(?:^|[\s\-_/])(M|마젠타|magenta|빨강)(?:$|[\s\-_/])/i,
  Y: /(?:^|[\s\-_/])(Y|옐로|yellow|노랑)(?:$|[\s\-_/])/i,
}

export function isRegeneratedName(name: string): boolean {
  return /재생|再生|reman|remán|recycle|재생품/i.test(name || '')
}

export function standardConsumableName(
  kind: TonerDrumKind,
  color: TonerDrumColor,
  regenerated: boolean
): string {
  return regenerated ? `${kind} ${color} 재생` : `${kind} ${color}`
}

export function detectColor(name: string): TonerDrumColor | null {
  const n = name || ''
  // 단독 글자 우선 (토너 K, Drum-C 등)
  for (const c of ['K', 'C', 'M', 'Y'] as TonerDrumColor[]) {
    if (new RegExp(`(?:^|[\\s\\-_/])${c}(?:$|[\\s\\-_/])`).test(n)) return c
  }
  for (const c of ['K', 'C', 'M', 'Y'] as TonerDrumColor[]) {
    if (COLOR_NAME[c].test(n)) return c
  }
  return null
}

/** 우선순위: color/is_regenerated 컬럼 → 이름 규칙 */
export function findTonerDrumConsumable(
  list: ConsumableLike[],
  kind: TonerDrumKind,
  color: TonerDrumColor,
  regenerated: boolean
): ConsumableLike | undefined {
  const byCols = list.find((c) => {
    const cat = (c.category || '').trim()
    if (cat !== kind) return false
    if (c.color != null && String(c.color).toUpperCase() === color) {
      return Boolean(c.is_regenerated) === regenerated
    }
    return false
  })
  if (byCols) return byCols

  const expected = standardConsumableName(kind, color, regenerated)
  const exact = list.find(
    (c) =>
      (c.category || '').trim() === kind &&
      (c.model_name || '').trim() === expected
  )
  if (exact) return exact

  return list.find((c) => {
    if ((c.category || '').trim() !== kind) return false
    const name = c.model_name || ''
    if (isRegeneratedName(name) !== regenerated) return false
    return detectColor(name) === color
  })
}

export function isPartsCategory(category: string): boolean {
  return ['부품', '롤러', '기어', 'Fuser'].includes((category || '').trim())
}

export function partsConsumables(list: ConsumableLike[]): ConsumableLike[] {
  return list.filter((c) => isPartsCategory(c.category || ''))
}
