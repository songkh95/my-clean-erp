'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { toMachineModelName } from '@/utils/suggestMatch'
import { detectColor, isRegeneratedName } from '@/utils/consumableMatch'

function normalizeCompatibleModels(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : []
  const set = new Set<string>()
  for (const v of list) {
    const m = toMachineModelName(String(v || '')).trim()
    if (m) set.add(m)
  }
  return Array.from(set)
}

function mapConsumableRow(row: any) {
  if (!row) return row
  const fromJoin = Array.isArray(row.compatible_models)
    ? row.compatible_models
        .map((x: any) => (typeof x === 'string' ? x : x?.machine_model))
        .filter(Boolean)
    : []
  const models = normalizeCompatibleModels(
    fromJoin.length > 0 ? fromJoin : row.product_group ? [row.product_group] : []
  )
  const { compatible_models: _j, ...rest } = row
  return { ...rest, compatible_models: models }
}

async function replaceCompatibleModels(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  consumableId: string,
  models: string[]
) {
  await supabase.from('consumable_compatible_models' as any).delete().eq('consumable_id', consumableId)

  if (models.length === 0) return { ok: true as const }

  const rows = models.map((machine_model) => ({
    organization_id: orgId,
    consumable_id: consumableId,
    machine_model,
  }))

  const { error } = await supabase.from('consumable_compatible_models' as any).insert(rows)
  if (error) {
    if (/consumable_compatible_models|does not exist|schema cache/i.test(error.message)) {
      return {
        ok: false as const,
        message:
          '호환 기기 테이블이 없습니다. Supabase에서 sql/ENSURE_ALL.sql (또는 sql/add_consumable_compatible_models.sql)을 실행해 주세요.',
      }
    }
    return { ok: false as const, message: error.message }
  }
  return { ok: true as const }
}

/** 호환 모델 연결만 추가 (이미 있으면 무시) */
export async function linkConsumableCompatibleModelAction(
  consumableId: string,
  machineModel: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false as const, message: '로그인 필요' }

  const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
  if (!profile?.organization_id) return { success: false as const, message: '조직 정보 없음' }

  const model = toMachineModelName(machineModel).trim()
  if (!model) return { success: false as const, message: '기기 모델명이 없습니다.' }

  const { error } = await supabase.from('consumable_compatible_models' as any).upsert(
    {
      organization_id: profile.organization_id,
      consumable_id: consumableId,
      machine_model: model,
    },
    { onConflict: 'consumable_id,machine_model', ignoreDuplicates: true }
  )

  if (error) {
    if (/consumable_compatible_models|does not exist|schema cache/i.test(error.message)) {
      return {
        success: false as const,
        message: '호환 기기 테이블이 없습니다. sql/ENSURE_ALL.sql 을 실행해 주세요.',
      }
    }
    return { success: false as const, message: error.message }
  }

  revalidatePath('/inventory')
  revalidatePath('/service')
  return { success: true as const }
}

// 1. 소모품 목록 조회
export async function getConsumablesAction(
  categoryGroup?: string,
  categories?: string[],
  options?: { includeInactive?: boolean }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, data: [] as any[] }

  const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
  if (!profile?.organization_id) return { success: false, data: [] as any[] }

  let query = supabase
    .from('consumables')
    .select('*, compatible_models:consumable_compatible_models(machine_model)')
    .eq('organization_id', profile.organization_id)
    .order('category')
    .order('model_name')

  if (!options?.includeInactive) {
    query = query.or('is_active.is.null,is_active.eq.true')
  }

  if (categories && categories.length > 0) {
    query = query.in('category', categories)
  } else if (categoryGroup === 'consumables') {
    query = query.in('category', ['토너', '드럼', '현상기', '폐토너통', '용지'])
  } else if (categoryGroup === 'parts') {
    query = query.in('category', ['부품', '롤러', '기어', 'Fuser'])
  } else if (categoryGroup === 'others') {
    query = query.not('category', 'in', '("토너","드럼","현상기","폐토너통","용지","부품","롤러","기어","Fuser")')
  }

  const { data, error } = await query

  if (error) {
    if (/compatible_models|consumable_compatible|product_group|is_active|schema cache/i.test(error.message)) {
      let fallback = supabase
        .from('consumables')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('category')
        .order('model_name')
      if (categories && categories.length > 0) fallback = fallback.in('category', categories)
      else if (categoryGroup === 'consumables') fallback = fallback.in('category', ['토너', '드럼', '현상기', '폐토너통', '용지'])
      else if (categoryGroup === 'parts') fallback = fallback.in('category', ['부품', '롤러', '기어', 'Fuser'])
      else if (categoryGroup === 'others') fallback = fallback.not('category', 'in', '("토너","드럼","현상기","폐토너통","용지","부품","롤러","기어","Fuser")')
      const retry = await fallback
      let rows = (retry.data || []).map(mapConsumableRow)
      if (!options?.includeInactive) rows = rows.filter((r: any) => r.is_active !== false)
      return { success: !retry.error, data: rows }
    }
    console.error(error)
    return { success: false, data: [] as any[] }
  }

  return { success: true, data: (data || []).map(mapConsumableRow) }
}

