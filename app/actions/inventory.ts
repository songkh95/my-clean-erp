// app/actions/inventory.ts
'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { Inventory } from '@/app/types'

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

    const payload = {
      ...rest,
      type: rest.type,
      category: rest.category,
      model_name: rest.model_name,
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
      
      // [옵션] 철수 시점의 카운터를 초기 카운터로 업데이트 (필요시 주석 해제)
      /*
      initial_count_bw: counts.bw,
      initial_count_col: counts.col,
      initial_count_bw_a3: counts.bw_a3,
      initial_count_col_a3: counts.col_a3,
      */
     
    }).eq('id', inventoryId)

    if (invError) throw new Error('상태 변경 실패: ' + invError.message)

    // 3) 데이터 갱신
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
// 5. 기기 교체(맞교환) 처리 액션
// ----------------------------------------------------------------------
export async function replaceInventoryAction(
  clientId: string,
  oldAssetId: string,
  newAssetId: string,
  data: {
    final_counts: { bw: number; col: number; bw_a3: number; col_a3: number };
    new_initial_counts: { bw: number; col: number; bw_a3: number; col_a3: number };
    memo: string;
    inheritPlan: boolean; // 요금제 승계 여부
  }
) {
  const supabase = await createClient()
  
  // 1) 보안 검증
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: '로그인이 필요합니다.' }

  const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
  if (!profile?.organization_id) return { success: false, message: '조직 정보를 찾을 수 없습니다.' }
  const orgId = profile.organization_id

  try {
    // 2) 기존 기기 정보 가져오기 (요금제 승계를 위해)
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

    // 1-2. 기존 기기 상태 변경 (창고행)
    const { error: invErr1 } = await supabase.from('inventory').update({
      status: '창고',
      client_id: null,
    }).eq('id', oldAssetId)
    if (invErr1) throw new Error('기존 기기 상태 변경 실패: ' + invErr1.message)


    // [Step 2] 새 기기 설치 처리

    // 2-1. 새 기기 업데이트 Payload 구성
    const newMachinePayload: any = {
      status: '설치',
      client_id: clientId,
      initial_count_bw: data.new_initial_counts.bw,
      initial_count_col: data.new_initial_counts.col,
      initial_count_bw_a3: data.new_initial_counts.bw_a3,
      initial_count_col_a3: data.new_initial_counts.col_a3,
    }

    // 요금제 승계 로직
    if (data.inheritPlan) {
      newMachinePayload.plan_basic_fee = oldAsset.plan_basic_fee;
      newMachinePayload.plan_basic_cnt_bw = oldAsset.plan_basic_cnt_bw;
      newMachinePayload.plan_basic_cnt_col = oldAsset.plan_basic_cnt_col;
      newMachinePayload.plan_price_bw = oldAsset.plan_price_bw;
      newMachinePayload.plan_price_col = oldAsset.plan_price_col;
      newMachinePayload.plan_weight_a3_bw = oldAsset.plan_weight_a3_bw;
      newMachinePayload.plan_weight_a3_col = oldAsset.plan_weight_a3_col;
      newMachinePayload.billing_group_id = oldAsset.billing_group_id;
      newMachinePayload.billing_date = oldAsset.billing_date;
    }

    // 2-2. 새 기기 정보 업데이트
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

    // 3) 데이터 갱신
    revalidatePath('/clients')
    revalidatePath('/inventory')
    
    return { success: true, message: '기계 교체 처리가 완료되었습니다.' }

  } catch (error: any) {
    console.error(error)
    return { success: false, message: error.message || '교체 처리 중 오류가 발생했습니다.' }
  }
}

// ----------------------------------------------------------------------
// 6. 기계 요금제 및 청구 그룹 설정 액션 (NEW)
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
    contract_start_date?: string | null; // ✅ 추가
    contract_end_date?: string | null;   // ✅ 추가
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
    let finalGroupId = billingGroupId

    // 신규 그룹 생성 로직
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

    // ✅ 계약 기간을 포함하여 업데이트
    const { error } = await supabase
      .from('inventory')
      .update({
        ...planData,
        // 빈 문자열이 올 경우 null로 처리
        contract_start_date: planData.contract_start_date || null,
        contract_end_date: planData.contract_end_date || null,
        billing_group_id: finalGroupId
      })
      .eq('id', inventoryId)
      .eq('organization_id', orgId)

    if (error) throw error
    
    revalidatePath('/clients')
    revalidatePath('/inventory')
    revalidatePath('/accounting')

    return { success: true, message: '요금제 및 계약 정보가 저장되었습니다.' }

  } catch (e: any) {
    return { success: false, message: '저장 실패: ' + e.message }
  }
}