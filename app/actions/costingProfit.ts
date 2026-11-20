'use server'

import { createClient } from '@/utils/supabase/server'
import {
  machineProfitOf,
  monthlyDepreciation,
  monthsOfPeriod,
  perPageCostOf,
  sumProfits,
  type ConsumableSpec,
  type MachineCostInput,
  type MachineProfit,
  type Totals,
} from '@/utils/profitAnalysis'
import { toMachineModelName } from '@/utils/suggestMatch'

export type ProfitMode = 'month' | 'quarter' | 'year'

export type BlockedMachine = {
  inventoryId: string
  clientName: string
  model: string
  serial: string
  missing: string[]
}

export type ProfitWarnings = {
  /** 단가가 0원이라 실제 원가가 적게 잡히는 소모품 */
  zeroPrice: { id: string; name: string }[]
  /** 라이프가 없어 환산을 못 내는 소모품 */
  noLife: { id: string; name: string }[]
  /** 매수는 늘었는데 그 기간 서비스 일지가 없는 기계 */
  noServiceLog: { model: string; serial: string; clientName: string }[]
  /** 재설치 기계 — 감가가 이중으로 잡혔을 수 있음 */
  reinstalled: { model: string; serial: string; clientName: string }[]
}

export type ClientProfit = {
  clientId: string
  clientName: string
  machines: MachineProfit[]
  totals: Totals
}

export type ProfitAnalysis = {
  settledMonths: number
  clients: ClientProfit[]
  totals: Totals
  blocked: BlockedMachine[]
  warnings: ProfitWarnings
}

const EMPTY_WARNINGS: ProfitWarnings = {
  zeroPrice: [],
  noLife: [],
  noServiceLog: [],
  reinstalled: [],
}

async function requireOrg() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { supabase, orgId: null as string | null, error: '로그인이 필요합니다.' }
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()
  if (!profile?.organization_id) {
    return { supabase, orgId: null as string | null, error: '조직 정보를 찾을 수 없습니다.' }
  }
  return { supabase, orgId: profile.organization_id as string, error: null as string | null }
}

const num = (v: unknown) => Number(v) || 0

/** 정산 상세의 환산 매수 — converted 가 비면 원매수 + A3 가중(2배) 로 본다 */
function usageOf(d: Record<string, unknown>) {
  const bw =
    d.converted_usage_bw != null
      ? num(d.converted_usage_bw)
      : num(d.usage_bw) + num(d.usage_bw_a3) * 2
  const col =
    d.converted_usage_col != null
      ? num(d.converted_usage_col)
      : num(d.usage_col) + num(d.usage_col_a3) * 2
  return { bw: Math.max(0, bw), col: Math.max(0, col) }
}

