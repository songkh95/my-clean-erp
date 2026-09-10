'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { Client } from '@/app/types'
import { toMachineModelName } from '@/utils/suggestMatch'

async function requireOrg() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, error: '로그인이 필요합니다.' as string, orgId: null as string | null, userId: null as string | null }
  const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
  if (!profile?.organization_id) return { supabase, error: '조직 정보를 찾을 수 없습니다.', orgId: null, userId: user.id }
  return { supabase, error: null, orgId: profile.organization_id as string, userId: user.id }
}

export async function createClientAction(data: Partial<Client>) {
  const { supabase, error: authErr, orgId } = await requireOrg()
  if (authErr || !orgId) return { success: false, message: authErr || '조직 정보 없음', clientId: null as string | null }

  try {
    if (!data.name) {
      return { success: false, message: '거래처명을 입력해주세요.', clientId: null }
    }

    const { id, created_at, updated_at, ...rest } = data

    const payload = {
      ...rest,
      name: data.name,
      organization_id: orgId,
      is_deleted: false,
      status: data.status || 'active',
    }

    const { data: created, error } = await supabase
      .from('clients')
      .insert(payload)
      .select('id')
      .single()

    if (error) throw error

    revalidatePath('/clients')
    return { success: true, message: '거래처가 등록되었습니다.', clientId: created.id as string }
  } catch (e: any) {
    return { success: false, message: '등록 실패: ' + e.message, clientId: null }
  }
}

export async function updateClientAction(id: string, data: Partial<Client>) {
  const { supabase, error: authErr, orgId } = await requireOrg()
  if (authErr || !orgId) return { success: false, message: authErr || '조직 정보 없음' }

  try {
    const { id: _, organization_id, created_at, ...updateData } = data

    // 주소가 바뀌면 지도 좌표 캐시 초기화
    if ('address' in updateData) {
      const { data: prev } = await supabase
        .from('clients')
        .select('address')
        .eq('id', id)
        .eq('organization_id', orgId)
        .maybeSingle()
      const nextAddr = String(updateData.address ?? '').trim()
      const prevAddr = String(prev?.address ?? '').trim()
      if (nextAddr !== prevAddr) {
        ;(updateData as any).map_lat = null
        ;(updateData as any).map_lng = null
      }
    }

    const { error } = await supabase
      .from('clients')
      .update(updateData)
      .eq('id', id)
      .eq('organization_id', orgId)
    if (error) throw error

    revalidatePath('/clients')
    revalidatePath('/')
    return { success: true, message: '수정되었습니다.' }
  } catch (e: any) {
    return { success: false, message: '수정 실패: ' + e.message }
  }
}

export async function deleteClientAction(id: string) {
  const { supabase, error: authErr, orgId } = await requireOrg()
  if (authErr || !orgId) return { success: false, message: authErr || '조직 정보 없음' }

  try {
    // 실제 등록된 서비스 일지 여부 (더미/미방문 행은 DB에 없음)
    const { count, error: countErr } = await supabase
      .from('service_logs')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('client_id', id)

    if (countErr) throw countErr

    // H1: 거래처를 지워도 연결된 기기가 남는 문제 방지 — 삭제 전 창고로 회수
    const { data: linkedMachines, error: machErr } = await supabase
      .from('inventory')
      .select('id')
      .eq('organization_id', orgId)
      .eq('client_id', id)

    if (machErr) throw machErr

    let recalled = 0
    if (linkedMachines && linkedMachines.length > 0) {
      const machineIds = linkedMachines.map((m) => m.id)
      const { error: recallErr } = await supabase
        .from('inventory')
        .update({ status: '창고', client_id: null })
        .in('id', machineIds)
        .eq('organization_id', orgId)
      if (recallErr) throw recallErr

      const { error: histErr } = await supabase.from('machine_history').insert(
        machineIds.map((invId) => ({
          inventory_id: invId,
          client_id: id,
          organization_id: orgId,
          action_type: 'WITHDRAW',
          bw_count: 0,
          col_count: 0,
          bw_a3_count: 0,
          col_a3_count: 0,
          memo: '거래처 삭제로 자동 회수',
          is_replacement: false,
          recorded_at: new Date().toISOString(),
        }))
      )
      if (histErr) throw histErr

      recalled = machineIds.length
    }

    const { error } = await supabase
      .from('clients')
      .update({ is_deleted: true })
      .eq('id', id)
      .eq('organization_id', orgId)
    if (error) throw error

    revalidatePath('/clients')
    revalidatePath('/service')
    revalidatePath('/inventory')

    const parts = ['삭제되었습니다.']
    if (recalled > 0) parts.push(`연결된 기기 ${recalled}대는 창고로 회수되었습니다.`)
    if ((count || 0) > 0) {
      parts.push(`서비스 일지 ${count}건은 그대로 유지되며, 일지에서 거래처명 옆에 경고가 표시됩니다.`)
    } else {
      parts.push('(등록된 서비스 일지 없음)')
    }

    return { success: true, message: parts.join(' ') }
  } catch (e: any) {
    return { success: false, message: '삭제 실패: ' + e.message }
  }
}