/** 호환 기기 선택용: 등록된 기기 모델 + 기존 호환 모델 */
export async function getMachineModelOptionsAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return [] as string[]

  const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
  if (!profile?.organization_id) return []

  const orgId = profile.organization_id
  const set = new Set<string>()

  const { data: machines } = await supabase
    .from('inventory')
    .select('model_name')
    .eq('organization_id', orgId)
    .not('model_name', 'is', null)

  for (const m of machines || []) {
    const g = toMachineModelName(String(m.model_name || '')).trim()
    if (g) set.add(g)
  }

  const { data: compat } = await supabase
    .from('consumable_compatible_models' as any)
    .select('machine_model')
    .eq('organization_id', orgId)

  for (const c of compat || []) {
    const g = toMachineModelName(String((c as any).machine_model || '')).trim()
    if (g) set.add(g)
  }

  // legacy product_group
  const { data: cons } = await supabase
    .from('consumables')
    .select('product_group')
    .eq('organization_id', orgId)
    .not('product_group', 'is', null)

  for (const c of cons || []) {
    const g = toMachineModelName(String(c.product_group || '')).trim()
    if (g) set.add(g)
  }

  return Array.from(set).sort((a, b) => a.localeCompare(b, 'ko'))
}

/** @deprecated */
export async function getProductGroupOptionsAction() {
  return getMachineModelOptionsAction()
}

