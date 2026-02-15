// app/actions/service.ts
'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

// 1. 서비스 일지 조회
export async function getServiceLogsAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, data: [] }

  const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
  if (!profile?.organization_id) return { success: false, data: [] }

  const orgId = profile.organization_id! // Non-null assertion added

  // A. 기존 서비스 일지 조회
  const { data: logs, error } = await supabase
    .from('service_logs')
    .select(`
      *,
      client:clients(name),
      inventory:inventory(id, model_name, serial_number),
      manager:profiles(name),
      parts_usage:service_parts_usage(
        quantity,
        consumable:consumables(id, model_name, current_stock)
      )
    `)
    .eq('organization_id', orgId)
    .order('visit_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    console.error(error)
    return { success: false, data: [] }
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
  const inventoryIdsInLogs = new Set(logs?.map((l: any) => l.inventory_id).filter(Boolean))
  const clientIdsInLogs = new Set(logs?.map((l: any) => l.client_id))

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
      service_type: '-',
      visit_date: '-',
      symptom: '-',
      action_detail: '-',
      meter_bw: 0,
      meter_col: 0,
      manager_id: null,
      manager: { name: '-' },
      created_at: new Date().toISOString(),
      parts_usage: []
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
      service_type: '-',
      visit_date: '-',
      symptom: '-',
      action_detail: '-',
      meter_bw: 0,
      meter_col: 0,
      manager_id: null,
      manager: { name: '-' },
      created_at: new Date().toISOString(),
      parts_usage: []
    }))

  const combinedData = [...(logs || []), ...machineDummyLogs, ...clientDummyLogs]

  return { success: true, data: combinedData }
}

export async function deleteServiceLogAction(logId: string) {
  const supabase = await createClient()
  try {
    const { data: log } = await supabase.from('service_logs').select('status, parts_usage:service_parts_usage(consumable_id, quantity)').eq('id', logId).single()
    
    // 완료된 건 삭제 시 재고 복구 (Rollback)
    if (log && log.status === '완료' && log.parts_usage) {
      for (const part of log.parts_usage as any[]) {
        await supabase.rpc('decrement_stock', { row_id: part.consumable_id, amount: -part.quantity })
      }
    }
    const { error } = await supabase.from('service_logs').delete().eq('id', logId)
    if (error) throw error
    revalidatePath('/service')
    return { success: true, message: '삭제되었습니다.' }
  } catch (e: any) {
    return { success: false, message: '삭제 실패: ' + e.message }
  }
}

export async function updateServiceLogAction(logId: string, formData: any, parts: any[]) {
  const supabase = await createClient()
  try {
    // 1. 기존 상태 확인 및 재고 복구
    const { data: oldLog } = await supabase.from('service_logs').select('status, parts_usage:service_parts_usage(consumable_id, quantity)').eq('id', logId).single()
    if (oldLog && oldLog.status === '완료') {
      for (const part of oldLog.parts_usage as any[]) {
        await supabase.rpc('decrement_stock', { row_id: part.consumable_id, amount: -part.quantity })
      }
    }
    
    // 2. 정보 업데이트
    const { error: updateError } = await supabase.from('service_logs').update(formData).eq('id', logId)
    if (updateError) throw updateError
    
    // 3. 부품 내역 갱신
    await supabase.from('service_parts_usage').delete().eq('service_log_id', logId)
    if (parts.length > 0) {
      const partsPayload = parts.map(p => ({ service_log_id: logId, consumable_id: p.consumable_id, quantity: p.quantity }))
      await supabase.from('service_parts_usage').insert(partsPayload)
      
      // 4. 완료 상태면 재고 차감
      if (formData.status === '완료') {
        for (const p of parts) {
          await supabase.rpc('decrement_stock', { row_id: p.consumable_id, amount: p.quantity })
        }
      }
    }
    revalidatePath('/service')
    return { success: true, message: '수정되었습니다.' }
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

  const orgId = profile.organization_id! // Non-null assertion added

  try {
    const { data: logData, error: logError } = await supabase
      .from('service_logs')
      .insert({ ...formData, organization_id: orgId })
      .select().single()
    
    if (logError) throw new Error(logError.message)
    
    if (parts.length > 0) {
      const partsPayload = parts.map(p => ({ service_log_id: logData.id, consumable_id: p.consumable_id, quantity: p.quantity }))
      await supabase.from('service_parts_usage').insert(partsPayload)
      
      if (formData.status === '완료') {
        for (const p of parts) {
          const { error: rpcError } = await supabase.rpc('decrement_stock', { row_id: p.consumable_id, amount: p.quantity });
          if (rpcError) {
             // Fallback: 직접 차감
             const { data: current } = await supabase.from('consumables').select('current_stock').eq('id', p.consumable_id).single()
             const newStock = (current?.current_stock || 0) - p.quantity
             await supabase.from('consumables').update({ current_stock: newStock }).eq('id', p.consumable_id)
          }
        }
      }
    }
    revalidatePath('/service')
    return { success: true, message: '서비스 일지가 등록되었습니다.' }
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
  
  const { data } = await supabase.from('consumables').select('*').eq('organization_id', profile.organization_id!).gt('current_stock', 0).order('model_name')
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
  const { data } = await supabase.from('profiles').select('id, name').eq('organization_id', profile.organization_id!)
  return data || []
}