/**
 * 소모품을 화면에 보여줄 이름.
 * 토너·드럼은 분류와 색상으로 ("토너 K", "드럼 C 재생"),
 * 부품처럼 같은 분류에 여러 품목이 있는 것은 분류와 모델명으로 ("부품 · ROLLER-12"),
 * 폐토너통·현상기·용지처럼 품목이 하나인 분류는 분류 이름만 보여준다.
 */
type ConsumableLike = {
  category?: string | null
  model_name?: string | null
  color?: string | null
  is_regenerated?: boolean | null
}

/** 색상을 함께 쓰는 분류 */
const COLORED = ['토너', '드럼']
/** 분류 이름만으로 충분한 분류 */
const CATEGORY_ONLY = ['폐토너통', '현상기', '용지']

export function consumableLabel(c: ConsumableLike | null | undefined): string {
  if (!c) return '?'
  const category = String(c.category || '').trim()
  const model = String(c.model_name || '').trim()
  if (!category) return model || '?'

  if (COLORED.includes(category)) {
    const color = String(c.color || '').trim()
    const regen = c.is_regenerated ? ' 재생' : ''
    return `${category}${color ? ` ${color}` : ''}${regen}`
  }

  if (CATEGORY_ONLY.includes(category)) return category

  // 분류와 모델명이 같은 뜻이면 한 번만 쓴다 (예: 모델명이 "부품")
  if (!model || model === category) return category
  return `${category} · ${model}`
}