/** 창고 대기 중인 기계 목록 (거래처에 연결 가능) */
export async function getWarehouseMachinesAction(search?: string) {
  const { supabase, error: authErr, orgId } = await requireOrg()
  if (authErr || !orgId) return { success: false, data: [] as any[], message: authErr }

  let query = supabase
    .from('inventory')
    .select('id, type, category, brand, model_name, serial_number, status, billing_date, plan_basic_fee')
    .eq('organization_id', orgId)
    .eq('status', '창고')
    .eq('is_deleted', false)
    .order('model_name')

  const { data, error } = await query
  if (error) return { success: false, data: [], message: error.message }

  let rows = data || []
  const q = (search || '').trim().toLowerCase()
  if (q) {
    rows = rows.filter((m) =>
      (m.model_name || '').toLowerCase().includes(q) ||
      (m.serial_number || '').toLowerCase().includes(q) ||
      (m.brand || '').toLowerCase().includes(q) ||
      (m.type || '').toLowerCase().includes(q)
    )
  }

  return { success: true, data: rows }
}

/** 거래처에 이미 설치된 기계 */
export async function getClientInstalledMachinesAction(clientId: string) {
  const { supabase, error: authErr, orgId } = await requireOrg()
  if (authErr || !orgId) return { success: false, data: [] as any[] }
  if (!clientId) return { success: true, data: [] }

  const { data, error } = await supabase
    .from('inventory')
    .select('*')
    .eq('organization_id', orgId)
    .eq('client_id', clientId)
    .eq('is_deleted', false)
    .order('model_name')

  if (error) return { success: false, data: [] }
  return { success: true, data: data || [] }
}

export type NewMachineDraft = {
  type: string
  category: string
  brand?: string
  model_name: string
  serial_number: string
  department?: string
  billing_date?: string
  plan_basic_fee?: number
  initial_count_bw?: number
  initial_count_col?: number
  initial_count_bw_a3?: number
  initial_count_col_a3?: number
}

/**
 * 창고 기계 연결 + 신규 기계 생성 후 거래처에 설치
 */
