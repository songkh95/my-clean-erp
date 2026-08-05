/** 토너/드럼 KCMY · 재생 소모품 매칭 (호환 기기 모델 기준) */

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
  /** 호환 기기 모델명 목록 */
  compatible_models?: string[] | null
  /** @deprecated product_group 단일값 — 마이그레이션용 */
  product_group?: string | null
}

const COLOR_NAME: Record<TonerDrumColor, RegExp> = {
  K: /(?:^|[\s\-_/])(K|블랙|black|검정)(?:$|[\s\-_/])/i,
  C: /(?:^|[\s\-_/])(C|시안|cyan|청록)(?:$|[\s\-_/])/i,
  M: /(?:^|[\s\-_/])(M|마젠타|magenta|빨강)(?:$|[\s\-_/])/i,
  Y: /(?:^|[\s\-_/])(Y|옐로|yellow|노랑)(?:$|[\s\-_/])/i,
}

export function normalizeMachineModel(value: string | null | undefined): string {
  return String(value || '').trim().toUpperCase()
}

/** @deprecated 이름 호환 */
export const normalizeProductGroup = normalizeMachineModel

export function getCompatibleModels(c: ConsumableLike): string[] {
  if (Array.isArray(c.compatible_models) && c.compatible_models.length > 0) {
    return c.compatible_models.map(normalizeMachineModel).filter(Boolean)
  }
  const legacy = normalizeMachineModel(c.product_group)
  return legacy ? [legacy] : []
}

export function isCompatibleWithMachine(
  c: ConsumableLike,
  machineModel: string | null | undefined
): boolean {
  const m = normalizeMachineModel(machineModel)
  if (!m) return false
  return getCompatibleModels(c).includes(m)
}

/** 해당 기기와 호환되는 소모품만 */
export function filterByCompatibleMachine<T extends ConsumableLike>(
  list: T[],
  machineModel: string | null | undefined
): T[] {
  const m = normalizeMachineModel(machineModel)
  if (!m) return list
  return list.filter((c) => isCompatibleWithMachine(c, m))
}

/** @deprecated */
export function filterByProductGroup<T extends ConsumableLike>(
  list: T[],
  productGroup: string | null | undefined
): T[] {
  return filterByCompatibleMachine(list, productGroup)
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
  const n = String(name || '')
  if (!n.trim()) return null

  // 한글 붙여쓰기: K토너, 토너K, C드럼 등
  const glued: Array<[TonerDrumColor, RegExp]> = [
    ['K', /K\s*(토너|드럼)|(?:토너|드럼)\s*K|블랙|검정|black/i],
    ['C', /C\s*(토너|드럼)|(?:토너|드럼)\s*C|시안|청록|cyan/i],
    ['M', /M\s*(토너|드럼)|(?:토너|드럼)\s*M|마젠타|magenta/i],
    ['Y', /Y\s*(토너|드럼)|(?:토너|드럼)\s*Y|옐로|노랑|yellow/i],
  ]
  for (const [c, re] of glued) {
    if (re.test(n)) return c
  }

  for (const c of ['K', 'C', 'M', 'Y'] as TonerDrumColor[]) {
    if (new RegExp(`(?:^|[\\s\\-_/])${c}(?:$|[\\s\\-_/])`).test(n)) return c
  }
  for (const c of ['K', 'C', 'M', 'Y'] as TonerDrumColor[]) {
    if (COLOR_NAME[c].test(n)) return c
  }
  return null
}

function matchesKindColorRegen(
  c: ConsumableLike,
  kind: TonerDrumKind,
  color: TonerDrumColor,
  regenerated: boolean
): boolean {
  if ((c.category || '').trim() !== kind) return false
  const name = c.model_name || ''
  if (isRegeneratedName(name) !== regenerated && c.is_regenerated == null) return false
  if (c.is_regenerated != null && Boolean(c.is_regenerated) !== regenerated) return false

  if (c.color != null && String(c.color).trim() !== '') {
    if (String(c.color).toUpperCase() === color) return true
  }
  return detectColor(name) === color
}

/**
 * 기기 호환 + 종류 + 색상(+재생)으로 품목 찾기.
 * 색상은 DB color 컬럼 우선, 없으면 품명 추정(레거시).
 */
export function findTonerDrumConsumable(
  list: ConsumableLike[],
  kind: TonerDrumKind,
  color: TonerDrumColor,
  regenerated: boolean,
  machineModel?: string | null
): ConsumableLike | undefined {
  const scoped = machineModel
    ? filterByCompatibleMachine(list, machineModel)
    : list

  const pickBest = (candidates: ConsumableLike[]) => {
    if (candidates.length === 0) return undefined
    const withStock = candidates.find((c) => (Number(c.current_stock) || 0) > 0)
    return withStock || candidates[0]
  }

  // 1) color 컬럼이 있는 품목 (권장 경로)
  const byColorCol = scoped.filter((c) => {
    if ((c.category || '').trim() !== kind) return false
    if (c.color == null || String(c.color).trim() === '') return false
    if (String(c.color).toUpperCase() !== color) return false
    return Boolean(c.is_regenerated) === regenerated
  })
  const hit = pickBest(byColorCol)
  if (hit) return hit

  // 2) 레거시: color 없는 품목은 품명으로만 보조 매칭
  const legacy = scoped.filter((c) => {
    if ((c.category || '').trim() !== kind) return false
    if (c.color != null && String(c.color).trim() !== '') return false
    return matchesKindColorRegen(c, kind, color, regenerated)
  })
  return pickBest(legacy)
}

/** 호환 여부와 무관하게 동일 색상·재생 품목 (호환 연결용) */
export function findTonerDrumAny(
  list: ConsumableLike[],
  kind: TonerDrumKind,
  color: TonerDrumColor,
  regenerated: boolean
): ConsumableLike | undefined {
  return findTonerDrumConsumable(list, kind, color, regenerated, null)
}

export function isPartsCategory(category: string): boolean {
  return ['부품', '롤러', '기어', 'Fuser'].includes((category || '').trim())
}

export function partsConsumables(
  list: ConsumableLike[],
  machineModel?: string | null
): ConsumableLike[] {
  const parts = list.filter((c) => isPartsCategory(c.category || ''))
  return filterByCompatibleMachine(parts, machineModel)
}
