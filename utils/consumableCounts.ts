/**
 * 소모품 목록을 분류별로 묶어 짧게 적는다.
 *
 *   토너 K(1), 토너 C(1), 토너 M(1)  →  토너 K(1), C(1), M(1)
 *
 * 같은 분류가 이어지면 분류 이름을 한 번만 쓰고 색상만 나열한다.
 * 색상이 없는 품목(폐토너통 등)은 분류 이름과 수량만 쓴다.
 */
export type ConsumableCount = {
  category?: string | null
  color?: string | null
  is_regenerated?: boolean | null
  qty: number
  /** 수량 뒤에 붙일 짧은 꼬리말 (예: 미입고) */
  note?: string | null
}

export function formatConsumableCounts(entries: ConsumableCount[]): string {
  const groups: { category: string; items: string[] }[] = []

  for (const e of entries) {
    const category = String(e.category || '').trim() || '기타'
    let group = groups.find((g) => g.category === category)
    if (!group) {
      group = { category, items: [] }
      groups.push(group)
    }
    const color = String(e.color || '').trim()
    const regen = e.is_regenerated ? ' 재생' : ''
    const note = e.note ? ` ${e.note}` : ''
    const head = `${color}${regen}`.trim()
    group.items.push(`${head ? `${head}` : ''}(${e.qty})${note}`)
  }

  return groups
    .map((g) => {
      const [first, ...rest] = g.items
      const firstText = first.startsWith('(') ? `${g.category}${first}` : `${g.category} ${first}`
      return [firstText, ...rest].join(', ')
    })
    .join(', ')
}

/** "토너 K(1)" 꼴의 토큰 */
const TOKEN = /^(\S+?)(?:\s+(\S+))?\((-?\d+)\)$/

/**
 * 사람이 직접 적어 둔 재고 글("토너 K(1), 토너 C(1)")도 같은 규칙으로 줄여 보여준다.
 * 형식이 다르면 적은 그대로 돌려준다.
 */
export function compactConsumableText(text: string | null | undefined): string {
  const raw = String(text || '').trim()
  if (!raw) return ''

  const tokens = raw.split(/[,/]/).map((t) => t.trim()).filter(Boolean)
  if (tokens.length === 0) return raw

  const entries: ConsumableCount[] = []
  for (const token of tokens) {
    const m = TOKEN.exec(token)
    if (!m) return raw // 하나라도 형식이 다르면 손대지 않는다
    const [, a, b, qty] = m
    entries.push(b ? { category: a, color: b, qty: Number(qty) } : { category: a, qty: Number(qty) })
  }

  return formatConsumableCounts(entries)
}
