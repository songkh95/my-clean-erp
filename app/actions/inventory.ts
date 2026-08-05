// app/actions/inventory.ts
'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { Inventory } from '@/app/types'
import { toMachineModelName } from '@/utils/suggestMatch'

// ----------------------------------------------------------------------
// 1. 자산 등록 액션
// ----------------------------------------------------------------------
export async function createInventoryAction(data: Partial<Inventory>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: '로그인이 필요합니다.' }

  const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
  if (!profile?.organization_id) return { success: false, message: '조직 정보를 찾을 수 없습니다.' }

  try {
    const { 
      client,                 
      is_active,              
      is_replacement_before,  
      is_replacement_after,   
      is_withdrawal,          
      final_counts,           
      id,                     
      created_at,             
      ...rest 
    } = data;

    if (!rest.type || !rest.category || !rest.model_name || !rest.serial_number) {
      return { success: false, message: '필수 정보(종류, 분류, 모델명, S/N)가 누락되었습니다.' }
    }

    const modelName = toMachineModelName(String(rest.model_name))
    if (!modelName) {
      return { success: false, message: '모델명은 영어 대문자·숫자만 입력할 수 있습니다.' }
    }

    const payload = {
      ...rest,
      type: rest.type,
      category: rest.category,
      model_name: modelName,
      serial_number: rest.serial_number,
      organization_id: profile.organization_id,
      created_at: new Date().toISOString()
    }

    const { error } = await supabase.from('inventory').insert(payload)
    if (error) throw error

    revalidatePath('/inventory')
    return { success: true, message: '자산이 등록되었습니다.' }
  } catch (e: any) {
    return { success: false, message: '등록 실패: ' + e.message }
  }
}

// ----------------------------------------------------------------------
// 2. 자산 수정 액션
// ----------------------------------------------------------------------
export async function updateInventoryAction(id: string, data: Partial<Inventory>) {
  const supabase = await createClient()
  
  try {
    const { 
      client,
      is_active,
      is_replacement_before,
      is_replacement_after,
      is_withdrawal,
      final_counts,
      created_at,      
      organization_id, 
      ...dbData 
    } = data;

    if (dbData.model_name != null) {
      const modelName = toMachineModelName(String(dbData.model_name))
      if (!modelName) {
        return { success: false, message: '모델명은 영어 대문자·숫자만 입력할 수 있습니다.' }
      }
      dbData.model_name = modelName
    }

    const { error } = await supabase.from('inventory').update(dbData).eq('id', id)
    if (error) throw error

    revalidatePath('/inventory')
    return { success: true, message: '수정되었습니다.' }
  } catch (e: any) {
    return { success: false, message: '수정 실패: ' + e.message }
  }
}

// ----------------------------------------------------------------------
// 3. 자산 삭제 액션
// ----------------------------------------------------------------------
export async function deleteInventoryAction(id: string) {
  const supabase = await createClient()
  
  try {
    const { error } = await supabase.from('inventory').delete().eq('id', id)
    if (error) throw error

    revalidatePath('/inventory')
    return { success: true, message: '삭제되었습니다.' }
  } catch (e: any) {
    return { success: false, message: '삭제 실패: ' + e.message }
  }
}

// ----------------------------------------------------------------------
// 4. 기기 철수(단독 회수) 처리 액션
// ----------------------------------------------------------------------
export async function withdrawInventoryAction(
  inventoryId: string, 
  clientId: string, 
  counts: { bw: number; col: number; bw_a3: number; col_a3: number },
  memo: string
) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: '로그인이 필요합니다.' }

  const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
  if (!profile?.organization_id) return { success: false, message: '조직 정보를 찾을 수 없습니다.' }

  try {
    // 1) 기계 이력(History) 기록: '철수' 상태로 저장
    const { error: historyError } = await supabase.from('machine_history').insert({
      inventory_id: inventoryId,
      client_id: clientId,
      organization_id: profile.organization_id,
      action_type: 'WITHDRAW',
      bw_count: counts.bw,
      col_count: counts.col,
      bw_a3_count: counts.bw_a3,
      col_a3_count: counts.col_a3,
      memo: `철수: ${memo}`,
      is_replacement: false
    })

    if (historyError) throw new Error('이력 기록 실패: ' + historyError.message)

    // 2) 기계 상태 변경: 창고로 이동 및 거래처 연결 해제
    const { error: invError } = await supabase.from('inventory').update({
      status: '창고',
      client_id: null,
    }).eq('id', inventoryId)

    if (invError) throw new Error('상태 변경 실패: ' + invError.message)

    revalidatePath('/clients')
    revalidatePath('/inventory')
    revalidatePath('/accounting')
    
    return { success: true, message: '철수 처리가 완료되었습니다.' }

  } catch (error: any) {
    console.error(error)
    return { success: false, message: error.message || '처리 중 오류가 발생했습니다.' }
  }
}

