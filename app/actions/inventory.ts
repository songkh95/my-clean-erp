'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { Inventory } from '@/app/types'

export async function createInventoryAction(data: Partial<Inventory>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: '로그인이 필요합니다.' }

  const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
  if (!profile?.organization_id) return { success: false, message: '조직 정보를 찾을 수 없습니다.' }

  try {
    // 1. UI 전용 필드 및 자동 생성 필드 제거 (DB에 없는 컬럼들)
    const { 
      client,                 // 조인된 객체 제거
      is_active,              // UI 플래그 제거
      is_replacement_before,  // UI 플래그 제거
      is_replacement_after,   // UI 플래그 제거
      is_withdrawal,          // UI 플래그 제거
      final_counts,           // UI 데이터 제거
      id,                     // DB 자동 생성
      created_at,             // 아래에서 새로 생성
      ...rest 
    } = data;

    // 2. 필수 데이터 검증 (DB Not Null 제약조건 준수)
    // Partial 타입이라 undefined일 수 있으므로 명시적으로 체크
    if (!rest.type || !rest.category || !rest.model_name || !rest.serial_number) {
      return { success: false, message: '필수 정보(종류, 분류, 모델명, S/N)가 누락되었습니다.' }
    }

    // 3. Payload 구성 (타입 확정)
    // 여기서 필수 필드들은 위에서 체크했으므로 string 타입임이 보장됨
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

export async function updateInventoryAction(id: string, data: Partial<Inventory>) {
  const supabase = await createClient()
  
  try {
    // 1. UI 전용 필드 및 변경하지 않을 필드 제거
    const { 
      client,
      is_active,
      is_replacement_before,
      is_replacement_after,
      is_withdrawal,
      final_counts,
      created_at,      // 생성일은 수정 안 함
      organization_id, // 소속 조직은 수정 안 함
      ...dbData 
    } = data;

    // update는 일부 필드만 있어도 되므로 별도 필수값 체크 불필요
    const { error } = await supabase.from('inventory').update(dbData).eq('id', id)
    if (error) throw error

    revalidatePath('/inventory')
    return { success: true, message: '수정되었습니다.' }
  } catch (e: any) {
    return { success: false, message: '수정 실패: ' + e.message }
  }
}

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