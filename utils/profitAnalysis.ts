/**
 * 거래처 수익 분석 — 순수 계산 로직.
 *
 * 월 정산으로 확정된 매출에서 실제 원가를 빼 이익을 낸다.
 * 소모품비는 두 가지로 내고(실제 / 환산) 화면에서 나란히 보여 준다.
 *  · 실제: 서비스 일지에 적힌 사용 수량 × 재고 단가
 *  · 환산: 장당 원가(단가 ÷ 라이프) × 그 기간 실제 매수
 */

export type MachineCostInput = {
  purchase_price: number | null
  setup_cost: number | null
  initial_toner_cost: number | null
  contract_years: number | null
  contract_start_date: string | null
  contract_end_date: string | null
  plan_basic_fee: number | null
  plan_basic_cnt_bw: number | null
  plan_basic_cnt_col: number | null
  plan_price_bw: number | null
  plan_price_col: number | null
}

/** 소모품 한 품목 — 환산 장당 원가를 내는 데 쓴다 */
export type ConsumableSpec = {
  id: string
  model_name: string
  unit_price: number | null
  life_pages: number | null
  /** K / C / M / Y / KCMY, 빈 값이면 흑백·칼라 공통으로 본다 */
  color: string | null
  category?: string | null
  is_regenerated?: boolean | null
  code?: string | null
}

/**
 * 알림에 쓸 품목 이름.
 * 같은 품명에 색만 다른 품목이 여러 개 있어서(토너 K·C·M·Y) 품명만으로는 구분이 안 된다.
 * 품명 · 분류 색상 (관리코드) 로 적는다.
 */
export function consumableDetailLabel(c: {
  model_name?: string | null
  category?: string | null
  color?: string | null
  is_regenerated?: boolean | null
  code?: string | null
}): string {
  const model = String(c.model_name || '').trim()
  const category = String(c.category || '').trim()
  const color = String(c.color || '').trim().toUpperCase()
  const parts: string[] = []
  if (category) parts.push(color ? `${category} ${color}` : category)
  if (c.is_regenerated) parts.push('재생')
  const tail = parts.join(' ')
  const head = [model, tail].filter(Boolean).join(' · ')
  return head || '(이름 없음)'
}

