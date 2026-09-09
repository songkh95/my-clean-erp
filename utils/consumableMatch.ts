/** 토너/드럼 색상 · 재생 소모품 매칭 (호환 기기 모델 기준)
 * KCMY = 4색 공용(특히 드럼) */
export type TonerDrumColor = 'K' | 'C' | 'M' | 'Y' | 'KCMY'
export type TonerDrumKind = '토너' | '드럼'

/** 등록·일지 선택용 색상 목록 (KCMY=공용) */
export const TONER_DRUM_COLORS: TonerDrumColor[] = ['K', 'C', 'M', 'Y', 'KCMY']

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
  is_active?: boolean | null
}

const COLOR_NAME: Record<TonerDrumColor, RegExp> = {
  // KCMY를 단일 K보다 먼저 검사하도록 detectColor에서 순서 보장
  KCMY: /(?:^|[\s\-_/])(KCMY|공용)(?:$|[\s\-_/])/i,
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
  const mCompact = m.replace(/[\s\-_./]/g, '')
  return getCompatibleModels(c).some((cm) => {
    if (cm === m) return true
    const cCompact = cm.replace(/[\s\-_./]/g, '')
    if (cCompact && mCompact && cCompact === mCompact) return true
    // 한쪽이 다른 쪽을 포함 (예: APEOSPORT C2060 ↔ APEOSPORT-C2060 / 부분 표기)
    if (mCompact.length >= 5 && cCompact.length >= 5) {
      if (mCompact.includes(cCompact) || cCompact.includes(mCompact)) return true
    }
    return false
  })
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

  // 공용색 KCMY를 단일 문자(K 등)보다 먼저 판별
  if (/KCMY/i.test(n) || /(?:^|[\s\-_/])공용(?:$|[\s\-_/])/.test(n)) {
    return 'KCMY'
  }

  // 한글 붙여쓰기: K토너, 토너K, C드럼 등
  const glued: Array<[TonerDrumColor, RegExp]> = [
    ['K', /(?:^|[\s\-_/])K\s*(토너|드럼)|(?:토너|드럼)\s*K(?:$|[\s\-_/])|블랙|검정|black/i],
    ['C', /(?:^|[\s\-_/])C\s*(토너|드럼)|(?:토너|드럼)\s*C(?:$|[\s\-_/])|시안|청록|cyan/i],
    ['M', /(?:^|[\s\-_/])M\s*(토너|드럼)|(?:토너|드럼)\s*M(?:$|[\s\-_/])|마젠타|magenta/i],
    ['Y', /(?:^|[\s\-_/])Y\s*(토너|드럼)|(?:토너|드럼)\s*Y(?:$|[\s\-_/])|옐로|노랑|yellow/i],
  ]
  for (const [c, re] of glued) {
    if (re.test(n)) return c
  }

  const singles: TonerDrumColor[] = ['K', 'C', 'M', 'Y']
  for (const c of singles) {
    if (new RegExp(`(?:^|[\\s\\-_/])${c}(?:$|[\\s\\-_/])`).test(n)) return c
  }
  for (const c of ['KCMY', ...singles] as TonerDrumColor[]) {
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

/** 호환 여부와 무관하게 동일 색상·재생 품목 목록 (기존 재고 선택용) */
export function listTonerDrumCandidates(
  list: ConsumableLike[],
  kind: TonerDrumKind,
  color: TonerDrumColor,
  regenerated: boolean
): ConsumableLike[] {
  const byColorCol = list.filter((c) => {
    if ((c.category || '').trim() !== kind) return false
    if (c.color == null || String(c.color).trim() === '') return false
    if (String(c.color).toUpperCase() !== color) return false
    return Boolean(c.is_regenerated) === regenerated
  })
  if (byColorCol.length > 0) return byColorCol

  return list.filter((c) => {
    if ((c.category || '').trim() !== kind) return false
    if (c.color != null && String(c.color).trim() !== '') return false
    return matchesKindColorRegen(c, kind, color, regenerated)
  })
}

/** 호환 여부와 무관하게 동일 색상·재생 품목 1건 (레거시) */
export function findTonerDrumAny(
  list: ConsumableLike[],
  kind: TonerDrumKind,
  color: TonerDrumColor,
  regenerated: boolean
): ConsumableLike | undefined {
  return listTonerDrumCandidates(list, kind, color, regenerated)[0]
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

/** 토너·드럼·부품 외 소모품 (폐토너통·현상기·용지 등) */
export const OTHER_CONSUMABLE_CATEGORIES = ['현상기', '폐토너통', '용지', '기타'] as const

export function normalizeConsumableCategory(category: string | null | undefined): string {
  const raw = String(category || '').trim()
  if (!raw) return ''
  // 등록 시 「폐토너」로 적은 경우도 폐토너통으로 취급
  if (raw === '폐토너' || /^폐\s*토너/.test(raw)) return '폐토너통'
  return raw
}

export function isOtherConsumableCategory(category: string | null | undefined): boolean {
  const cat = normalizeConsumableCategory(category)
  if (!cat) return false
  if (cat === '토너' || cat === '드럼') return false
  if (isPartsCategory(cat)) return false
  return (
    (OTHER_CONSUMABLE_CATEGORIES as readonly string[]).includes(cat) ||
    cat.includes('폐토너')
  )
}

export function otherConsumables(
  list: ConsumableLike[],
  machineModel?: string | null
): ConsumableLike[] {
  const others = list.filter((c) => isOtherConsumableCategory(c.category))
  return filterByCompatibleMachine(others, machineModel)
}

/** 호환 여부와 무관 — 기존 재고에서 기타 소모품 선택용 */
export function listOtherConsumableCandidates(list: ConsumableLike[]): ConsumableLike[] {
  return list.filter((c) => isOtherConsumableCategory(c.category) && c.is_active !== false)
}
