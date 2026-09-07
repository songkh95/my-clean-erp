import { toMachineModelName } from '@/utils/suggestMatch'
import { rankSuggestions } from '@/utils/suggestMatch'
import { normalizeMachineModel } from '@/utils/consumableMatch'

/** 소모품 호환용 모델명 정규화 (영문 모델 우선, 비면 원문 유지) */
export function canonicalizeMachineModel(raw: string | null | undefined): string {
  const input = String(raw || '').trim()
  if (!input) return ''
  const stripped = toMachineModelName(input).trim()
  if (stripped) return stripped
  return input.toUpperCase().replace(/\s+/g, ' ')
}

export function compactMachineModel(raw: string | null | undefined): string {
  return canonicalizeMachineModel(raw).replace(/[\s\-_./]/g, '')
}

/**
 * 일지에 적힌 기기명 → 재고/호환목록에 있는 표준 모델명으로 맞춤.
 * 없으면 직접 입력값을 그대로 써 호환 연결·신규 등록에 사용.
 */
export function resolveMachineModel(
  raw: string | null | undefined,
  knownModels: string[] = []
): string | null {
  const q = canonicalizeMachineModel(raw)
  if (!q) return null

  const known = Array.from(
    new Set(knownModels.map(canonicalizeMachineModel).filter(Boolean))
  )
  if (known.length === 0) return q

  const qCompact = compactMachineModel(q)
  const exact = known.find((k) => k === q || compactMachineModel(k) === qCompact)
  if (exact) return exact

  // 한쪽이 다른 쪽을 포함하는 경우 (짧은 쪽 길이 ≥ 3)
  const contains = known.find((k) => {
    const kc = compactMachineModel(k)
    if (!kc || !qCompact) return false
    if (kc.length < 3 || qCompact.length < 3) return false
    return kc.includes(qCompact) || qCompact.includes(kc)
  })
  if (contains) return contains

  const ranked = rankSuggestions(q, known, 3)
  if (ranked[0] && ranked[0].score >= 700) {
    return canonicalizeMachineModel(ranked[0].value) || ranked[0].value
  }

  return q
}

/** 일지 객체에서 기기 모델 원문 추출 */
export function rawMachineModelFromLog(log: {
  machine_model?: string | null
  inventory?: { model_name?: string | null } | null
} | null | undefined): string {
  return String(log?.machine_model || log?.inventory?.model_name || '').trim()
}

export function collectKnownMachineModels(sources: {
  inventoryModels?: Array<string | null | undefined>
  compatibleModels?: Array<string | null | undefined>
  consumables?: Array<{ compatible_models?: string[] | null; product_group?: string | null }>
}): string[] {
  const set = new Set<string>()
  for (const m of sources.inventoryModels || []) {
    const v = canonicalizeMachineModel(m)
    if (v) set.add(v)
  }
  for (const m of sources.compatibleModels || []) {
    const v = canonicalizeMachineModel(m)
    if (v) set.add(v)
  }
  for (const c of sources.consumables || []) {
    for (const m of c.compatible_models || []) {
      const v = canonicalizeMachineModel(m)
      if (v) set.add(v)
    }
    const g = canonicalizeMachineModel(c.product_group)
    if (g) set.add(g)
  }
  return Array.from(set)
}

/** 호환 비교: 공백/기호 무시 후 동일하면 매칭 */
export function modelsMatch(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const ca = compactMachineModel(a)
  const cb = compactMachineModel(b)
  if (!ca || !cb) return false
  return ca === cb || normalizeMachineModel(a) === normalizeMachineModel(b)
}