// ----------------------------------------------------------------------
// 5. 기기 교체(맞교환) 처리 액션 (✅ 최종 업데이트: 명시적 Plan 적용)
// ----------------------------------------------------------------------
export async function replaceInventoryAction(
  clientId: string,
  oldAssetId: string,
  newAssetId: string,
  data: {
    final_counts: { bw: number; col: number; bw_a3: number; col_a3: number };
    new_initial_counts: { bw: number; col: number; bw_a3: number; col_a3: number };
    contract: { start_date: string; end_date: string };
    // ✅ 요금제 정보 전체를 받음
    plan: {
      basic_fee: number;
      basic_cnt_bw: number;
      basic_cnt_col: number;
      price_bw: number;
      price_col: number;
      weight_a3_bw: number;
      weight_a3_col: number;
    };
    memo: string;
  }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: '로그인이 필요합니다.' }

  const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
  if (!profile?.organization_id) return { success: false, message: '조직 정보를 찾을 수 없습니다.' }
  const orgId = profile.organization_id

  try {
    // 2) 기존 기기 정보 가져오기 (그룹 ID 확인용)
    const { data: oldAsset } = await supabase
      .from('inventory')
      .select('*')
      .eq('id', oldAssetId)
      .eq('organization_id', orgId)
      .single()
    
    if (!oldAsset) throw new Error('기존 기기 정보를 찾을 수 없습니다.')

    // [Step 1] 기존 기기 회수 처리
    // 1-1. 회수 이력 기록
    const { error: histErr1 } = await supabase.from('machine_history').insert({
      inventory_id: oldAssetId,
      client_id: clientId,
      organization_id: orgId,
      action_type: 'WITHDRAW',
      bw_count: data.final_counts.bw,
      col_count: data.final_counts.col,
      bw_a3_count: data.final_counts.bw_a3,
      col_a3_count: data.final_counts.col_a3,
      memo: `교체로 인한 회수: ${data.memo}`,
      is_replacement: true
    })
    if (histErr1) throw new Error('회수 이력 기록 실패: ' + histErr1.message)

    // 1-2. 기존 기기 상태 변경 (창고행) & 그룹 설정
    let groupId = oldAsset.billing_group_id
    if (!groupId) {
      groupId = crypto.randomUUID()
      await supabase.from('inventory').update({ billing_group_id: groupId }).eq('id', oldAssetId)
    }

    const { error: invErr1 } = await supabase.from('inventory').update({
      status: '창고',
      client_id: null,
      billing_group_id: groupId // 그룹 ID 유지
    }).eq('id', oldAssetId)
    
    if (invErr1) throw new Error('기존 기기 상태 변경 실패: ' + invErr1.message)


    // [Step 2] 새 기기 설치 처리 (전달받은 Plan 적용)
    const newMachinePayload = {
      status: '설치',
      client_id: clientId,
      initial_count_bw: data.new_initial_counts.bw,
      initial_count_col: data.new_initial_counts.col,
      initial_count_bw_a3: data.new_initial_counts.bw_a3,
      initial_count_col_a3: data.new_initial_counts.col_a3,
      contract_start_date: data.contract.start_date || null,
      contract_end_date: data.contract.end_date || null,
      billing_group_id: groupId, // ✅ 기존 기기와 연결
      
      // ✅ 팝업에서 확정된 요금제 적용 (승계 또는 신규)
      plan_basic_fee: data.plan.basic_fee,
      plan_basic_cnt_bw: data.plan.basic_cnt_bw,
      plan_basic_cnt_col: data.plan.basic_cnt_col,
      plan_price_bw: data.plan.price_bw,
      plan_price_col: data.plan.price_col,
      plan_weight_a3_bw: data.plan.weight_a3_bw,
      plan_weight_a3_col: data.plan.weight_a3_col,
      // 기존 기기의 청구일자는 그대로 승계하는 것이 안전함
      billing_date: oldAsset.billing_date
    }

    const { error: invErr2 } = await supabase
      .from('inventory')
      .update(newMachinePayload)
      .eq('id', newAssetId)
      .eq('organization_id', orgId)
    
    if (invErr2) throw new Error('새 기기 정보 업데이트 실패: ' + invErr2.message)

    // 2-3. 새 기기 설치 이력 기록
    const { error: histErr2 } = await supabase.from('machine_history').insert({
      inventory_id: newAssetId,
      client_id: clientId,
      organization_id: orgId,
      action_type: 'INSTALL',
      bw_count: data.new_initial_counts.bw,
      col_count: data.new_initial_counts.col,
      bw_a3_count: data.new_initial_counts.bw_a3,
      col_a3_count: data.new_initial_counts.col_a3,
      memo: `교체로 인한 설치`,
      is_replacement: true
    })
    if (histErr2) throw new Error('설치 이력 기록 실패: ' + histErr2.message)

    revalidatePath('/clients')
    revalidatePath('/inventory')
    revalidatePath('/accounting')
    
    return { success: true, message: '기계 교체 및 계약 설정이 완료되었습니다.' }

  } catch (error: any) {
    console.error(error)
    return { success: false, message: error.message || '교체 처리 중 오류가 발생했습니다.' }
  }
}
// ----------------------------------------------------------------------
// 6. 기계 요금제 및 청구 그룹 설정 액션
// ----------------------------------------------------------------------
export async function updateInventoryPlanAction(
  inventoryId: string,
  planData: {
    plan_basic_fee: number;
    plan_basic_cnt_bw: number;
    plan_basic_cnt_col: number;
    plan_price_bw: number;
    plan_price_col: number;
    plan_weight_a3_bw: number;
    plan_weight_a3_col: number;
    billing_date: string;
    contract_start_date?: string | null;
    contract_end_date?: string | null;
  },
  billingGroupId: string | null
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: '로그인이 필요합니다.' }

  const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
  if (!profile?.organization_id) return { success: false, message: '조직 정보를 찾을 수 없습니다.' }
  const orgId = profile.organization_id

  try {
    const { data: before } = await supabase
      .from('inventory')
      .select('billing_group_id, model_name')
      .eq('id', inventoryId)
      .eq('organization_id', orgId)
      .single()

    const previousGroupId = before?.billing_group_id || null
    let finalGroupId = billingGroupId
    let extraMessage = ''

    // 신규 그룹 생성 (대상 기기와 묶기)
    if (finalGroupId && finalGroupId.startsWith('NEW_GROUP_WITH_')) {
      const targetId = finalGroupId.replace('NEW_GROUP_WITH_', '')
      const newGroupUUID = crypto.randomUUID()
      
      const { error: groupErr } = await supabase.from('inventory')
        .update({ billing_group_id: newGroupUUID })
        .eq('id', targetId)
        .eq('organization_id', orgId)
      
      if (groupErr) throw new Error('합산 그룹 생성 실패: ' + groupErr.message)
      
      finalGroupId = newGroupUUID
    }

    const { error } = await supabase
      .from('inventory')
      .update({
        ...planData,
        contract_start_date: planData.contract_start_date || null,
        contract_end_date: planData.contract_end_date || null,
        billing_group_id: finalGroupId
      })
      .eq('id', inventoryId)
      .eq('organization_id', orgId)

    if (error) throw error

    // 합산에서 빠진 뒤, 이전 그룹에 1대만 남으면 의미 없으므로 자동 해제
    if (previousGroupId && previousGroupId !== finalGroupId) {
      const { data: remaining } = await supabase
        .from('inventory')
        .select('id, model_name, serial_number')
        .eq('organization_id', orgId)
        .eq('billing_group_id', previousGroupId)

      if (remaining && remaining.length === 1) {
        await supabase
          .from('inventory')
          .update({ billing_group_id: null })
          .eq('id', remaining[0].id)
          .eq('organization_id', orgId)

        extraMessage =
          `\n\nℹ️ 합산 그룹에 기계가 1대만 남아 [${remaining[0].model_name} (${remaining[0].serial_number})]의 합산 청구도 자동으로 해제되었습니다.`
      } else if (remaining && remaining.length === 0) {
        // 그룹 소멸 — 추가 처리 없음
      }
    }
    
    revalidatePath('/clients')
    revalidatePath('/inventory')
    revalidatePath('/accounting')
    revalidatePath('/accounting/registration')

    return {
      success: true,
      message: '요금제 및 계약 정보가 저장되었습니다.' + extraMessage
    }

  } catch (e: any) {
    return { success: false, message: '저장 실패: ' + e.message }
  }
}

/** 기존 기계 모델명을 영어 대문자 규칙으로 일괄 정규화 */
export async function normalizeInventoryModelNamesAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: '로그인이 필요합니다.', updated: 0 }

  const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
  if (!profile?.organization_id) return { success: false, message: '조직 정보 없음', updated: 0 }

  const orgId = profile.organization_id
  const { data: rows, error } = await supabase
    .from('inventory')
    .select('id, model_name')
    .eq('organization_id', orgId)

  if (error) return { success: false, message: error.message, updated: 0 }

  let updated = 0
  for (const row of rows || []) {
    const next = toMachineModelName(row.model_name || '')
    if (!next || next === row.model_name) continue
    const { error: uErr } = await supabase
      .from('inventory')
      .update({ model_name: next })
      .eq('id', row.id)
      .eq('organization_id', orgId)
    if (!uErr) updated += 1
  }

  if (updated > 0) {
    revalidatePath('/inventory')
    revalidatePath('/clients')
    revalidatePath('/service')
  }

  return { success: true, message: updated > 0 ? `모델명 ${updated}건을 대문자로 정리했습니다.` : '정리할 항목이 없습니다.', updated }
}