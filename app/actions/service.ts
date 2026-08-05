// app/actions/service.ts
'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

type AppSupabase = SupabaseClient<Database, 'public'>
type PartUsage = { consumable_id: string; quantity: number }
type StockStatus = 'none' | 'deducted' | 'pending'
type PartRow = PartUsage & { stock_status: StockStatus }

function revalidateServiceAndInventory() {
  revalidatePath('/service')
  revalidatePath('/inventory')
}

/** 빈 행 제거, 동일 소모품 합산, 양수 정수만 허용 */
function normalizeParts(parts: PartUsage[]): { ok: true; parts: PartUsage[] } | { ok: false; message: string } {
  const merged = new Map<string, number>()

  for (const part of parts || []) {
    if (!part?.consumable_id) continue
    const qty = Number(part.quantity)
    if (!Number.isFinite(qty) || !Number.isInteger(qty) || qty <= 0) {
      return { ok: false, message: '소모품 수량은 1 이상의 정수여야 합니다.' }
    }
    merged.set(part.consumable_id, (merged.get(part.consumable_id) || 0) + qty)
  }

  return {
    ok: true,
    parts: Array.from(merged.entries()).map(([consumable_id, quantity]) => ({ consumable_id, quantity })),
  }
}

/**
 * 완료 저장 시 재고 배분:
 * - 가용분 → deducted (즉시 차감)
 * - 부족분 → pending (가출고, 입고 확정 후 차감)
 * 미완료 → 전부 none
 */
async function planPartsAllocation(
  supabase: AppSupabase,
  orgId: string,
  parts: PartUsage[],
  willBeDone: boolean,
  creditById: Record<string, number> = {}
): Promise<{ ok: true; rows: PartRow[]; toDeduct: PartUsage[]; pendingCount: number } | { ok: false; message: string }> {
  if (parts.length === 0) {
    return { ok: true, rows: [], toDeduct: [], pendingCount: 0 }
  }

  if (!willBeDone) {
    return {
      ok: true,
      rows: parts.map((p) => ({ ...p, stock_status: 'none' as const })),
      toDeduct: [],
      pendingCount: 0,
    }
  }

  const ids = parts.map((p) => p.consumable_id)
  const { data, error } = await supabase
    .from('consumables')
    .select('id, model_name, current_stock, organization_id')
    .in('id', ids)
    .eq('organization_id', orgId)

  if (error) return { ok: false, message: '재고 조회 실패: ' + error.message }

  const byId = new Map((data || []).map((c) => [c.id, c]))
  const rows: PartRow[] = []
  const toDeduct: PartUsage[] = []
  let pendingCount = 0
  // 같은 소모품이 여러 줄로 쪼개질 때 가용 재고를 순차 소비
  const remainingAvail = new Map<string, number>()

  for (const part of parts) {
    const item = byId.get(part.consumable_id)
    if (!item) {
      return { ok: false, message: `알 수 없는 소모품이 포함되어 있습니다.` }
    }
    if (!remainingAvail.has(part.consumable_id)) {
      remainingAvail.set(
        part.consumable_id,
        (item.current_stock ?? 0) + (creditById[part.consumable_id] || 0)
      )
    }
    let avail = remainingAvail.get(part.consumable_id) || 0
    let need = part.quantity

    if (avail >= need) {
      rows.push({ consumable_id: part.consumable_id, quantity: need, stock_status: 'deducted' })
      toDeduct.push({ consumable_id: part.consumable_id, quantity: need })
      remainingAvail.set(part.consumable_id, avail - need)
    } else if (avail > 0) {
      rows.push({ consumable_id: part.consumable_id, quantity: avail, stock_status: 'deducted' })
      toDeduct.push({ consumable_id: part.consumable_id, quantity: avail })
      const pendingQty = need - avail
      rows.push({ consumable_id: part.consumable_id, quantity: pendingQty, stock_status: 'pending' })
      pendingCount += pendingQty
      remainingAvail.set(part.consumable_id, 0)
    } else {
      rows.push({ consumable_id: part.consumable_id, quantity: need, stock_status: 'pending' })
      pendingCount += need
    }
  }

  return { ok: true, rows, toDeduct, pendingCount }
}

function deductedPartsFromRows(
  parts: { consumable_id: string; quantity: number; stock_status?: string | null }[],
  logWasDone: boolean
): PartUsage[] {
  // 컬럼 없으면 undefined → 완료 일지 옛 데이터는 전부 차감된 것으로 간주
  return parts
    .filter((p) => {
      if (!p.consumable_id) return false
      if (p.stock_status === 'deducted') return true
      if (p.stock_status === 'pending' || p.stock_status === 'none') return false
      return logWasDone // legacy
    })
    .map((p) => ({ consumable_id: p.consumable_id, quantity: Number(p.quantity) || 0 }))
    .filter((p) => p.quantity > 0)
}

