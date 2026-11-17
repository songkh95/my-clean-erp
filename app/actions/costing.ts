'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { calcCosting, type CostInputs, type CostPart } from '@/utils/rentalCosting'
import type { Json } from '@/types/supabase'

export type CostSimulationInput = {
  id?: string
  name: string
  client_id?: string | null
  client_name?: string | null
  model?: string | null
  memo?: string | null
  inputs: CostInputs
  parts: CostPart[]
}

export type CostSimulationRow = {
  id: string
  name: string
  client_id: string | null
  client_name: string | null
  model: string | null
  memo: string | null
  inputs: CostInputs
  parts: CostPart[]
  summary: {
    revenue: number
    profit: number
    margin: number
    payback: number | null
    months: number
    totalProfit: number
  }
  created_at: string
  updated_at: string
}

async function requireOrg() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { supabase, error: '로그인이 필요합니다.', orgId: null as string | null, userId: null as string | null }
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()
  if (!profile?.organization_id) {
    return { supabase, error: '조직 정보를 찾을 수 없습니다.', orgId: null as string | null, userId: user.id }
  }
  return { supabase, error: null as string | null, orgId: profile.organization_id as string, userId: user.id }
}

function schemaHint(msg: string) {
  if (/cost_simulations|schema cache/i.test(msg)) {
    return 'DB에 원가계산 테이블이 없습니다. supabase/migrations/add_cost_simulations.sql 을 실행하세요.'
  }
  return msg
}

/** 목록에 보여줄 결과 요약 — 저장 시점의 계산 결과를 같이 넣어 둔다 */
function summaryOf(inputs: CostInputs, parts: CostPart[]) {
  const r = calcCosting(inputs, parts)
  return {
    revenue: Math.round(r.revenue),
    profit: Math.round(r.profit),
    margin: r.revenue > 0 ? Math.round((r.profit / r.revenue) * 1000) / 10 : 0,
    payback: r.payback,
    months: r.inputs.months,
    totalProfit: Math.round(r.totalProfit),
  }
}

export async function listCostSimulationsAction() {
  const { supabase, error: authErr, orgId } = await requireOrg()
  if (authErr || !orgId) return { success: false as const, message: authErr || '권한 없음', data: [] as CostSimulationRow[] }

  const { data, error } = await supabase
    .from('cost_simulations')
    .select('id, name, client_id, client_name, model, memo, summary, created_at, updated_at')
    .eq('organization_id', orgId)
    .order('updated_at', { ascending: false })

  if (error) return { success: false as const, message: schemaHint(error.message), data: [] as CostSimulationRow[] }
  return { success: true as const, message: 'ok', data: (data || []) as unknown as CostSimulationRow[] }
}

export async function getCostSimulationAction(id: string) {
  const { supabase, error: authErr, orgId } = await requireOrg()
  if (authErr || !orgId) return { success: false as const, message: authErr || '권한 없음', data: null }

  const { data, error } = await supabase
    .from('cost_simulations')
    .select('*')
    .eq('id', id)
    .eq('organization_id', orgId)
    .single()

  if (error || !data) {
    return { success: false as const, message: schemaHint(error?.message || '계산을 찾을 수 없습니다.'), data: null }
  }
  return { success: true as const, message: 'ok', data: data as unknown as CostSimulationRow }
}

export async function saveCostSimulationAction(input: CostSimulationInput) {
  const { supabase, error: authErr, orgId, userId } = await requireOrg()
  if (authErr || !orgId) return { success: false as const, message: authErr || '권한 없음', id: null as string | null }

  const name = (input.name || '').trim()
  if (!name) return { success: false as const, message: '계산 이름을 넣어주세요.', id: null as string | null }

  const row = {
    organization_id: orgId,
    name,
    client_id: input.client_id || null,
    client_name: input.client_name || null,
    model: input.model || null,
    memo: input.memo || null,
    inputs: input.inputs as unknown as Json,
    parts: input.parts as unknown as Json,
    summary: summaryOf(input.inputs, input.parts),
    updated_at: new Date().toISOString(),
  }

  if (input.id) {
    const { error } = await supabase
      .from('cost_simulations')
      .update(row)
      .eq('id', input.id)
      .eq('organization_id', orgId)
    if (error) return { success: false as const, message: schemaHint(error.message), id: null as string | null }
    revalidatePath('/costing')
    return { success: true as const, message: '저장했습니다.', id: input.id }
  }

  const { data, error } = await supabase
    .from('cost_simulations')
    .insert({ ...row, created_by: userId })
    .select('id')
    .single()

  if (error) return { success: false as const, message: schemaHint(error.message), id: null as string | null }
  revalidatePath('/costing')
  return { success: true as const, message: '저장했습니다.', id: (data?.id as string) || null }
}

export async function deleteCostSimulationAction(id: string) {
  const { supabase, error: authErr, orgId } = await requireOrg()
  if (authErr || !orgId) return { success: false as const, message: authErr || '권한 없음' }

  const { error } = await supabase
    .from('cost_simulations')
    .delete()
    .eq('id', id)
    .eq('organization_id', orgId)

  if (error) return { success: false as const, message: schemaHint(error.message) }
  revalidatePath('/costing')
  return { success: true as const, message: '삭제했습니다.' }
}

export async function listClientsForCostingAction() {
  const { supabase, error: authErr, orgId } = await requireOrg()
  if (authErr || !orgId) return { success: false as const, message: authErr || '권한 없음', data: [] as { id: string; name: string }[] }

  const { data, error } = await supabase
    .from('clients')
    .select('id, name')
    .eq('organization_id', orgId)
    .eq('is_deleted', false)
    .order('name', { ascending: true })

  if (error) return { success: false as const, message: error.message, data: [] as { id: string; name: string }[] }
  return { success: true as const, message: 'ok', data: (data || []) as { id: string; name: string }[] }
}
