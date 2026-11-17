/**
 * 복합기 렌탈 원가계산 — 순수 계산 로직.
 *
 * 화면(components/costing)과 저장(app/actions/costing.ts)이 같은 수식을 쓰도록
 * 계산은 전부 이 파일에만 둔다.
 */

export type PartApply = 'all' | 'bw' | 'col'

/** 소모품 한 줄 — 단가, 라이프(장), 수량, 적용 대상 */
export type CostPart = {
  name: string
  price: number
  life: number
  qty: number
  apply: PartApply
}

export type CostInputs = {
  // 계약 · 요금제
  fee: number
  months: number
  basicBw: number
  basicCol: number
  priceBw: number
  priceCol: number
  /** A3 가중치 (청구) — A3 1장을 A4 몇 장으로 셀지 */
  wBill: number

  // 기계 원가
  buy: number
  /** 감가 기간(개월). 0이면 계약기간을 쓴다 */
  life: number
  setup: number
  initToner: number
  /** 보증금 — 참고 표시만 하고 계산에는 넣지 않는다 */
  deposit: number

  // 예상 월 매수
  bwA4: number
  bwA3: number
  colA4: number
  colA3: number
  /** A3 가중치 (소모품) */
  wCons: number

  // 월 고정비
  visits: number
  visitCost: number
  otherFixed: number

  // 접힌 구역은 계산에서 빼거나 기본값으로 본다
  showMachine: boolean
  showVolume: boolean
  showFixed: boolean
}

export const DEFAULT_PARTS: CostPart[] = [
  { name: '토너 K', price: 45000, life: 20000, qty: 1, apply: 'all' },
  { name: '토너 C·M·Y', price: 55000, life: 15000, qty: 3, apply: 'col' },
  { name: '드럼 K', price: 90000, life: 60000, qty: 1, apply: 'all' },
  { name: '드럼 컬러', price: 95000, life: 50000, qty: 3, apply: 'col' },
  { name: '현상기 K', price: 120000, life: 200000, qty: 1, apply: 'all' },
  { name: '현상기 컬러', price: 130000, life: 150000, qty: 3, apply: 'col' },
  { name: '정착기', price: 180000, life: 150000, qty: 1, apply: 'all' },
  { name: '폐토너통', price: 25000, life: 50000, qty: 1, apply: 'all' },
]

export const DEFAULT_INPUTS: CostInputs = {
  fee: 60000,
  months: 36,
  basicBw: 1000,
  basicCol: 100,
  priceBw: 20,
  priceCol: 150,
  wBill: 2,
  buy: 1200000,
  life: 0,
  setup: 0,
  initToner: 0,
  deposit: 0,
  bwA4: 1000,
  bwA3: 0,
  colA4: 100,
  colA3: 0,
  wCons: 2,
  visits: 1,
  visitCost: 25000,
  otherFixed: 0,
  showMachine: false,
  showVolume: true,
  showFixed: false,
}

export const APPLY_LABEL: Record<PartApply, string> = {
  all: '흑백+칼라',
  bw: '흑백만',
  col: '칼라만',
}

/** 접힘 상태를 반영해 실제 계산에 쓸 값으로 정리한다 */
export function normalizeInputs(raw: CostInputs): CostInputs {
  const v: CostInputs = { ...raw }
  v.months = Math.max(1, Math.round(v.months || 0))
  v.wBill = v.wBill || 1
  v.wCons = v.wCons || 1

  if (!v.showMachine) {
    // 매입가만 쓰고 나머지 기계 원가는 빼둔다
    v.setup = 0
    v.initToner = 0
    v.deposit = 0
    v.life = 0
  }
  // 감가 기간을 비워 두면 계약기간 — 계약 동안 기계값을 터는 것으로 본다
  v.life = Math.max(0, Math.round(v.life || 0)) || v.months

  if (!v.showVolume) {
    // 매수를 접으면 고객이 기본매수만큼 찍는다고 본다.
    // 0으로 두면 소모품비가 사라져 판정이 실제보다 후하게 나온다.
    v.bwA4 = v.basicBw
    v.bwA3 = 0
    v.colA4 = v.basicCol
    v.colA3 = 0
  }
  if (!v.showFixed) {
    v.visits = 0
    v.visitCost = 0
    v.otherFixed = 0
  }
  return v
}

/** 이 소모품을 한 달에 몇 개 쓰게 되는지 */
export function unitsPerMonth(p: CostPart, bwPages: number, colPages: number): number {
  if (!p.life) return 0
  const applied = p.apply === 'bw' ? bwPages : p.apply === 'col' ? colPages : bwPages + colPages
  return (applied / p.life) * p.qty
}

/** 이 소모품을 몇 개월에 한 번 갈게 되는지 (라이프 ÷ 월 적용매수) */
export function cycleMonths(p: CostPart, bwPages: number, colPages: number): number | null {
  const applied = p.apply === 'bw' ? bwPages : p.apply === 'col' ? colPages : bwPages + colPages
  if (!applied || !p.life) return null
  return p.life / applied
}

