'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { Client } from '@/app/types'

export async function createClientAction(data: Partial<Client>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: '로그인이 필요합니다.' }

  const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
  if (!profile?.organization_id) return { success: false, message: '조직 정보를 찾을 수 없습니다.' }

  try {
    // 1. 필수 데이터 검증 (DB Not Null 제약조건 준수)
    if (!data.name) {
      return { success: false, message: '거래처명을 입력해주세요.' }
    }

    // 2. 불필요한 필드 제거 (id, created_at 등)
    const { id, created_at, updated_at, ...rest } = data;

    // 3. Payload 구성 (타입 확정)
    // name이 위에서 체크되었으므로 string 타입임이 보장됩니다.
    const payload = {
      ...rest,
      name: data.name, 
      organization_id: profile.organization_id,
      is_deleted: false,
      status: 'active'
    }

    const { error } = await supabase.from('clients').insert(payload)
    if (error) throw error

    revalidatePath('/clients')
    return { success: true, message: '거래처가 등록되었습니다.' }
  } catch (e: any) {
    return { success: false, message: '등록 실패: ' + e.message }
  }
}

export async function updateClientAction(id: string, data: Partial<Client>) {
  const supabase = await createClient()
  
  try {
    // 업데이트 시에는 organization_id 등 보안 필드는 제외하고 수정할 데이터만 전달
    const { id: _, organization_id, created_at, ...updateData } = data;

    const { error } = await supabase.from('clients').update(updateData).eq('id', id)
    if (error) throw error

    revalidatePath('/clients')
    return { success: true, message: '수정되었습니다.' }
  } catch (e: any) {
    return { success: false, message: '수정 실패: ' + e.message }
  }
}

export async function deleteClientAction(id: string) {
  const supabase = await createClient()
  try {
    // Soft Delete (is_deleted = true)
    const { error } = await supabase.from('clients').update({ is_deleted: true }).eq('id', id)
    if (error) throw error

    revalidatePath('/clients')
    return { success: true, message: '삭제되었습니다.' }
  } catch (e: any) {
    return { success: false, message: '삭제 실패: ' + e.message }
  }
}