// 2. 소모품 등록/수정 (+ 호환 기기)
// 토너/드럼 동일 색상·재생이 있으면 새 줄 대신 호환만 연결·재고 합산
export async function upsertConsumableAction(formData: any) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: '로그인 필요' }

  const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
  if (!profile?.organization_id) return { success: false, message: '조직 정보 없음' }

  const orgId = profile.organization_id
  const compatibleModels = normalizeCompatibleModels(formData.compatible_models)

  const {
    compatible_models: _cm,
    product_group: _pg,
    force_new: forceNew,
    ...rest
  } = formData || {}

  const category = String(formData.category || '')
  const modelName = String(formData.model_name || '')
  const stockIn = Number(formData.current_stock)
  const priceIn = Number(formData.unit_price)
  const payload: Record<string, unknown> = {
    ...rest,
    organization_id: orgId,
    current_stock: Number.isFinite(stockIn) ? stockIn : 0,
    unit_price: Number.isFinite(priceIn) ? priceIn : 0,
  }

  if (category === '토너' || category === '드럼') {
    if (payload.color == null || String(payload.color).trim() === '') {
      const detected = detectColor(modelName)
      if (detected) payload.color = detected
    }
    if (payload.is_regenerated == null) {
      payload.is_regenerated = isRegeneratedName(modelName)
    }
  }

  const color = payload.color != null ? String(payload.color).toUpperCase().trim() : ''
  const isRegen = Boolean(payload.is_regenerated)
  const isNew = !payload.id
  const editingId = payload.id ? String(payload.id) : null

  // 관리코드 중복 처리 (활성만 막고, 숨긴 품목 코드는 비워서 재사용 허용)
  const code = payload.code != null ? String(payload.code).trim() : ''
  if (code) {
    let activeQ = supabase
      .from('consumables')
      .select('id, model_name, is_active')
      .eq('organization_id', orgId)
      .eq('code', code)
      .or('is_active.is.null,is_active.eq.true')
      .limit(1)
    if (editingId) activeQ = activeQ.neq('id', editingId)
    const { data: codeHit } = await activeQ.maybeSingle()
    if (codeHit) {
      return {
        success: false,
        message:
          `관리코드 "${code}" 가 이미 사용 중입니다.\n` +
          `기존 품목: ${codeHit.model_name}\n\n` +
          `다른 코드를 쓰거나, 기존 품목을 수정하세요.\n` +
          `(목록에 안 보이면 「숨긴 항목 포함」을 켜 보세요.)`,
      }
    }

    // 숨긴 품목에 같은 코드가 있으면 비워서 신규 등록 가능하게
    let hiddenQ = supabase
      .from('consumables')
      .select('id')
      .eq('organization_id', orgId)
      .eq('code', code)
      .eq('is_active', false)
    if (editingId) hiddenQ = hiddenQ.neq('id', editingId)
    const { data: hiddenHits } = await hiddenQ
    if (hiddenHits && hiddenHits.length > 0) {
      await supabase
        .from('consumables')
        .update({ code: null } as any)
        .in('id', hiddenHits.map((h) => h.id))
    }
  } else {
    payload.code = null
  }

  // 신규 등록 시: 품명(또는 코드)이 같은 기존 품목만 합침 — 색상만 같다고 합치지 않음
  if (
    isNew &&
    !forceNew &&
    (category === '토너' || category === '드럼') &&
    modelName.trim()
  ) {
    let existingQ = supabase
      .from('consumables')
      .select('*')
      .eq('organization_id', orgId)
      .eq('category', category)
      .ilike('model_name', modelName.trim())
      .or('is_active.is.null,is_active.eq.true')
      .limit(1)

    const { data: byName } = await existingQ.maybeSingle()

    // 코드가 같고 품명이 비어 있는 경우만 코드로도 매칭 (위에서 이미 코드 중복은 막음)
    let existing = byName
    if (!existing && code) {
      const { data: byCode } = await supabase
        .from('consumables')
        .select('*')
        .eq('organization_id', orgId)
        .eq('code', code)
        .or('is_active.is.null,is_active.eq.true')
        .limit(1)
        .maybeSingle()
      existing = byCode
    }

    if (existing) {
      const { data: prevLinks } = await supabase
        .from('consumable_compatible_models' as any)
        .select('machine_model')
        .eq('consumable_id', existing.id)

      const mergedModels = normalizeCompatibleModels([
        ...(prevLinks || []).map((r: any) => r.machine_model),
        ...compatibleModels,
      ])

      const addStock = Number.isFinite(stockIn) ? Math.max(0, stockIn) : 0
      const nextStock = (Number(existing.current_stock) || 0) + addStock
      const patch: Record<string, unknown> = { current_stock: nextStock }
      if (color && (!existing.color || String(existing.color).trim() === '')) patch.color = color
      if (payload.is_regenerated != null && existing.is_regenerated == null) {
        patch.is_regenerated = isRegen
      }
      if (Number.isFinite(priceIn) && priceIn > 0 && !(Number(existing.unit_price) > 0)) {
        patch.unit_price = priceIn
      }

      await supabase.from('consumables').update(patch).eq('id', existing.id).eq('organization_id', orgId)
      const link = await replaceCompatibleModels(supabase, orgId, existing.id, mergedModels)
      if (!link.ok) {
        return { success: false, message: link.message }
      }

      revalidatePath('/inventory')
      revalidatePath('/service')
      return {
        success: true,
        linked: true,
        message:
          `같은 품명 「${existing.model_name}」이 있어 새로 만들지 않고\n` +
          `호환 기기를 연결했습니다` +
          (addStock > 0 ? ` (재고 +${addStock})` : '') +
          '.\n(색상만 같고 품명이 다르면 별도 품목으로 등록됩니다.)',
        id: existing.id,
        data: {
          ...existing,
          ...patch,
          compatible_models: mergedModels,
        },
      }
    }
  }

  if (!payload.id) delete payload.id
  if (color) payload.color = color
  payload.is_regenerated = isRegen

  const { data: saved, error } = await supabase
    .from('consumables')
    .upsert(payload as any)
    .select('*')
    .single()

  if (error || !saved) {
    if (/consumables_org_code_uidx|duplicate key/i.test(error?.message || '')) {
      return {
        success: false,
        message: '동일한 관리코드가 이미 있습니다. 다른 코드를 사용하거나 기존 품목을 수정하세요.',
      }
    }
    if (/consumables_org_toner_color_uidx/i.test(error?.message || '')) {
      return {
        success: false,
        message:
          'DB에 예전 제약(색상 유일)이 남아 있습니다.\nSupabase에서 sql/drop_toner_color_unique.sql 을 실행한 뒤 다시 저장하세요.',
      }
    }
    return { success: false, message: error?.message || '저장 실패' }
  }

  const link = await replaceCompatibleModels(supabase, orgId, saved.id, compatibleModels)
  if (!link.ok) {
    revalidatePath('/inventory')
    return {
      success: true,
      message: `소모품은 저장되었지만 호환 기기 저장에 실패했습니다.\n${link.message}`,
      id: saved.id,
      data: { ...saved, compatible_models: compatibleModels },
    }
  }

  revalidatePath('/inventory')
  revalidatePath('/service')
  return {
    success: true,
    linked: false,
    message: '저장되었습니다.',
    id: saved.id,
    data: { ...saved, compatible_models: compatibleModels },
  }
}