/** 흑백(또는 칼라) 1장을 더 찍을 때 늘어나는 소모품비 */
export function perPageCons(parts: CostPart[], which: 'bw' | 'col'): number {
  let sum = 0
  for (const p of parts) {
    if (!p.life) continue
    if (p.apply === 'all' || p.apply === which) sum += (p.price * p.qty) / p.life
  }
  return sum
}

/** 이 기계에 들어간 돈 — 월 감가와 회수 기간이 같은 금액을 쓴다 */
export function investOf(v: CostInputs): number {
  return Math.max(0, v.buy + v.setup + v.initToner)
}

export type CostLimits = {
  /** 기본매수를 그대로 둘 때 받아야 하는 최저 렌탈료 */
  feeMin: number
  /** 렌탈료와 반대쪽 기본매수를 고정할 때 늘려줄 수 있는 최대 기본매수 (null = 소모품비 0으로 한계 없음) */
  bwMax: number | null
  colMax: number | null
}

export type CostResult = {
  inputs: CostInputs
  fixed: number
  revenue: number
  consumable: number
  depreciation: number
  /** 수입 − 소모품 − 고정비 (감가 전) */
  contribution: number
  profit: number
  extraBw: number
  extraCol: number
  extraAmount: number
  bwBilled: number
  colBilled: number
  bwPages: number
  colPages: number
  totalPages: number
  invest: number
  /** 기계 원가 회수 개월. 0 = 기계값 없음, null = 남는 돈이 없어 회수 불가 */
  payback: number | null
  totalRevenue: number
  totalProfit: number
  limits: CostLimits
}

export function calcCosting(raw: CostInputs, parts: CostPart[]): CostResult {
  const v = normalizeInputs(raw)
  const fixed = v.visits * v.visitCost + v.otherFixed

  const bwBilled = v.bwA4 + v.bwA3 * v.wBill
  const colBilled = v.colA4 + v.colA3 * v.wBill
  const extraBw = Math.max(0, bwBilled - v.basicBw)
  const extraCol = Math.max(0, colBilled - v.basicCol)
  const extraAmount = extraBw * v.priceBw + extraCol * v.priceCol
  const revenue = v.fee + extraAmount

  const bwPages = v.bwA4 + v.bwA3 * v.wCons
  const colPages = v.colA4 + v.colA3 * v.wCons

  let consumable = 0
  for (const p of parts) consumable += unitsPerMonth(p, bwPages, colPages) * p.price

  const invest = investOf(v)
  const depreciation = v.life > 0 ? invest / v.life : 0
  const contribution = revenue - consumable - fixed
  const profit = contribution - depreciation

  const payback = invest <= 0 ? 0 : contribution <= 0 ? null : Math.ceil(invest / contribution)

  // 깎아줄 수 있는 한계 — 고객이 기본매수만큼만 찍는다고 보고(초과금 0) 계산한다.
  // 비용은 감가 + 고정비 + 기본매수만큼의 소모품비.
  const perBw = perPageCons(parts, 'bw')
  const perCol = perPageCons(parts, 'col')
  const base = depreciation + fixed
  const limits: CostLimits = {
    feeMin: base + perBw * v.basicBw + perCol * v.basicCol,
    bwMax: perBw > 0 ? (v.fee - base - perCol * v.basicCol) / perBw : null,
    colMax: perCol > 0 ? (v.fee - base - perBw * v.basicBw) / perCol : null,
  }

  return {
    inputs: v,
    fixed,
    revenue,
    consumable,
    depreciation,
    contribution,
    profit,
    extraBw,
    extraCol,
    extraAmount,
    bwBilled,
    colBilled,
    bwPages,
    colPages,
    totalPages: v.bwA4 + v.bwA3 + v.colA4 + v.colA3,
    invest,
    payback,
    totalRevenue: revenue * v.months,
    totalProfit: contribution * v.months - invest,
    limits,
  }
}

export type Verdict = {
  tone: 'good' | 'warn' | 'bad'
  title: string
}

/** 판정 한 줄 — 회수 기간과 순이익률로 가른다 */
export function verdictOf(r: CostResult): Verdict {
  if (r.payback === null) return { tone: 'bad', title: '위험 — 쓸수록 손해입니다' }
  if (r.payback > r.inputs.months) return { tone: 'bad', title: '위험 — 계약기간 안에 기계값을 못 뽑습니다' }
  if (r.profit <= 0) return { tone: 'warn', title: '보통 — 기계값은 뽑지만 마진이 없습니다' }
  if (r.revenue > 0 && r.profit / r.revenue < 0.2) return { tone: 'warn', title: '보통 — 남지만 얇습니다' }
  return { tone: 'good', title: '좋음 — 남는 계약입니다' }
}

/** 콤마가 섞인 입력값을 숫자로 (음수는 0) */
export function parseNum(text: string | number | null | undefined): number {
  const n = parseFloat(String(text ?? '').replace(/,/g, ''))
  return Number.isFinite(n) ? Math.max(0, n) : 0
}

export function withCommas(n: number): string {
  return Number(n || 0).toLocaleString('ko-KR')
}
