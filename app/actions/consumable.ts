'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

// 1. 소모품 목록 조회
export async function getConsumablesAction(categoryGroup?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, data: [] }

  const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
  if (!profile?.organization_id) return { success: false, data: [] }

  let query = supabase
    .from('consumables')
    .select('*')
    .eq('organization_id', profile.organization_id)
    .order('category')
    .order('model_name')

  // 카테고리 필터링 (탭 기능 지원)
  if (categoryGroup === 'consumables') {
    query = query.in('category', ['토너', '드럼', '현상기', '폐토너통', '용지'])
  } else if (categoryGroup === 'parts') {
    query = query.in('category', ['부품', '롤러', '기어', 'Fuser'])
  } else if (categoryGroup === 'others') {
    query = query.not('category', 'in', '("토너","드럼","현상기","폐토너통","용지","부품","롤러","기어","Fuser")')
  }

  const { data, error } = await query

  if (error) {
    console.error(error)
    return { success: false, data: [] }
  }

  return { success: true, data: data }
}

// 2. 소모품 등록/수정
export async function upsertConsumableAction(formData: any) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: '로그인 필요' }

  const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
  
  const payload = {
    ...formData,
    organization_id: profile?.organization_id,
    current_stock: Number(formData.current_stock),
    unit_price: Number(formData.unit_price)
  }

  const { error } = await supabase
    .from('consumables')
    .upsert(payload) // ID가 있으면 수정, 없으면 등록

  if (error) return { success: false, message: error.message }
  
  revalidatePath('/inventory')
  return { success: true, message: '저장되었습니다.' }
}

// 3. 소모품 삭제
export async function deleteConsumableAction(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('consumables').delete().eq('id', id)
  
  if (error) return { success: false, message: error.message }
  
  revalidatePath('/inventory')
  return { success: true, message: '삭제되었습니다.' }
}