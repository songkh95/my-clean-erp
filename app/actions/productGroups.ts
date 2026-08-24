'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { toMachineModelName } from '@/utils/suggestMatch'

export type ProductGroupRow = {
  id: string
  name: string
  memo: string | null
  machine_models: string[]
}

async function requireOrg() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { supabase, orgId: null as string | null, error: '로그인 필요' }
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()
  if (!profile?.organization_id) return { supabase, orgId: null, error: '조직 정보 없음' }
  return { supabase, orgId: profile.organization_id as string, error: null }
}

function missingTableMessage(err: string) {
  if (/product_groups|product_group_models|does not exist|schema cache/i.test(err)) {
    return '제품군 테이블이 없습니다. Supabase에서 supabase/migrations/add_product_groups.sql 을 실행해 주세요.'
  }
  return err
}

function normalizeModels(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : []
  const set = new Set<string>()
  for (const v of list) {
    const m = toMachineModelName(String(v || '')).trim()
    if (m) set.add(m)
  }
  return Array.from(set)
}

/** 조직 제품군 목록 (+ 소속 기기 모델) */
export async function listProductGroupsAction(): Promise<{
  success: boolean
  message?: string
  data: ProductGroupRow[]
}> {
  const { supabase, orgId, error } = await requireOrg()
  if (!orgId) return { success: false, message: error || '조직 없음', data: [] }

  const { data: groups, error: gErr } = await supabase
    .from('product_groups' as any)
    .select('id, name, memo')
    .eq('organization_id', orgId)
    .order('name')

  if (gErr) {
    return { success: false, message: missingTableMessage(gErr.message), data: [] }
  }

  const ids = (groups || []).map((g: any) => g.id)
  let modelsByGroup = new Map<string, string[]>()
  if (ids.length > 0) {
    const { data: models, error: mErr } = await supabase
      .from('product_group_models' as any)
      .select('product_group_id, machine_model')
      .eq('organization_id', orgId)
      .in('product_group_id', ids)
    if (mErr) {
      return { success: false, message: missingTableMessage(mErr.message), data: [] }
    }
    for (const row of models || []) {
      const gid = (row as any).product_group_id as string
      const model = toMachineModelName(String((row as any).machine_model || '')).trim()
      if (!model) continue
      const list = modelsByGroup.get(gid) || []
      list.push(model)
      modelsByGroup.set(gid, list)
    }
  }

  return {
    success: true,
    data: (groups || []).map((g: any) => ({
      id: g.id,
      name: g.name,
      memo: g.memo || null,
      machine_models: Array.from(new Set(modelsByGroup.get(g.id) || [])).sort((a, b) =>
        a.localeCompare(b, 'ko')
      ),
    })),
  }
}

/** 제품군 저장(신규/수정). machineModels 전체를 교체 */
export async function saveProductGroupAction(input: {
  id?: string | null
  name: string
  memo?: string | null
  machineModels: string[]
}): Promise<{ success: boolean; message?: string; id?: string }> {
  const { supabase, orgId, error } = await requireOrg()
  if (!orgId) return { success: false, message: error || '조직 없음' }

  const name = String(input.name || '').trim()
  if (!name) return { success: false, message: '제품군 이름을 입력하세요.' }
  const models = normalizeModels(input.machineModels)
  if (models.length === 0) {
    return { success: false, message: '호환 기기를 1개 이상 추가하세요.' }
  }

  const memo = input.memo != null ? String(input.memo).trim() || null : null
  let groupId = input.id ? String(input.id) : null

  if (groupId) {
    const { error: uErr } = await supabase
      .from('product_groups' as any)
      .update({ name, memo })
      .eq('id', groupId)
      .eq('organization_id', orgId)
    if (uErr) return { success: false, message: missingTableMessage(uErr.message) }
  } else {
    const { data: created, error: cErr } = await supabase
      .from('product_groups' as any)
      .insert({ organization_id: orgId, name, memo })
      .select('id')
      .single()
    if (cErr || !created) {
      if (/duplicate|unique/i.test(cErr?.message || '')) {
        return { success: false, message: `이미 있는 제품군 이름입니다: ${name}` }
      }
      return { success: false, message: missingTableMessage(cErr?.message || '저장 실패') }
    }
    groupId = (created as any).id
  }

  await supabase
    .from('product_group_models' as any)
    .delete()
    .eq('product_group_id', groupId)
    .eq('organization_id', orgId)

  const rows = models.map((machine_model) => ({
    organization_id: orgId,
    product_group_id: groupId,
    machine_model,
  }))
  const { error: iErr } = await supabase.from('product_group_models' as any).insert(rows)
  if (iErr) return { success: false, message: missingTableMessage(iErr.message) }

  revalidatePath('/inventory')
  revalidatePath('/service')
  return { success: true, message: '제품군이 저장되었습니다.', id: groupId || undefined }
}

export async function deleteProductGroupAction(id: string): Promise<{
  success: boolean
  message?: string
}> {
  const { supabase, orgId, error } = await requireOrg()
  if (!orgId) return { success: false, message: error || '조직 없음' }
  if (!id) return { success: false, message: '삭제할 제품군이 없습니다.' }

  const { error: dErr } = await supabase
    .from('product_groups' as any)
    .delete()
    .eq('id', id)
    .eq('organization_id', orgId)

  if (dErr) return { success: false, message: missingTableMessage(dErr.message) }

  revalidatePath('/inventory')
  revalidatePath('/service')
  return { success: true, message: '삭제되었습니다.' }
}