/** amount > 0 차감(출고), amount < 0 복구(입고). 실패 시 throw */
async function applyStockChange(supabase: AppSupabase, parts: PartUsage[], direction: 'out' | 'in') {
  for (const part of parts) {
    const amount = direction === 'out' ? part.quantity : -part.quantity
    const { error: rpcError } = await supabase.rpc('decrement_stock', {
      row_id: part.consumable_id,
      amount,
    })

    if (!rpcError) continue

    const { data: current, error: readErr } = await supabase
      .from('consumables')
      .select('current_stock, model_name')
      .eq('id', part.consumable_id)
      .single()

    if (readErr || !current) {
      throw new Error(`재고 반영 실패 (${part.consumable_id}): ${rpcError.message}`)
    }

    const next = (current.current_stock ?? 0) - amount
    if (direction === 'out' && next < 0) {
      throw new Error(`재고 부족: ${current.model_name} (현재 ${current.current_stock}, 필요 ${part.quantity})`)
    }

    const { error: updErr } = await supabase
      .from('consumables')
      .update({ current_stock: next })
      .eq('id', part.consumable_id)

    if (updErr) throw new Error(`재고 반영 실패 (${current.model_name}): ${updErr.message}`)
  }
}

function creditMapFromParts(parts: { consumable_id: string; quantity: number }[]): Record<string, number> {
  const map: Record<string, number> = {}
  for (const p of parts) {
    if (!p.consumable_id) continue
    map[p.consumable_id] = (map[p.consumable_id] || 0) + Number(p.quantity || 0)
  }
  return map
}

async function fetchLogWithParts(
  supabase: AppSupabase,
  logId: string,
  orgId: string
): Promise<{ status: string; parts_usage: any[] } | null> {
  const withStatus = await supabase
    .from('service_logs')
    .select('status, parts_usage:service_parts_usage(id, consumable_id, quantity, stock_status)')
    .eq('id', logId)
    .eq('organization_id', orgId)
    .maybeSingle()

  if (!withStatus.error && withStatus.data) {
    return {
      status: withStatus.data.status,
      parts_usage: (withStatus.data as any).parts_usage || [],
    }
  }

  // stock_status 미적용 등 스키마 차이 시 폴백
  const legacy = await supabase
    .from('service_logs')
    .select('status, parts_usage:service_parts_usage(id, consumable_id, quantity)')
    .eq('id', logId)
    .eq('organization_id', orgId)
    .maybeSingle()

  if (legacy.error || !legacy.data) return null
  return {
    status: legacy.data.status,
    parts_usage: (legacy.data as any).parts_usage || [],
  }
}

const SERVICE_LOG_BASE_FIELDS = [
  'client_id',
  'inventory_id',
  'status',
  'service_type',
  'visit_date',
  'symptom',
  'action_detail',
  'memo',
  'meter_bw',
  'meter_col',
  'manager_id',
] as const

const SERVICE_LOG_SPARE_FIELDS = ['spare_stock', 'spare_stock_at'] as const

function pickLogFields(formData: Record<string, any>, keys: readonly string[]) {
  const payload: Record<string, any> = {}
  for (const key of keys) {
    if (!(key in formData)) continue
    let value = formData[key]
    if (value === '') {
      if (
        key === 'inventory_id' ||
        key === 'manager_id' ||
        key === 'spare_stock_at' ||
        key === 'memo' ||
        key === 'spare_stock' ||
        key === 'symptom' ||
        key === 'action_detail'
      ) {
        value = null
      }
    }
    payload[key] = value
  }
  return payload
}

function sanitizeServiceLogPayload(formData: Record<string, any>) {
  return {
    ...pickLogFields(formData, SERVICE_LOG_BASE_FIELDS),
    ...pickLogFields(formData, SERVICE_LOG_SPARE_FIELDS),
  }
}

function isMissingColumnError(error: { message?: string } | null | undefined, column: string) {
  if (!error?.message) return false
  const msg = error.message.toLowerCase()
  return msg.includes(column.toLowerCase()) && (msg.includes('schema cache') || msg.includes('could not find'))
}

