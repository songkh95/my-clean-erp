'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// 1. 입력 데이터 검증을 위한 "보안 검색대(Schema)" 정의
const SettlementSchema = z.object({
  year: z.number(),
  month: z.number(),
  clientData: z.array(z.object({
    client: z.object({ id: z.string() }),
    totalAmount: z.number(),
    details: z.array(z.object({
      inventory_id: z.string(),
      prev: z.object({
        bw: z.number(), col: z.number(), bw_a3: z.number(), col_a3: z.number()
      }),
      curr: z.object({
        bw: z.number(), col: z.number(), bw_a3: z.number(), col_a3: z.number()
      }),
      isGroupLeader: z.boolean().optional(),
      rowCost: z.object({ total: z.number() }).optional(),
      is_replacement_before: z.boolean().optional(),
      is_replacement_after: z.boolean().optional(),
      is_withdrawal: z.boolean().optional()
    }))
  }))
})

export async function saveSettlementAction(unsafeParams: unknown) {
  const supabase = await createClient()

  // 2. 보안 점검 (로그인 및 조직 확인)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: '로그인이 필요합니다.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()
    
  if (!profile?.organization_id) return { success: false, message: '조직 정보를 찾을 수 없습니다.' }

  try {
    // 3. 데이터 정밀 검사 (Validation)
    const params = SettlementSchema.parse(unsafeParams)

    // 4. DB 함수(RPC)가 좋아하는 형태로 데이터 변환
    const payload = params.clientData.map(data => ({
      clientId: data.client.id,
      totalAmount: data.totalAmount,
      details: data.details.map(d => ({
        inventory_id: d.inventory_id,
        prev: d.prev,
        curr: d.curr,
        calculated_amount: d.isGroupLeader ? (d.rowCost?.total || 0) : 0,
        is_replacement_record: !!(d.is_replacement_before || d.is_withdrawal)
      }))
    }))

    // 5. RPC 호출 (트랜잭션 저장)
    const { error } = await supabase.rpc('save_monthly_settlement', {
      p_year: params.year,
      p_month: params.month,
      p_org_id: profile.organization_id,
      p_items: payload as unknown as any
    })

    if (error) throw new Error(error.message)

    revalidatePath('/accounting') 
    return { success: true, message: '정산이 안전하게 완료되었습니다!' }

  } catch (error: any) {
    console.error('Save Error:', error)
    
    // Zod 검증 실패 시 에러 처리 (수정됨)
    if (error instanceof z.ZodError) {
      // 🔴 수정됨: error.errors -> error.issues
      const firstError = error.issues[0]
      return { 
        success: false, 
        message: `데이터 형식 오류: ${firstError.path.join('.')} - ${firstError.message}` 
      }
    }
    
    return { success: false, message: '저장 실패: ' + error.message }
  }
}