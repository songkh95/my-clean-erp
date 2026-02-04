'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const SettlementSchema = z.object({
  year: z.number(),
  month: z.number(),
  clientData: z.array(z.object({
    client: z.object({ id: z.string() }).passthrough(),
    totalAmount: z.number(),
    details: z.array(z.object({
      inventory_id: z.string(),
      prev: z.object({ bw: z.number(), col: z.number(), bw_a3: z.number(), col_a3: z.number() }),
      curr: z.object({ bw: z.number(), col: z.number(), bw_a3: z.number(), col_a3: z.number() }),
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

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: '로그인이 필요합니다.' }

  const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
  if (!profile?.organization_id) return { success: false, message: '조직 정보를 찾을 수 없습니다.' }

  try {
    const params = SettlementSchema.parse(unsafeParams)

    // 🔴 [수정] DB 컬럼명(Snake Case)에 맞춰 키 이름 변경
    const payload = params.clientData.map(data => ({
      client_id: data.client.id,        // clientId -> client_id
      total_amount: data.totalAmount,   // totalAmount -> total_amount
      details: data.details.map(d => ({
        inventory_id: d.inventory_id,
        prev: d.prev,
        curr: d.curr,
        calculated_amount: d.isGroupLeader ? (d.rowCost?.total || 0) : 0,
        is_replacement_record: !!(d.is_replacement_before || d.is_withdrawal)
      }))
    }))

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
    if (error instanceof z.ZodError) {
      const firstError = error.issues[0]
      return { success: false, message: `데이터 형식 오류: ${firstError.path.join('.')} - ${firstError.message}` }
    }
    return { success: false, message: '저장 실패: ' + error.message }
  }
}