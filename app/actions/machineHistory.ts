// app/actions/machineHistory.ts
// 기기 한 대의 설치·철수 이력 (machine_history) 조회와 직접 수정.
'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export type MachineHistoryAction = 'INSTALL' | 'WITHDRAW'

export type MachineHistoryInput = {
  action_type: MachineHistoryAction
  client_id: string | null
  recorded_at: string
  bw_count: number
  col_count: number
  bw_a3_count: number
  col_a3_count: number
  memo: string | null
  is_replacement?: boolean
}

async function getOrg() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, orgId: null as string | null }
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()
  return { supabase, orgId: profile?.organization_id || null }
}

function toPayload(input: MachineHistoryInput) {
  return {
    action_type: input.action_type,
    client_id: input.client_id || null,
    recorded_at: input.recorded_at || new Date().toISOString(),
    bw_count: Number(input.bw_count) || 0,
    col_count: Number(input.col_count) || 0,
    bw_a3_count: Number(input.bw_a3_count) || 0,
    col_a3_count: Number(input.col_a3_count) || 0,
    memo: input.memo || null,
    is_replacement: Boolean(input.is_replacement),
  }
}

/** 기기 한 대의 전체 이력 (오래된 순) */
export async function getMachineHistoryAction(inventoryId: string) {
  const { supabase, orgId } = await getOrg()
  if (!orgId) return { success: false, message: '로그인이 필요합니다.', data: [] as any[] }

  const { data, error } = await supabase
    .from('machine_history')
    .select('*, client:clients(id, name)')
    .eq('organization_id', orgId)
    .eq('inventory_id', inventoryId)
    .order('recorded_at', { ascending: true })

  if (error) return { success: false, message: '이력 조회 실패: ' + error.message, data: [] as any[] }
  return { success: true, data: (data || []) as any[] }
}

/** 빠진 이력을 직접 추가 */
export async function createMachineHistoryAction(inventoryId: string, input: MachineHistoryInput) {
  const { supabase, orgId } = await getOrg()
  if (!orgId) return { success: false, message: '로그인이 필요합니다.' }

  const { error } = await supabase.from('machine_history').insert({
    ...toPayload(input),
    inventory_id: inventoryId,
    organization_id: orgId,
  })
  if (error) return { success: false, message: '이력 추가 실패: ' + error.message }

  revalidatePath('/inventory')
  revalidatePath('/clients')
  return { success: true, message: '이력을 추가했습니다.' }
}

/** 잘못 기록된 이력 수정 */
export async function updateMachineHistoryAction(historyId: string, input: MachineHistoryInput) {
  const { supabase, orgId } = await getOrg()
  if (!orgId) return { success: false, message: '로그인이 필요합니다.' }

  const { error } = await supabase
    .from('machine_history')
    .update(toPayload(input))
    .eq('id', historyId)
    .eq('organization_id', orgId)
  if (error) return { success: false, message: '이력 수정 실패: ' + error.message }

  revalidatePath('/inventory')
  revalidatePath('/clients')
  return { success: true, message: '이력을 수정했습니다.' }
}

/** 이력 삭제 — 정산은 이 기록을 보고 계산하므로 지우면 과거 청구가 달라질 수 있다 */
export async function deleteMachineHistoryAction(historyId: string) {
  const { supabase, orgId } = await getOrg()
  if (!orgId) return { success: false, message: '로그인이 필요합니다.' }

  const { error } = await supabase
    .from('machine_history')
    .delete()
    .eq('id', historyId)
    .eq('organization_id', orgId)
  if (error) return { success: false, message: '이력 삭제 실패: ' + error.message }

  revalidatePath('/inventory')
  revalidatePath('/clients')
  return { success: true, message: '이력을 삭제했습니다.' }
}