/** 계약 개월수 — 연수 우선, 없으면 계약 시작·종료일, 둘 다 없으면 null */
export function contractMonths(m: MachineCostInput): number | null {
  const years = Number(m.contract_years) || 0
  if (years > 0) return Math.round(years * 12)

  const from = m.contract_start_date ? new Date(m.contract_start_date) : null
  const to = m.contract_end_date ? new Date(m.contract_end_date) : null
  if (!from || !to || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null

  const months =
    (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth())
  return months > 0 ? months : null
}

/** 이 기계에 들어간 돈 — 매입가 + 설치비 + 초기 소모품 (뒤 둘은 선택) */
export function machineInvest(m: MachineCostInput): number {
  return (
    Math.max(0, Number(m.purchase_price) || 0) +
    Math.max(0, Number(m.setup_cost) || 0) +
    Math.max(0, Number(m.initial_toner_cost) || 0)
  )
}

/** 월 감가 — 계약 기간 동안 기계값을 터는 것으로 본다 */
export function monthlyDepreciation(m: MachineCostInput): number | null {
  const months = contractMonths(m)
  if (!months) return null
  return machineInvest(m) / months
}

/** 칼라에만 쓰이는 소모품인지 — 색이 C·M·Y·KCMY 면 칼라 전용으로 본다 */
export function isColorOnly(c: ConsumableSpec): boolean {
  const color = String(c.color || '').toUpperCase().trim()
  if (!color) return false
  if (color === 'K') return false
  return /^[CMY]$|^KCMY$/.test(color)
}

export type PerPageCost = {
  /** 흑백·칼라 모두에 붙는 장당 원가 */
  all: number
  /** 칼라에만 붙는 장당 원가 */
  col: number
  /** 라이프가 없어 환산에 넣지 못한 품목 */
  missingLife: ConsumableSpec[]
  /** 단가가 0원이라 원가가 과소 계산되는 품목 */
  missingPrice: ConsumableSpec[]
}

/** 이 기계 모델에 걸린 소모품들로 장당 원가를 낸다 */
export function perPageCostOf(specs: ConsumableSpec[]): PerPageCost {
  const out: PerPageCost = { all: 0, col: 0, missingLife: [], missingPrice: [] }
  for (const c of specs) {
    const price = Number(c.unit_price) || 0
    const life = Number(c.life_pages) || 0
    if (price <= 0) out.missingPrice.push(c)
    if (life <= 0) {
      out.missingLife.push(c)
      continue
    }
    if (price <= 0) continue
    const per = price / life
    if (isColorOnly(c)) out.col += per
    else out.all += per
  }
  return out
}

export type MachineUsage = {
  /** 환산 매수 (A3 가중치가 반영된 값) */
  bw: number
  col: number
}

export type MachineProfit = {
  inventoryId: string
  clientId: string | null
  model: string
  serial: string
  department: string | null
  /** 이 기간에 정산이 잡힌 개월 수 */
  months: number
  usage: MachineUsage
  revenue: number
  /** 서비스 일지에 적힌 실제 소모품비 */
  consumableActual: number
  /** 장당 원가 × 실제 매수 (라이프가 없으면 null) */
  consumableEstimated: number | null
  depreciation: number
  profitActual: number
  profitEstimated: number | null
  /** 재설치 기계 — 이전 계약에서 이미 기계값을 털었을 수 있다 */
  reinstalled: boolean
  /** 매수는 있는데 그 기간 서비스 일지가 하나도 없음 */
  noServiceLog: boolean
}

export function machineProfitOf(args: {
  inventoryId: string
  clientId: string | null
  model: string
  serial: string
  department: string | null
  months: number
  usage: MachineUsage
  revenue: number
  consumableActual: number
  perPage: PerPageCost | null
  monthlyDep: number
  reinstalled: boolean
  serviceLogCount: number
}): MachineProfit {
  const { usage, perPage } = args
  const estimated =
    perPage && perPage.all + perPage.col > 0
      ? perPage.all * (usage.bw + usage.col) + perPage.col * usage.col
      : null

  const depreciation = args.monthlyDep * Math.max(1, args.months)
  const profitActual = args.revenue - args.consumableActual - depreciation

  return {
    inventoryId: args.inventoryId,
    clientId: args.clientId,
    model: args.model,
    serial: args.serial,
    department: args.department,
    months: args.months,
    usage,
    revenue: args.revenue,
    consumableActual: args.consumableActual,
    consumableEstimated: estimated,
    depreciation,
    profitActual,
    profitEstimated: estimated == null ? null : args.revenue - estimated - depreciation,
    reinstalled: args.reinstalled,
    noServiceLog: args.serviceLogCount === 0 && usage.bw + usage.col > 0,
  }
}

export type Totals = {
  revenue: number
  consumableActual: number
  consumableEstimated: number | null
  depreciation: number
  profitActual: number
  profitEstimated: number | null
  marginActual: number
  marginEstimated: number | null
}

export function sumProfits(list: MachineProfit[]): Totals {
  const revenue = list.reduce((s, m) => s + m.revenue, 0)
  const consumableActual = list.reduce((s, m) => s + m.consumableActual, 0)
  const depreciation = list.reduce((s, m) => s + m.depreciation, 0)
  const profitActual = revenue - consumableActual - depreciation

  // 환산은 모든 기계에 라이프가 있을 때만 의미가 있다
  const everyEstimated = list.length > 0 && list.every((m) => m.consumableEstimated != null)
  const consumableEstimated = everyEstimated
    ? list.reduce((s, m) => s + (m.consumableEstimated || 0), 0)
    : null
  const profitEstimated =
    consumableEstimated == null ? null : revenue - consumableEstimated - depreciation

  return {
    revenue,
    consumableActual,
    consumableEstimated,
    depreciation,
    profitActual,
    profitEstimated,
    marginActual: revenue > 0 ? profitActual / revenue : 0,
    marginEstimated:
      profitEstimated == null || revenue <= 0 ? null : profitEstimated / revenue,
  }
}

/** 기간 → 정산 연·월 목록 */
export function monthsOfPeriod(
  mode: 'month' | 'quarter' | 'year',
  year: number,
  unit: number
): { year: number; month: number }[] {
  if (mode === 'year') {
    return Array.from({ length: 12 }, (_, i) => ({ year, month: i + 1 }))
  }
  if (mode === 'quarter') {
    const start = (unit - 1) * 3 + 1
    return [0, 1, 2].map((i) => ({ year, month: start + i }))
  }
  return [{ year, month: unit }]
}

export function periodLabel(
  mode: 'month' | 'quarter' | 'year',
  year: number,
  unit: number
): string {
  if (mode === 'year') return `${year}년`
  if (mode === 'quarter') return `${year}년 ${unit}분기`
  return `${year}년 ${unit}월`
}