// 3. 소모품 삭제 (서비스 일지에서 쓰인 경우 물리 삭제 불가 → 목록에서만 숨김)
export async function deleteConsumableAction(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: '로그인 필요' }

  const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
  if (!profile?.organization_id) return { success: false, message: '조직 정보 없음' }

  const { count } = await supabase
    .from('service_parts_usage')
    .select('id', { count: 'exact', head: true })
    .eq('consumable_id', id)

  const usedInLogs = (count || 0) > 0

  if (usedInLogs) {
    const soft = await supabase
      .from('consumables')
      .update({ is_active: false } as any)
      .eq('id', id)
      .eq('organization_id', profile.organization_id)

    if (soft.error) {
      if (/is_active|schema cache/i.test(soft.error.message)) {
        return {
          success: false,
          message:
            '이 소모품은 서비스 일지에서 이미 사용되어 삭제할 수 없습니다.\n\n' +
            'Supabase에서 sql/ENSURE_ALL.sql 을 실행한 뒤 다시 삭제하면 목록에서만 숨겨집니다.',
        }
      }
      return { success: false, message: soft.error.message }
    }

    revalidatePath('/inventory')
    revalidatePath('/service')
    return {
      success: true,
      message: '서비스 일지 이력이 있어 완전 삭제 대신 목록에서 숨겼습니다.',
    }
  }

  const { error } = await supabase
    .from('consumables')
    .delete()
    .eq('id', id)
    .eq('organization_id', profile.organization_id)

  if (error) {
    if (/foreign key|parts_usage_consumable/i.test(error.message)) {
      const soft = await supabase
        .from('consumables')
        .update({ is_active: false } as any)
        .eq('id', id)
        .eq('organization_id', profile.organization_id)

      if (!soft.error) {
        revalidatePath('/inventory')
        revalidatePath('/service')
        return { success: true, message: '일지 이력이 있어 목록에서만 숨겼습니다.' }
      }
      return {
        success: false,
        message: '서비스 일지에서 사용된 소모품이라 삭제할 수 없습니다.',
      }
    }
    return { success: false, message: error.message }
  }

  revalidatePath('/inventory')
  return { success: true, message: '삭제되었습니다.' }
}

/** 일지 팝업에서 임시 생성한 소모품 롤백 (부품 사용 이력 없을 때만) */
export async function rollbackDraftConsumablesAction(ids: string[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: '로그인 필요' }

  const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
  if (!profile?.organization_id) return { success: false, message: '조직 정보 없음' }

  const unique = Array.from(new Set((ids || []).filter(Boolean)))
  for (const id of unique) {
    const { count } = await supabase
      .from('service_parts_usage')
      .select('id', { count: 'exact', head: true })
      .eq('consumable_id', id)

    if ((count || 0) > 0) continue

    await supabase
      .from('consumables')
      .delete()
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
  }

  revalidatePath('/inventory')
  revalidatePath('/service')
  return { success: true }
}

/** 일지에서 임시로 추가한 호환 연결 제거 */
export async function unlinkConsumableCompatibleModelsAction(
  pairs: { consumable_id: string; machine_model: string }[]
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: '로그인 필요' }

  const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
  if (!profile?.organization_id) return { success: false, message: '조직 정보 없음' }

  for (const p of pairs || []) {
    const model = toMachineModelName(String(p.machine_model || '')).trim()
    if (!p.consumable_id || !model) continue
    await supabase
      .from('consumable_compatible_models' as any)
      .delete()
      .eq('organization_id', profile.organization_id)
      .eq('consumable_id', p.consumable_id)
      .eq('machine_model', model)
  }

  revalidatePath('/inventory')
  revalidatePath('/service')
  return { success: true }
}

/** 숨긴 소모품 복구 */
export async function restoreConsumableAction(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: '로그인 필요' }

  const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
  if (!profile?.organization_id) return { success: false, message: '조직 정보 없음' }

  const { error } = await supabase
    .from('consumables')
    .update({ is_active: true } as any)
    .eq('id', id)
    .eq('organization_id', profile.organization_id)

  if (error) {
    if (/unique|org_code/i.test(error.message)) {
      return {
        success: false,
        message: '같은 관리코드의 활성 품목이 이미 있어 복구할 수 없습니다.',
      }
    }
    return { success: false, message: error.message }
  }

  revalidatePath('/inventory')
  revalidatePath('/service')
  return { success: true, message: '목록에 다시 표시됩니다.' }
}

/** 색상/호환 미설정 품목 (정리 안내) */
export async function getIncompleteConsumablesAction() {
  const res = await getConsumablesAction()
  if (!res.success) return { success: false as const, data: [] as any[] }
  const incomplete = (res.data || []).filter((c: any) => {
    const models = Array.isArray(c.compatible_models) ? c.compatible_models : []
    const noCompat = models.length === 0
    const tonerDrum = c.category === '토너' || c.category === '드럼'
    const noColor = tonerDrum && (!c.color || String(c.color).trim() === '')
    return noCompat || noColor
  })
  return { success: true as const, data: incomplete }
}
