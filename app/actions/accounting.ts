'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { CalculatedAsset, Client } from '@/app/types'

interface SaveSettlementParams {
  year: number
  month: number
  clientData: {
    client: Client
    details: CalculatedAsset[]
    totalAmount: number
  }[]
}

export async function saveSettlementAction(params: SaveSettlementParams) {
  const supabase = await createClient()

  // 1. 보안 점검
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, message: '로그인이 필요합니다.' }
  }

  // 2. 내 조직 ID 가져오기
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()
    
  if (!profile?.organization_id) {
    return { success: false, message: '조직 정보를 찾을 수 없습니다.' }
  }
  const orgId = profile.organization_id

  try {
    // 3. 실제 저장 로직
    for (const data of params.clientData) {
      const { client, details, totalAmount } = data
      
      const { data: existing } = await supabase
        .from('settlements')
        .select('id, total_amount')
        .eq('organization_id', orgId)
        .eq('client_id', client.id)
        .eq('billing_year', params.year)
        .eq('billing_month', params.month)
        .maybeSingle()

      let settlementId: string

      if (existing) {
        settlementId = existing.id
        await supabase
          .from('settlements')
          .update({ 
            total_amount: (existing.total_amount || 0) + totalAmount
          })
          .eq('id', settlementId)
      } else {
        const { data: newSettlement, error: insertError } = await supabase
          .from('settlements')
          .insert({
            organization_id: orgId,
            client_id: client.id,
            billing_year: params.year,
            billing_month: params.month,
            total_amount: totalAmount,
            is_paid: false
          })
          .select()
          .single()

        if (insertError || !newSettlement) throw new Error(insertError?.message || '정산서 생성 실패')
        settlementId = newSettlement.id
      }

      const detailsPayload = details.map(d => ({
        settlement_id: settlementId,
        inventory_id: d.inventory_id,
        prev_count_bw: d.prev.bw,
        curr_count_bw: d.curr.bw,
        prev_count_col: d.prev.col,
        curr_count_col: d.curr.col,
        prev_count_bw_a3: d.prev.bw_a3,
        curr_count_bw_a3: d.curr.bw_a3,
        prev_count_col_a3: d.prev.col_a3,
        curr_count_col_a3: d.curr.col_a3,
        calculated_amount: d.isGroupLeader ? (d.rowCost?.total || 0) : 0,
        is_replacement_record: !!(d.is_replacement_before || d.is_withdrawal),
        is_paid: false
      }))

      const { error: detailsError } = await supabase
        .from('settlement_details')
        .insert(detailsPayload)
      
      if (detailsError) throw new Error(detailsError.message)

      // 상태 변경
      const withdrawnAssets = details.filter(d => d.is_replacement_before || d.is_withdrawal)
      if (withdrawnAssets.length > 0) {
        const ids = withdrawnAssets.map(d => d.inventory_id)
        
        await supabase
          .from('inventory')
          .update({ 
            status: '창고', 
            client_id: null,
            last_status_updated_at: new Date().toISOString()
          })
          .in('id', ids)
      }
    }

    revalidatePath('/accounting') 
    return { success: true, message: '정산이 완료되었습니다!' }

  } catch (error: any) {
    console.error('Server Action Error:', error)
    return { success: false, message: '저장 중 오류 발생: ' + error.message }
  }
}