/** 기본 필드 먼저 저장. spare_stock 컬럼이 없으면 무시하고 진행 */
async function updateServiceLogRow(
  supabase: AppSupabase,
  logId: string,
  orgId: string,
  formData: Record<string, any>
) {
  const base = pickLogFields(formData, SERVICE_LOG_BASE_FIELDS)
  const spare = pickLogFields(formData, SERVICE_LOG_SPARE_FIELDS)

  let { error } = await supabase
    .from('service_logs')
    .update(base)
    .eq('id', logId)
    .eq('organization_id', orgId)

  // memo 컬럼 미적용 시 제외 후 재시도
  if (error && (isMissingColumnError(error, 'memo') || /memo/i.test(error.message))) {
    const { memo, ...rest } = base
    const retry = await supabase
      .from('service_logs')
      .update(rest)
      .eq('id', logId)
      .eq('organization_id', orgId)
    error = retry.error
  }

  if (error) return error

  if (Object.keys(spare).length > 0) {
    const spareRes = await supabase
      .from('service_logs')
      .update(spare as any)
      .eq('id', logId)
      .eq('organization_id', orgId)

    // 컬럼 없으면 여유재고만 스킵 (일지 수정·이미지 저장은 성공 처리)
    if (spareRes.error && !isMissingColumnError(spareRes.error, 'spare_stock')) {
      return spareRes.error
    }
  }

  return null
}

function buildPartsMessage(base: string, pendingCount: number, deductedQty: number) {
  const bits: string[] = [base]
  if (deductedQty > 0) bits.push(`재고 ${deductedQty}개 차감`)
  if (pendingCount > 0) bits.push(`미입고(가출고) ${pendingCount}개 — 자산·재고에서 입고 확정 시 차감`)
  return bits.join('. ')
}

async function insertPartsRows(
  supabase: AppSupabase,
  logId: string,
  rows: PartRow[]
) {
  if (rows.length === 0) return
  const payload = rows.map((p) => ({
    service_log_id: logId,
    consumable_id: p.consumable_id,
    quantity: p.quantity,
    stock_status: p.stock_status,
  }))
  const { error } = await supabase.from('service_parts_usage').insert(payload as any)
  if (error) {
    // stock_status 컬럼 미적용 환경 폴백
    if (/stock_status/i.test(error.message)) {
      const fallback = rows.map((p) => ({
        service_log_id: logId,
        consumable_id: p.consumable_id,
        quantity: p.quantity,
      }))
      const retry = await supabase.from('service_parts_usage').insert(fallback)
      if (retry.error) throw retry.error
      return
    }
    throw error
  }
}