export async function attachMachinesToClientAction(
  clientId: string,
  warehouseMachineIds: string[],
  newMachines: NewMachineDraft[] = []
) {
  const { supabase, error: authErr, orgId } = await requireOrg()
  if (authErr || !orgId) return { success: false, message: authErr || '조직 정보 없음' }

  try {
    const { data: client, error: cErr } = await supabase
      .from('clients')
      .select('id, name')
      .eq('id', clientId)
      .eq('organization_id', orgId)
      .eq('is_deleted', false)
      .single()

    if (cErr || !client) return { success: false, message: '거래처를 찾을 수 없습니다.' }

    const ids = Array.from(new Set((warehouseMachineIds || []).filter(Boolean)))
    let assigned = 0
    let created = 0

    if (ids.length > 0) {
      const { data: machines, error: mErr } = await supabase
        .from('inventory')
        .select('id, status, client_id, model_name, serial_number, initial_count_bw, initial_count_col, initial_count_bw_a3, initial_count_col_a3')
        .eq('organization_id', orgId)
        .eq('is_deleted', false)
        .in('id', ids)

      if (mErr) throw mErr

      for (const m of machines || []) {
        if (m.status !== '창고') {
          return {
            success: false,
            message: `${m.model_name}(${m.serial_number})는 창고 상태가 아니어서 연결할 수 없습니다.`,
          }
        }
        if (m.client_id) {
          return {
            success: false,
            message: `${m.model_name}(${m.serial_number})는 이미 다른 거래처에 연결되어 있습니다.`,
          }
        }

        const { error: uErr } = await supabase
          .from('inventory')
          .update({
            status: '설치',
            client_id: clientId,
            contract_start_date: new Date().toISOString().split('T')[0],
          })
          .eq('id', m.id)
          .eq('organization_id', orgId)

        if (uErr) throw uErr

        const { error: hErr } = await supabase.from('machine_history').insert({
          inventory_id: m.id,
          client_id: clientId,
          organization_id: orgId,
          action_type: 'INSTALL',
          bw_count: m.initial_count_bw || 0,
          col_count: m.initial_count_col || 0,
          bw_a3_count: m.initial_count_bw_a3 || 0,
          col_a3_count: m.initial_count_col_a3 || 0,
          memo: `거래처 등록/수정 시 창고 기기 연결 (${client.name})`,
          is_replacement: false,
          recorded_at: new Date().toISOString(),
        })
        if (hErr) throw hErr
        assigned += 1
      }
    }

    for (const draft of newMachines || []) {
      const modelName = toMachineModelName(draft.model_name || '')
      if (!modelName || !draft.serial_number?.trim() || !draft.type || !draft.category) {
        return { success: false, message: '신규 기기는 종류·구분·모델명(영문 대문자)·S/N이 필요합니다.' }
      }

      const { data: existingSn } = await supabase
        .from('inventory')
        .select('id')
        .eq('organization_id', orgId)
        .eq('serial_number', draft.serial_number.trim())
        .maybeSingle()

      if (existingSn) {
        return { success: false, message: `이미 등록된 S/N입니다: ${draft.serial_number}` }
      }

      const { data: inserted, error: iErr } = await supabase
        .from('inventory')
        .insert({
          organization_id: orgId,
          type: draft.type,
          category: draft.category,
          brand: draft.brand || '',
          model_name: modelName,
          serial_number: draft.serial_number.trim(),
          status: '설치',
          client_id: clientId,
          department: draft.department?.trim() || null,
          product_condition: '새제품',
          billing_date: draft.billing_date || '말일',
          plan_basic_fee: draft.plan_basic_fee ?? 0,
          plan_basic_cnt_bw: 1000,
          plan_basic_cnt_col: 100,
          plan_price_bw: 10,
          plan_price_col: 100,
          plan_weight_a3_bw: 1,
          plan_weight_a3_col: 2,
          initial_count_bw: draft.initial_count_bw ?? 0,
          initial_count_col: draft.initial_count_col ?? 0,
          initial_count_bw_a3: draft.initial_count_bw_a3 ?? 0,
          initial_count_col_a3: draft.initial_count_col_a3 ?? 0,
          contract_start_date: new Date().toISOString().split('T')[0],
          purchase_date: new Date().toISOString().split('T')[0],
          purchase_price: 0,
        })
        .select('id')
        .single()

      if (iErr || !inserted) throw iErr || new Error('신규 기기 등록 실패')

      const { error: hErr } = await supabase.from('machine_history').insert({
        inventory_id: inserted.id,
        client_id: clientId,
        organization_id: orgId,
        action_type: 'INSTALL',
        bw_count: draft.initial_count_bw ?? 0,
        col_count: draft.initial_count_col ?? 0,
        bw_a3_count: draft.initial_count_bw_a3 ?? 0,
        col_a3_count: draft.initial_count_col_a3 ?? 0,
        memo: `거래처 등록/수정 시 신규 기기 설치 (${client.name})`,
        is_replacement: false,
        recorded_at: new Date().toISOString(),
      })
      if (hErr) throw hErr
      created += 1
    }

    revalidatePath('/clients')
    revalidatePath('/inventory')
    revalidatePath('/service')

    const parts: string[] = []
    if (assigned) parts.push(`창고 연결 ${assigned}대`)
    if (created) parts.push(`신규 등록 ${created}대`)
    return {
      success: true,
      message: parts.length > 0 ? `기계 반영: ${parts.join(', ')}` : '연결된 기계 변경 없음',
    }
  } catch (e: any) {
    return { success: false, message: e.message || '기계 연결 실패' }
  }
}

/** 홈 지도 지오코딩 결과를 거래처에 저장 (다음 로드 시 즉시 표시) */
export async function saveClientMapCoordsAction(
  points: { id: string; lat: number; lng: number }[]
) {
  const { supabase, error: authErr, orgId } = await requireOrg()
  if (authErr || !orgId) return { success: false, message: authErr || '조직 정보 없음', saved: 0 }

  const rows = (points || []).filter(
    (p) => p?.id && Number.isFinite(p.lat) && Number.isFinite(p.lng)
  )
  if (rows.length === 0) return { success: true, message: '저장할 좌표 없음', saved: 0 }

  let saved = 0
  const errors: string[] = []
  for (const p of rows) {
    const { error } = await supabase
      .from('clients')
      .update({ map_lat: p.lat, map_lng: p.lng })
      .eq('id', p.id)
      .eq('organization_id', orgId)
      .eq('is_deleted', false)
    if (error) {
      if (/map_lat|map_lng|schema cache/i.test(error.message)) {
        return {
          success: false,
          message: 'map_lat/map_lng 컬럼이 없습니다. sql/add_client_map_coords.sql 을 실행하세요.',
          saved,
        }
      }
      errors.push(error.message)
      continue
    }
    saved += 1
  }

  return {
    success: true,
    message: `지도 좌표 ${saved}건 저장`,
    saved,
    errors: errors.slice(0, 5),
  }
}