export async function getProfitAnalysisAction(params: {
  mode: ProfitMode
  year: number
  unit: number
  clientId?: string | null
}): Promise<{ success: boolean; message: string; data: ProfitAnalysis | null }> {
  const { supabase, orgId, error: authErr } = await requireOrg()
  if (authErr || !orgId) return { success: false, message: authErr || '권한 없음', data: null }

  const months = monthsOfPeriod(params.mode, params.year, params.unit)
  const monthNums = months.map((m) => m.month)
  const firstMonth = Math.min(...monthNums)
  const lastMonth = Math.max(...monthNums)
  const lastDay = new Date(params.year, lastMonth, 0).getDate()
  const fromDate = `${params.year}-${String(firstMonth).padStart(2, '0')}-01`
  const toDate = `${params.year}-${String(lastMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const empty = (message: string, settledMonths: number) => ({
    success: true,
    message,
    data: {
      settledMonths,
      clients: [] as ClientProfit[],
      totals: sumProfits([]),
      blocked: [] as BlockedMachine[],
      warnings: EMPTY_WARNINGS,
    },
  })

  // 1. 이 기간에 등록된 정산
  let sq = supabase
    .from('settlements')
    .select('id, client_id, billing_year, billing_month')
    .eq('organization_id', orgId)
    .eq('billing_year', params.year)
    .in('billing_month', monthNums)
  if (params.clientId) sq = sq.eq('client_id', params.clientId)

  const { data: settlements, error: sErr } = await sq
  if (sErr) return { success: false, message: sErr.message, data: null }

  const settlementIds = (settlements || []).map((s) => s.id)
  if (settlementIds.length === 0) {
    return empty('이 기간에 등록된 월 정산이 없습니다.', 0)
  }

  const clientBySettlement = new Map<string, string | null>()
  for (const s of settlements || []) clientBySettlement.set(s.id, s.client_id)

  // 2. 기계별 정산 상세
  const { data: details, error: dErr } = await supabase
    .from('settlement_details')
    .select('*')
    .in('settlement_id', settlementIds)
  if (dErr) return { success: false, message: dErr.message, data: null }

  const rows = (details || []).filter((d) => d.inventory_id)
  const inventoryIds = Array.from(new Set(rows.map((d) => d.inventory_id as string)))
  if (inventoryIds.length === 0) {
    return empty('이 기간 정산에 기계별 내역이 없습니다.', months.length)
  }

  // 3. 기계 정보 (원가·계약 조건)
  const { data: machines, error: mErr } = await supabase
    .from('inventory')
    .select('*')
    .eq('organization_id', orgId)
    .in('id', inventoryIds)
  if (mErr) return { success: false, message: mErr.message, data: null }

  const machineById = new Map<string, Record<string, unknown>>()
  for (const m of machines || []) machineById.set(m.id, m as Record<string, unknown>)

  // 4. 거래처 이름
  const clientIds = Array.from(
    new Set((settlements || []).map((s) => s.client_id).filter((v): v is string => Boolean(v)))
  )
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name')
    .eq('organization_id', orgId)
    .in('id', clientIds.length > 0 ? clientIds : ['00000000-0000-0000-0000-000000000000'])
  const clientName = new Map<string, string>()
  for (const c of clients || []) clientName.set(c.id, c.name)

  // 5. 그 기간 서비스 일지 → 실제 소모품 사용분
  const { data: logs } = await supabase
    .from('service_logs')
    .select('id, inventory_id, visit_date')
    .eq('organization_id', orgId)
    .gte('visit_date', fromDate)
    .lte('visit_date', toDate)
    .in('inventory_id', inventoryIds)

  const logIds = (logs || []).map((l) => l.id)
  const logCountByMachine = new Map<string, number>()
  const machineByLog = new Map<string, string>()
  for (const l of logs || []) {
    if (!l.inventory_id) continue
    machineByLog.set(l.id, l.inventory_id)
    logCountByMachine.set(l.inventory_id, (logCountByMachine.get(l.inventory_id) || 0) + 1)
  }

  const usages = logIds.length
    ? (
        await supabase
          .from('service_parts_usage')
          .select('service_log_id, consumable_id, quantity')
          .in('service_log_id', logIds)
      ).data || []
    : []

  // 6. 소모품 단가·라이프
  const { data: allConsumables } = await supabase
    .from('consumables')
    .select('*')
    .eq('organization_id', orgId)
  const consumableById = new Map<string, Record<string, unknown>>()
  for (const c of allConsumables || []) consumableById.set(c.id, c as Record<string, unknown>)

  // 7. 기계 모델 → 소모품 연결
  const linkRes = await supabase
    .from('consumable_compatible_models' as never)
    .select('consumable_id, machine_model')
    .eq('organization_id', orgId)
  const links = (linkRes.data || []) as unknown as {
    consumable_id: string
    machine_model: string
  }[]

  const specsByModel = new Map<string, ConsumableSpec[]>()
  const pushSpec = (model: string, c: Record<string, unknown>) => {
    const key = toMachineModelName(model).trim()
    if (!key) return
    const list = specsByModel.get(key) || []
    if (list.some((x) => x.id === String(c.id))) return
    list.push({
      id: String(c.id),
      model_name: String(c.model_name || ''),
      unit_price: c.unit_price == null ? null : Number(c.unit_price),
      life_pages: c.life_pages == null ? null : Number(c.life_pages),
      color: c.color == null ? null : String(c.color),
    })
    specsByModel.set(key, list)
  }
  for (const l of links) {
    const c = consumableById.get(l.consumable_id)
    if (c) pushSpec(l.machine_model, c)
  }
  // 연결 테이블이 없던 시절의 product_group 도 함께 본다
  for (const c of allConsumables || []) {
    const g = (c as Record<string, unknown>).product_group
    if (g) pushSpec(String(g), c as Record<string, unknown>)
  }

  // 실제 사용 금액 (기계별)
  const actualByMachine = new Map<string, number>()
  const zeroPrice = new Map<string, string>()
  for (const u of usages) {
    const invId = machineByLog.get(u.service_log_id)
    if (!invId) continue
    const c = consumableById.get(u.consumable_id)
    if (!c) continue
    const price = num(c.unit_price)
    const qty = num(u.quantity) || 1
    if (price <= 0) zeroPrice.set(String(c.id), String(c.model_name || ''))
    actualByMachine.set(invId, (actualByMachine.get(invId) || 0) + price * qty)
  }

  // 8. 재설치 여부 — 설치 이력이 2번 이상이면 재설치로 본다
  const { data: history } = await supabase
    .from('machine_history')
    .select('inventory_id, action_type')
    .eq('organization_id', orgId)
    .in('inventory_id', inventoryIds)
  const installCount = new Map<string, number>()
  for (const h of history || []) {
    if (!h.inventory_id) continue
    if (!/설치|install/i.test(String(h.action_type || ''))) continue
    installCount.set(h.inventory_id, (installCount.get(h.inventory_id) || 0) + 1)
  }

  // 9. 기계별로 합치기
  type Agg = {
    revenue: number
    bw: number
    col: number
    settlements: Set<string>
    clientId: string | null
  }
  const agg = new Map<string, Agg>()
  for (const d of rows) {
    const invId = d.inventory_id as string
    const cur: Agg =
      agg.get(invId) || { revenue: 0, bw: 0, col: 0, settlements: new Set<string>(), clientId: null }
    const u = usageOf(d as unknown as Record<string, unknown>)
    cur.revenue += num(d.calculated_amount)
    cur.bw += u.bw
    cur.col += u.col
    cur.settlements.add(String(d.settlement_id))
    cur.clientId = clientBySettlement.get(String(d.settlement_id)) ?? cur.clientId
    agg.set(invId, cur)
  }

  const blocked: BlockedMachine[] = []
  const noLife = new Map<string, string>()
  const noServiceLog: ProfitWarnings['noServiceLog'] = []
  const reinstalled: ProfitWarnings['reinstalled'] = []
  const byClient = new Map<string, MachineProfit[]>()

  for (const [invId, a] of agg) {
    const m = machineById.get(invId)
    if (!m) continue
    const cName = (a.clientId && clientName.get(a.clientId)) || '(거래처 없음)'

    const cost: MachineCostInput = {
      purchase_price: m.purchase_price == null ? null : Number(m.purchase_price),
      setup_cost: m.setup_cost == null ? null : Number(m.setup_cost),
      initial_toner_cost: m.initial_toner_cost == null ? null : Number(m.initial_toner_cost),
      contract_years: m.contract_years == null ? null : Number(m.contract_years),
      contract_start_date: (m.contract_start_date as string) || null,
      contract_end_date: (m.contract_end_date as string) || null,
      plan_basic_fee: m.plan_basic_fee == null ? null : Number(m.plan_basic_fee),
      plan_basic_cnt_bw: m.plan_basic_cnt_bw == null ? null : Number(m.plan_basic_cnt_bw),
      plan_basic_cnt_col: m.plan_basic_cnt_col == null ? null : Number(m.plan_basic_cnt_col),
      plan_price_bw: m.plan_price_bw == null ? null : Number(m.plan_price_bw),
      plan_price_col: m.plan_price_col == null ? null : Number(m.plan_price_col),
    }

    const missing: string[] = []
    if (!(Number(cost.purchase_price) > 0)) missing.push('매입가')
    if (cost.plan_basic_fee == null) missing.push('기본 렌탈료')
    if (cost.plan_basic_cnt_bw == null || cost.plan_basic_cnt_col == null) missing.push('기본매수')
    if (cost.plan_price_bw == null || cost.plan_price_col == null) missing.push('추가 단가')
    const dep = monthlyDepreciation(cost)
    if (dep == null) missing.push('계약기간')

    if (missing.length > 0) {
      blocked.push({
        inventoryId: invId,
        clientName: cName,
        model: String(m.model_name || ''),
        serial: String(m.serial_number || ''),
        missing,
      })
      continue
    }

    const specs = specsByModel.get(toMachineModelName(String(m.model_name || '')).trim()) || []
    const perPage = specs.length > 0 ? perPageCostOf(specs) : null
    if (perPage) {
      for (const c of perPage.missingLife) noLife.set(c.id, c.model_name)
      for (const c of perPage.missingPrice) zeroPrice.set(c.id, c.model_name)
    }

    const profit = machineProfitOf({
      inventoryId: invId,
      clientId: a.clientId,
      model: String(m.model_name || ''),
      serial: String(m.serial_number || ''),
      department: (m.department as string) || null,
      months: a.settlements.size,
      usage: { bw: a.bw, col: a.col },
      revenue: a.revenue,
      consumableActual: actualByMachine.get(invId) || 0,
      perPage,
      monthlyDep: dep || 0,
      reinstalled: (installCount.get(invId) || 0) > 1,
      serviceLogCount: logCountByMachine.get(invId) || 0,
    })

    if (profit.noServiceLog) {
      noServiceLog.push({ model: profit.model, serial: profit.serial, clientName: cName })
    }
    if (profit.reinstalled) {
      reinstalled.push({ model: profit.model, serial: profit.serial, clientName: cName })
    }

    const key = a.clientId || '-'
    const list = byClient.get(key) || []
    list.push(profit)
    byClient.set(key, list)
  }

  const clientRows: ClientProfit[] = Array.from(byClient.entries())
    .map(([cid, list]) => ({
      clientId: cid,
      clientName: clientName.get(cid) || '(거래처 없음)',
      machines: list.slice().sort((x, y) => x.profitActual - y.profitActual),
      totals: sumProfits(list),
    }))
    .sort((a, b) => a.totals.profitActual - b.totals.profitActual)

  const allMachines = clientRows.flatMap((c) => c.machines)

  return {
    success: true,
    message: 'ok',
    data: {
      settledMonths: new Set((settlements || []).map((s) => s.billing_month)).size,
      clients: clientRows,
      totals: sumProfits(allMachines),
      blocked,
      warnings: {
        zeroPrice: Array.from(zeroPrice, ([id, name]) => ({ id, name })),
        noLife: Array.from(noLife, ([id, name]) => ({ id, name })),
        noServiceLog,
        reinstalled,
      },
    },
  }
}

/** 기간 고르기용 — 정산이 등록된 연도 목록 */
export async function listSettlementYearsAction() {
  const { supabase, orgId, error } = await requireOrg()
  if (error || !orgId) return { success: false, data: [] as number[] }
  const { data } = await supabase
    .from('settlements')
    .select('billing_year')
    .eq('organization_id', orgId)
  const years = Array.from(new Set((data || []).map((r) => r.billing_year))).sort((a, b) => b - a)
  return { success: true, data: years }
}