// 1. 서비스 일지 조회
export async function getServiceLogsAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, data: [] }

  const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
  if (!profile?.organization_id) return { success: false, data: [] }

  const orgId = profile.organization_id! // Non-null assertion added

  // A. 기존 서비스 일지 조회
  const selectWithStatus = `
      *,
      client:clients(name, is_deleted),
      inventory:inventory(id, model_name, serial_number),
      manager:profiles(name),
      parts_usage:service_parts_usage(
        id,
        quantity,
        stock_status,
        consumable:consumables(id, model_name, current_stock)
      ),
      images:service_log_images(id)
    `
  const selectLegacy = `
      *,
      client:clients(name, is_deleted),
      inventory:inventory(id, model_name, serial_number),
      manager:profiles(name),
      parts_usage:service_parts_usage(
        id,
        quantity,
        consumable:consumables(id, model_name, current_stock)
      )
    `

  let { data: logs, error } = await supabase
    .from('service_logs')
    .select(selectWithStatus)
    .eq('organization_id', orgId)
    .order('visit_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error && (/stock_status|service_log_images/i.test(error.message))) {
    const retry = await supabase
      .from('service_logs')
      .select(selectLegacy)
      .eq('organization_id', orgId)
      .order('visit_date', { ascending: false })
      .order('created_at', { ascending: false })
    logs = retry.data
    error = retry.error
  }

  if (error) {
    console.error(error)
    return { success: false, data: [] }
  }

  // A-2. 동일 기기(없으면 거래처) 기준 직전 방문일 계산
  const realLogs = (logs || []).map((l: any) => ({ ...l, images: l.images || [] }))

  // 이미지 개수: embed가 비는 경우가 있어 별도 조회로 보정
  const realIds = realLogs.map((l) => l.id).filter(Boolean)
  if (realIds.length > 0) {
    const { data: imgRows } = await supabase
      .from('service_log_images' as any)
      .select('id, service_log_id')
      .in('service_log_id', realIds)
      .eq('organization_id', orgId)

    if (imgRows && imgRows.length > 0) {
      const byLog = new Map<string, { id: string }[]>()
      for (const row of imgRows as { id: string; service_log_id: string }[]) {
        const list = byLog.get(row.service_log_id) || []
        list.push({ id: row.id })
        byLog.set(row.service_log_id, list)
      }
      for (const log of realLogs) {
        log.images = byLog.get(log.id) || []
      }
    }
  }

  const groups = new Map<string, any[]>()
  for (const log of realLogs) {
    const key = log.inventory_id ? `i:${log.inventory_id}` : `c:${log.client_id}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(log)
  }
  for (const arr of groups.values()) {
    arr.sort((a, b) => {
      const da = a.visit_date || ''
      const db = b.visit_date || ''
      if (da !== db) return da.localeCompare(db)
      return String(a.created_at || '').localeCompare(String(b.created_at || ''))
    })
    for (let i = 0; i < arr.length; i++) {
      arr[i].prev_visit_date = i > 0 ? arr[i - 1].visit_date : null
    }
  }

  // 기기/거래처별 최근 방문일 (미방문 행에 표시)
  const lastVisitByKey = new Map<string, string>()
  for (const [key, arr] of groups) {
    if (arr.length > 0) lastVisitByKey.set(key, arr[arr.length - 1].visit_date)
  }

  // B. 미방문 기계 데이터 생성
  
  // 1. 현재 '설치' 상태인 모든 기계 조회
  const { data: allMachines } = await supabase
    .from('inventory')
    .select(`
      id, 
      model_name, 
      serial_number, 
      status, 
      client_id, 
      client:clients(id, name)
    `)
    .eq('organization_id', orgId)
    .eq('status', '설치')
    .not('client_id', 'is', null)

  // 2. 전체 거래처 목록
  const { data: allClients } = await supabase
    .from('clients')
    .select('id, name')
    .eq('organization_id', orgId)
    .eq('is_deleted', false)

  // 3. 일지가 존재하는 ID 수집
  const inventoryIdsInLogs = new Set(realLogs.map((l: any) => l.inventory_id).filter(Boolean))
  const clientIdsInLogs = new Set(realLogs.map((l: any) => l.client_id))

  // 4. [기계 기준] 미방문 데이터 생성
  const machineDummyLogs = (allMachines || [])
    .filter((m: any) => !inventoryIdsInLogs.has(m.id))
    .map((m: any) => ({
      id: `dummy_machine_${m.id}`,
      organization_id: orgId,
      client_id: m.client_id,
      client: { name: m.client?.name },
      inventory_id: m.id,
      inventory: { 
        id: m.id,
        model_name: m.model_name, 
        serial_number: m.serial_number 
      },
      status: '미방문',
      service_type: '',
      visit_date: '',
      symptom: '',
      action_detail: '',
      memo: '',
      spare_stock: '',
      spare_stock_at: null,
      meter_bw: 0,
      meter_col: 0,
      manager_id: null,
      manager: { name: '' },
      created_at: new Date().toISOString(),
      parts_usage: [],
      prev_visit_date: lastVisitByKey.get(`i:${m.id}`) || null,
    }))

  // 5. [거래처 기준] 기계 없는 거래처의 미방문 데이터 생성
  const clientIdsWithMachines = new Set(allMachines?.map((m: any) => m.client_id))
  
  const clientDummyLogs = (allClients || [])
    .filter((c: any) => 
      !clientIdsInLogs.has(c.id) &&
      !clientIdsWithMachines.has(c.id)
    )
    .map((c: any) => ({
      id: `dummy_client_${c.id}`,
      organization_id: orgId,
      client_id: c.id,
      client: { name: c.name },
      inventory_id: null,
      inventory: null,
      status: '미방문',
      service_type: '',
      visit_date: '',
      symptom: '',
      action_detail: '',
      memo: '',
      spare_stock: '',
      spare_stock_at: null,
      meter_bw: 0,
      meter_col: 0,
      manager_id: null,
      manager: { name: '' },
      created_at: new Date().toISOString(),
      parts_usage: [],
      prev_visit_date: lastVisitByKey.get(`c:${c.id}`) || null,
    }))

  const combinedData = [...realLogs, ...machineDummyLogs, ...clientDummyLogs]

  return { success: true, data: combinedData }
}

export async function deleteServiceLogAction(logId: string) {
  const supabase = await createClient()
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, message: '로그인이 필요합니다.' }

    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
    if (!profile?.organization_id) return { success: false, message: '조직 정보를 찾을 수 없습니다.' }

    const log = await fetchLogWithParts(supabase, logId, profile.organization_id)
    if (!log) return { success: false, message: '일지를 찾을 수 없습니다.' }

    const wasDone = log.status === '완료'
    const toRestore = deductedPartsFromRows((log.parts_usage || []) as any[], wasDone)

    // 완료된 건 중 이미 차감된 분만 복구 (미입고 pending은 복구 불필요)
    if (toRestore.length > 0) {
      await applyStockChange(supabase, toRestore, 'in')
    }

    await supabase.from('service_parts_usage').delete().eq('service_log_id', logId)
    const { error } = await supabase.from('service_logs').delete().eq('id', logId)
    if (error) throw error

    revalidateServiceAndInventory()
    return { success: true, message: '삭제되었습니다. 차감됐던 재고가 있으면 복구되었습니다.' }
  } catch (e: any) {
    return { success: false, message: '삭제 실패: ' + e.message }
  }
}

/** 인라인 셀 수정용 — 단순 필드만 패치 (부품/재고 로직은 status 변경 시에만 처리) */
export async function patchServiceLogAction(
  logId: string,
  fields: Record<string, string | number | null>
) {
  const supabase = await createClient()
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, message: '로그인이 필요합니다.' }

    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
    if (!profile?.organization_id) return { success: false, message: '조직 정보를 찾을 수 없습니다.' }
    const orgId = profile.organization_id

    const allowed = [
      'status', 'service_type', 'visit_date', 'symptom', 'action_detail', 'memo',
      'manager_id', 'inventory_id', 'meter_bw', 'meter_col', 'client_id',
      'spare_stock', 'spare_stock_at',
    ] as const

    const payload: Record<string, string | number | null> = {}
    for (const key of allowed) {
      if (key in fields) payload[key] = fields[key]
    }
    if (Object.keys(payload).length === 0) {
      return { success: false, message: '수정할 필드가 없습니다.' }
    }

    let stockTouched = false

    // 상태 변경 시 재고 롤백/재배분
    if ('status' in payload) {
      const oldLog = await fetchLogWithParts(supabase, logId, orgId)
      if (!oldLog) return { success: false, message: '일지를 찾을 수 없습니다.' }

      const wasDone = oldLog.status === '완료'
      const willBeDone = payload.status === '완료'
      const oldRows = oldLog.parts_usage || []

      if (!wasDone && willBeDone && oldRows.length > 0) {
        const normalized = normalizeParts(oldRows as PartUsage[])
        if (!normalized.ok) return { success: false, message: normalized.message }
        const plan = await planPartsAllocation(supabase, orgId, normalized.parts, true, {})
        if (!plan.ok) return { success: false, message: plan.message }

        await supabase.from('service_parts_usage').delete().eq('service_log_id', logId)
        await insertPartsRows(supabase, logId, plan.rows)
        if (plan.toDeduct.length > 0) {
          await applyStockChange(supabase, plan.toDeduct, 'out')
        }
        stockTouched = true
      } else if (wasDone && !willBeDone && oldRows.length > 0) {
        const toRestore = deductedPartsFromRows(oldRows, true)
        if (toRestore.length > 0) {
          await applyStockChange(supabase, toRestore, 'in')
        }
        await supabase
          .from('service_parts_usage')
          .update({ stock_status: 'none' } as any)
          .eq('service_log_id', logId)
        stockTouched = true
      }
    }

    const updateError = await updateServiceLogRow(supabase, logId, orgId, payload)
    if (updateError) throw updateError

    if (stockTouched) revalidateServiceAndInventory()
    else revalidatePath('/service')
    return { success: true, message: '저장되었습니다.' }
  } catch (e: any) {
    return { success: false, message: '수정 실패: ' + e.message }
  }
}

export async function updateServiceLogAction(logId: string, formData: any, parts: any[]) {
  const supabase = await createClient()
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, message: '로그인이 필요합니다.' }

    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
    if (!profile?.organization_id) return { success: false, message: '조직 정보를 찾을 수 없습니다.' }
    const orgId = profile.organization_id

    if (!logId || String(logId).startsWith('dummy_')) {
      return { success: false, message: '저장되지 않은 일지입니다. 먼저 표에서 저장해 주세요.' }
    }

    const normalized = normalizeParts(parts || [])
    if (!normalized.ok) return { success: false, message: normalized.message }
    const nextParts = normalized.parts

    const oldLog = await fetchLogWithParts(supabase, logId, orgId)
    if (!oldLog) return { success: false, message: '일지를 찾을 수 없습니다.' }

    const oldRows = oldLog.parts_usage || []
    const wasDone = oldLog.status === '완료'
    const willBeDone = formData.status === '완료'
    const oldDeducted = deductedPartsFromRows(oldRows, wasDone)

    const plan = await planPartsAllocation(
      supabase,
      orgId,
      nextParts,
      willBeDone,
      wasDone ? creditMapFromParts(oldDeducted) : {}
    )
    if (!plan.ok) return { success: false, message: plan.message }

    if (oldDeducted.length > 0) {
      await applyStockChange(supabase, oldDeducted, 'in')
    }

    const updateError = await updateServiceLogRow(supabase, logId, orgId, formData)
    if (updateError) throw updateError

    await supabase.from('service_parts_usage').delete().eq('service_log_id', logId)
    await insertPartsRows(supabase, logId, plan.rows)

    if (plan.toDeduct.length > 0) {
      await applyStockChange(supabase, plan.toDeduct, 'out')
    }

    const deductedQty = plan.toDeduct.reduce((s, p) => s + p.quantity, 0)
    revalidateServiceAndInventory()
    return {
      success: true,
      id: logId,
      message: buildPartsMessage('수정되었습니다', plan.pendingCount, deductedQty),
    }
  } catch (e: any) {
    return { success: false, message: '수정 실패: ' + e.message }
  }
}

export async function createServiceLogAction(formData: any, parts: { consumable_id: string; quantity: number }[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: '로그인 필요' }
  const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
  if (!profile?.organization_id) return { success: false, message: '조직 정보 없음' }

  const orgId = profile.organization_id

  try {
    const normalized = normalizeParts(parts || [])
    if (!normalized.ok) return { success: false, message: normalized.message }
    const nextParts = normalized.parts

    const plan = await planPartsAllocation(
      supabase,
      orgId,
      nextParts,
      formData.status === '완료',
      {}
    )
    if (!plan.ok) return { success: false, message: plan.message }

    const { data: logData, error: logError } = await supabase
      .from('service_logs')
      .insert({ ...pickLogFields(formData, SERVICE_LOG_BASE_FIELDS), organization_id: orgId })
      .select()
      .single()

    if (logError) {
      if (isMissingColumnError(logError, 'memo') || /memo/i.test(logError.message)) {
        const { memo, ...rest } = pickLogFields(formData, SERVICE_LOG_BASE_FIELDS)
        const retry = await supabase
          .from('service_logs')
          .insert({ ...rest, organization_id: orgId })
          .select()
          .single()
        if (retry.error) throw new Error(retry.error.message)
        await insertPartsRows(supabase, retry.data.id, plan.rows)
        if (plan.toDeduct.length > 0) await applyStockChange(supabase, plan.toDeduct, 'out')
        // spare 컬럼 있으면 별도 갱신
        const spare = pickLogFields(formData, SERVICE_LOG_SPARE_FIELDS)
        if (Object.keys(spare).length > 0) {
          await supabase.from('service_logs').update(spare as any).eq('id', retry.data.id)
        }
        const deductedQty = plan.toDeduct.reduce((s, p) => s + p.quantity, 0)
        revalidateServiceAndInventory()
        return {
          success: true,
          id: retry.data.id,
          message: buildPartsMessage('서비스 일지가 등록되었습니다', plan.pendingCount, deductedQty),
        }
      }
      throw new Error(logError.message)
    }

    const spare = pickLogFields(formData, SERVICE_LOG_SPARE_FIELDS)
    if (Object.keys(spare).length > 0) {
      const spareRes = await supabase
        .from('service_logs')
        .update(spare as any)
        .eq('id', logData.id)
      // 컬럼 없으면 무시
      if (spareRes.error && !isMissingColumnError(spareRes.error, 'spare_stock')) {
        console.warn('spare_stock 저장 스킵:', spareRes.error.message)
      }
    }

    await insertPartsRows(supabase, logData.id, plan.rows)

    if (plan.toDeduct.length > 0) {
      await applyStockChange(supabase, plan.toDeduct, 'out')
    }

    const deductedQty = plan.toDeduct.reduce((s, p) => s + p.quantity, 0)
    revalidateServiceAndInventory()
    return {
      success: true,
      id: logData.id,
      message: buildPartsMessage('서비스 일지가 등록되었습니다', plan.pendingCount, deductedQty),
    }
  } catch (e: any) {
    return { success: false, message: e.message }
  }
}

export async function getConsumablesAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
  if (!profile?.organization_id) return []

  // 재고 0도 목록에 보여 주고, 선택 시 부족 알림으로 막음
  const { data } = await supabase
    .from('consumables')
    .select('*')
    .eq('organization_id', profile.organization_id)
    .order('model_name')
  return data || []
}

export async function getClientMachinesAction(clientId: string) {
  const supabase = await createClient()
  if (!clientId) return []
  const { data } = await supabase.from('inventory').select('id, model_name, serial_number').eq('client_id', clientId).eq('status', '설치')
  return data || []
}

export async function getEmployeesAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
  if (!profile?.organization_id) return []
  const { data } = await supabase
    .from('profiles')
    .select('id, name')
    .eq('organization_id', profile.organization_id!)
    .or('is_deleted.is.null,is_deleted.eq.false')
    .order('name', { ascending: true })
  return data || []
}

/** 토너/드럼 K·C·M·Y (재생) 표준 품목 확보 — 없으면 재고 0으로 생성 */
export async function ensureTonerDrumConsumableAction(input: {
  category: '토너' | '드럼'
  color: 'K' | 'C' | 'M' | 'Y'
  is_regenerated: boolean
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false as const, message: '로그인 필요' }

  const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
  if (!profile?.organization_id) return { success: false as const, message: '조직 정보 없음' }
  const orgId = profile.organization_id

  const modelName = input.is_regenerated
    ? `${input.category} ${input.color} 재생`
    : `${input.category} ${input.color}`

  const { data: existing } = await supabase
    .from('consumables')
    .select('*')
    .eq('organization_id', orgId)
    .eq('category', input.category)
    .eq('model_name', modelName)
    .maybeSingle()

  if (existing) {
    return { success: true as const, data: existing, created: false }
  }

  const basePayload = {
    organization_id: orgId,
    category: input.category,
    model_name: modelName,
    code: `${input.category}-${input.color}${input.is_regenerated ? '-R' : ''}`,
    current_stock: 0,
    unit_price: 0,
  }

  const withFlags = {
    ...basePayload,
    color: input.color,
    is_regenerated: input.is_regenerated,
  }

  let { data: created, error } = await supabase
    .from('consumables')
    .insert(withFlags as any)
    .select()
    .single()

  if (error) {
    const retry = await supabase.from('consumables').insert(basePayload as any).select().single()
    created = retry.data
    error = retry.error
  }

  if (error || !created) {
    return { success: false as const, message: error?.message || '소모품 생성 실패' }
  }

  revalidatePath('/inventory')
  return { success: true as const, data: created, created: true }
}

/** 일지의 부품 사용만 갱신 (교체/배송 팝업) */
export async function updateServicePartsAction(
  logId: string,
  parts: { consumable_id: string; quantity: number }[]
) {
  const supabase = await createClient()
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, message: '로그인이 필요합니다.' }

    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
    if (!profile?.organization_id) return { success: false, message: '조직 정보를 찾을 수 없습니다.' }
    const orgId = profile.organization_id

    const { data: oldLogRaw } = await supabase
      .from('service_logs')
      .select('id, status')
      .eq('id', logId)
      .eq('organization_id', orgId)
      .maybeSingle()

    if (!oldLogRaw) return { success: false, message: '일지를 찾을 수 없습니다.' }

    const oldLog = await fetchLogWithParts(supabase, logId, orgId)
    if (!oldLog) return { success: false, message: '일지를 찾을 수 없습니다.' }

    const normalized = normalizeParts(parts || [])
    if (!normalized.ok) return { success: false, message: normalized.message }
    const nextParts = normalized.parts

    const oldRows = oldLog.parts_usage || []
    const wasDone = oldLog.status === '완료'
    const oldDeducted = deductedPartsFromRows(oldRows, wasDone)

    const plan = await planPartsAllocation(
      supabase,
      orgId,
      nextParts,
      wasDone,
      wasDone ? creditMapFromParts(oldDeducted) : {}
    )
    if (!plan.ok) return { success: false, message: plan.message }

    if (oldDeducted.length > 0) {
      await applyStockChange(supabase, oldDeducted, 'in')
    }

    await supabase.from('service_parts_usage').delete().eq('service_log_id', logId)
    await insertPartsRows(supabase, logId, plan.rows)

    if (plan.toDeduct.length > 0) {
      await applyStockChange(supabase, plan.toDeduct, 'out')
    }

    const deductedQty = plan.toDeduct.reduce((s, p) => s + p.quantity, 0)
    revalidateServiceAndInventory()
    return {
      success: true,
      message: buildPartsMessage('부품이 저장되었습니다', plan.pendingCount, deductedQty),
    }
  } catch (e: any) {
    return { success: false, message: e.message || '저장 실패' }
  }
}

export async function listServiceImagesAction(logId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
  if (!profile?.organization_id) return []

  const { data, error } = await supabase
    .from('service_log_images' as any)
    .select('*')
    .eq('service_log_id', logId)
    .eq('organization_id', profile.organization_id)
    .order('created_at', { ascending: true })

  if (error) {
    console.warn('service_log_images 조회 실패(테이블 미생성 가능):', error.message)
    return []
  }
  return data || []
}

export async function registerServiceImageAction(input: {
  service_log_id: string
  storage_path: string
  file_name: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: '로그인 필요' }
  const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
  if (!profile?.organization_id) return { success: false, message: '조직 정보 없음' }

  const { data, error } = await supabase
    .from('service_log_images' as any)
    .insert({
      organization_id: profile.organization_id,
      service_log_id: input.service_log_id,
      storage_path: input.storage_path,
      file_name: input.file_name,
    })
    .select()
    .single()

  if (error) return { success: false, message: error.message }
  revalidatePath('/service')
  return { success: true, data }
}

export async function deleteServiceImageAction(imageId: string, storagePath?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: '로그인 필요' }
  const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
  if (!profile?.organization_id) return { success: false, message: '조직 정보 없음' }

  if (storagePath) {
    await supabase.storage.from('service-attachments').remove([storagePath])
  }

  const { error } = await supabase
    .from('service_log_images' as any)
    .delete()
    .eq('id', imageId)
    .eq('organization_id', profile.organization_id)

  if (error) return { success: false, message: error.message }
  revalidatePath('/service')
  return { success: true }
}

/** 브라우저 업로드용 조직 ID */
export async function getMyOrgIdAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
  return profile?.organization_id || null
}

/** 미입고(가출고) 대기 목록 */
export async function getPendingPartsAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, data: [] as any[], message: '로그인 필요' }

  const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
  if (!profile?.organization_id) return { success: false, data: [] as any[], message: '조직 없음' }

  const { data, error } = await supabase
    .from('service_parts_usage')
    .select(`
      id,
      quantity,
      stock_status,
      consumable_id,
      consumable:consumables(id, model_name, category, current_stock, code),
      service_log:service_logs(id, visit_date, status, client:clients(name))
    `)
    .eq('stock_status', 'pending')
    .order('created_at', { ascending: true })

  if (error) {
    // 컬럼 미적용 시 빈 목록
    if (/stock_status/i.test(error.message)) {
      return { success: true, data: [], message: 'stock_status 컬럼이 없습니다. SQL을 실행하세요.' }
    }
    return { success: false, data: [], message: error.message }
  }

  // 조직 필터 (조인으로 한 번에 못 걸 수 있어 클라이언트 측 보강)
  const orgId = profile.organization_id
  const { data: orgLogs } = await supabase
    .from('service_logs')
    .select('id')
    .eq('organization_id', orgId)
  const logIds = new Set((orgLogs || []).map((l) => l.id))
  const filtered = (data || []).filter((row: any) => logIds.has(row.service_log?.id || row.service_log_id))

  return { success: true, data: filtered, message: '' }
}

/**
 * 미입고 확정: 현재 재고에서 차감 후 pending → deducted
 * usageIds 없으면 해당 소모품의 pending 전부 (consumableId 지정 시)
 */
export async function confirmPendingPartsAction(input: {
  usageIds?: string[]
  consumableId?: string
}) {
  const supabase = await createClient()
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, message: '로그인 필요' }
    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
    if (!profile?.organization_id) return { success: false, message: '조직 없음' }
    const orgId = profile.organization_id

    let query = supabase
      .from('service_parts_usage')
      .select(`
        id, quantity, consumable_id, stock_status,
        service_log:service_logs!inner(id, organization_id, status)
      `)
      .eq('stock_status', 'pending')
      .eq('service_log.organization_id', orgId)

    if (input.usageIds && input.usageIds.length > 0) {
      query = query.in('id', input.usageIds)
    } else if (input.consumableId) {
      query = query.eq('consumable_id', input.consumableId)
    } else {
      return { success: false, message: '확정할 항목을 지정해주세요.' }
    }

    const { data: rows, error } = await query
    if (error) return { success: false, message: error.message }
    if (!rows || rows.length === 0) {
      return { success: false, message: '확정할 미입고 항목이 없습니다.' }
    }

    // 소모품별 필요 수량 합산 후 재고 확인
    const needById = new Map<string, number>()
    for (const row of rows as any[]) {
      needById.set(row.consumable_id, (needById.get(row.consumable_id) || 0) + Number(row.quantity))
    }

    const ids = Array.from(needById.keys())
    const { data: stocks } = await supabase
      .from('consumables')
      .select('id, model_name, current_stock')
      .in('id', ids)
      .eq('organization_id', orgId)

    const stockMap = new Map((stocks || []).map((c) => [c.id, c]))
    const shortages: string[] = []
    for (const [id, need] of needById) {
      const item = stockMap.get(id)
      const avail = item?.current_stock ?? 0
      if (avail < need) {
        shortages.push(`${item?.model_name || id}: 재고 ${avail} / 필요 ${need}`)
      }
    }
    if (shortages.length > 0) {
      return {
        success: false,
        message: `재고가 부족해 입고 확정할 수 없습니다.\n${shortages.join('\n')}\n\n먼저 자산·재고에서 수량을 늘린 뒤 다시 확정하세요.`,
      }
    }

    const toDeduct: PartUsage[] = Array.from(needById.entries()).map(([consumable_id, quantity]) => ({
      consumable_id,
      quantity,
    }))
    await applyStockChange(supabase, toDeduct, 'out')

    const rowIds = (rows as any[]).map((r) => r.id)
    const { error: updErr } = await supabase
      .from('service_parts_usage')
      .update({ stock_status: 'deducted' } as any)
      .in('id', rowIds)

    if (updErr) throw new Error(updErr.message)

    revalidateServiceAndInventory()
    const total = toDeduct.reduce((s, p) => s + p.quantity, 0)
    return {
      success: true,
      message: `미입고 ${total}개를 확정하고 재고에서 차감했습니다.`,
    }
  } catch (e: any) {
    return { success: false, message: e.message || '확정 실패' }
  }
}