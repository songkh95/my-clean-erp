// app/actions/accounting.ts
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
      // 사용량 데이터 스키마 추가
      usage: z.object({ bw: z.number(), col: z.number(), bw_a3: z.number(), col_a3: z.number() }),
      converted: z.object({ bw: z.number(), col: z.number() }),
      
      isGroupLeader: z.boolean().optional(),
      rowCost: z.object({ total: z.number() }).optional(),
      is_replacement_before: z.boolean().optional(),
      is_replacement_after: z.boolean().optional(),
      is_withdrawal: z.boolean().optional()
    }))
  }))
})

// 1. 월 정산 내역 일괄 저장
export async function saveSettlementAction(unsafeParams: unknown) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: '로그인이 필요합니다.' }

  const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
  if (!profile?.organization_id) return { success: false, message: '조직 정보를 찾을 수 없습니다.' }

  try {
    const params = SettlementSchema.parse(unsafeParams)

    // 중복 검사
    const clientIds = params.clientData.map(d => d.client.id);
    const { data: duplicates } = await supabase
      .from('settlements')
      .select('client_id, clients(name)')
      .eq('organization_id', profile.organization_id)
      .eq('billing_year', params.year)
      .eq('billing_month', params.month)
      .in('client_id', clientIds);

    if (duplicates && duplicates.length > 0) {
      // @ts-ignore
      const dupNames = duplicates.map(d => d.clients?.name || '알수없음').join(', ');
      return { 
        success: false, 
        message: `⛔ 이미 정산된 거래처가 있습니다.\n중복: ${dupNames}\n\n[조회] 버튼을 눌러 목록을 갱신해주세요.` 
      };
    }

    // 병렬 저장
    const savePromises = params.clientData.map(async (item) => {
      const { data: settlement, error: sErr } = await supabase.from('settlements').insert({
        organization_id: profile.organization_id,
        client_id: item.client.id,
        billing_year: params.year,
        billing_month: params.month,
        total_amount: item.totalAmount,
        is_paid: false
      }).select().single();

      if (sErr || !settlement) throw new Error(`정산서 생성 실패 (${item.client.id}): ${sErr?.message}`);

      const detailsPayload = item.details.map(d => ({
        settlement_id: settlement.id,
        inventory_id: d.inventory_id,
        
        // 카운터 정보
        prev_count_bw: d.prev.bw,
        prev_count_col: d.prev.col,
        prev_count_bw_a3: d.prev.bw_a3,
        prev_count_col_a3: d.prev.col_a3,
        curr_count_bw: d.curr.bw,
        curr_count_col: d.curr.col,
        curr_count_bw_a3: d.curr.bw_a3,
        curr_count_col_a3: d.curr.col_a3,
        
        // ✅ [핵심 수정] 사용량 정보 저장 (이게 없어서 0으로 나왔습니다)
        usage_bw: d.usage.bw,
        usage_col: d.usage.col,
        usage_bw_a3: d.usage.bw_a3,
        usage_col_a3: d.usage.col_a3,
        converted_usage_bw: d.converted.bw,
        converted_usage_col: d.converted.col,

        calculated_amount: d.rowCost?.total || 0,
        is_replacement_record: !!(d.is_replacement_before || d.is_withdrawal)
      }));

      const { error: dErr } = await supabase.from('settlement_details').insert(detailsPayload);
      if (dErr) throw new Error(`상세내역 저장 실패: ${dErr.message}`);
    });

    await Promise.all(savePromises);

    revalidatePath('/accounting') 
    return { success: true, message: '정산이 정상적으로 완료되었습니다!' }

  } catch (error: any) {
    console.error('Save Error:', error)
    return { success: false, message: '저장 실패: ' + error.message }
  }
}

// 2. 청구 내역 삭제
export async function deleteSettlementAction(settlementId: string) {
  const supabase = await createClient()
  try {
    await supabase.from('settlement_details').delete().eq('settlement_id', settlementId)
    const { error } = await supabase.from('settlements').delete().eq('id', settlementId)
    if (error) throw error
    revalidatePath('/accounting')
    return { success: true, message: '삭제되었습니다.' }
  } catch (e: any) {
    return { success: false, message: '삭제 실패: ' + e.message }
  }
}

export async function rebillSettlementHistoryAction(settlementId: string) {
  return deleteSettlementAction(settlementId);
}

// 3. 일괄 삭제/재청구 액션
export async function deleteSettlementsAction(settlementIds: string[]) {
  const supabase = await createClient()
  try {
    await supabase.from('settlement_details').delete().in('settlement_id', settlementIds)
    const { error } = await supabase.from('settlements').delete().in('id', settlementIds)
    if (error) throw error
    revalidatePath('/accounting')
    return { success: true, message: '선택한 내역이 일괄 처리되었습니다.' }
  } catch (e: any) {
    return { success: false, message: '일괄 처리 실패: ' + e.message }
  }
}

// 4. 개별 기기 재청구
export async function rebillSettlementDetailAction(
  settlementId: string, detailId: string, inventoryId: string, isReplacement: boolean, clientId: string
) {
  const supabase = await createClient()
  try {
    await supabase.from('settlement_details').delete().eq('id', detailId)
    if (isReplacement) {
      await supabase.from('inventory').update({ status: '교체전(철수)', client_id: clientId }).eq('id', inventoryId)
    }
    const { count } = await supabase.from('settlement_details').select('*', { count: 'exact', head: true }).eq('settlement_id', settlementId)
    if (count === 0) await supabase.from('settlements').delete().eq('id', settlementId)

    revalidatePath('/accounting')
    return { success: true, message: '처리되었습니다.' }
  } catch (e: any) {
    return { success: false, message: '실패: ' + e.message }
  }
}

// 5. 개별 내역 삭제
export async function deleteSettlementDetailAction(
  settlementId: string, detailId: string, amountToRemove: number
) {
  const supabase = await createClient()
  try {
    await supabase.from('settlement_details').delete().eq('id', detailId)
    const { data: settlement } = await supabase.from('settlements').select('total_amount').eq('id', settlementId).single()
    if (settlement) {
      const newTotal = Math.max(0, (settlement.total_amount || 0) - amountToRemove)
      await supabase.from('settlements').update({ total_amount: newTotal }).eq('id', settlementId)
    }
    revalidatePath('/accounting')
    return { success: true, message: '내역이 삭제되었습니다.' }
  } catch (e: any) {
    return { success: false, message: '실패: ' + e.message }
  }
}

// 6. 입금 상태 변경
export async function toggleSettlementPaymentAction(settlementId: string, currentStatus: boolean) {
  const supabase = await createClient()
  try {
    const newStatus = !currentStatus
    await supabase.from('settlements').update({ is_paid: newStatus }).eq('id', settlementId)
    await supabase.from('settlement_details').update({ is_paid: newStatus }).eq('settlement_id', settlementId)
    revalidatePath('/accounting')
    return { success: true }
  } catch (e: any) { return { success: false, message: e.message } }
}

export async function toggleDetailPaymentAction(detailId: string, currentStatus: boolean) {
  const supabase = await createClient()
  try {
    await supabase.from('settlement_details').update({ is_paid: !currentStatus }).eq('id', detailId)
    revalidatePath('/accounting')
    return { success: true }
  } catch (e: any) { return { success: false, message: e.message } }
}