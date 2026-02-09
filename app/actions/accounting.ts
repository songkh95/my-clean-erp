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
        
        prev_count_bw: d.prev.bw,
        prev_count_col: d.prev.col,
        prev_count_bw_a3: d.prev.bw_a3,
        prev_count_col_a3: d.prev.col_a3,
        curr_count_bw: d.curr.bw,
        curr_count_col: d.curr.col,
        curr_count_bw_a3: d.curr.bw_a3,
        curr_count_col_a3: d.curr.col_a3,
        
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

// 7. [NEW] 미래 정산 내역 존재 여부 확인 (등록 검증용)
export async function checkFutureSettlementsAction(inventoryId: string, year: number, month: number) {
  const supabase = await createClient()
  
  // 입력된 년/월보다 미래의 데이터가 있는지 확인
  const { count, error } = await supabase
    .from('settlements')
    .select('id, billing_year, billing_month, settlement_details!inner(inventory_id)', { count: 'exact', head: true })
    .eq('settlement_details.inventory_id', inventoryId)
    .or(`billing_year.gt.${year},and(billing_year.eq.${year},billing_month.gt.${month})`)

  if (error) {
    console.error('Check Future Error:', error)
    return { hasFuture: false }
  }

  return { hasFuture: (count || 0) > 0 }
}

// 8. [NEW] 정산 내역 일괄 수정 (타임라인 수정용)
export async function updateBulkSettlementHistoryAction(updates: any[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: '로그인이 필요합니다.' }

  const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
  
  try {
    const updatePromises = updates.map(async (item) => {
      // 이미 입금완료된 건인지 확인 (보안)
      if (item.settlement?.is_paid) {
        throw new Error(`이미 입금 처리된 내역은 수정할 수 없습니다.`)
      }

      // settlement_details 업데이트
      const { error: updateError } = await supabase
        .from('settlement_details')
        .update({
          prev_count_bw: item.prev_count_bw,
          curr_count_bw: item.curr_count_bw,
          prev_count_col: item.prev_count_col,
          curr_count_col: item.curr_count_col,
          usage_bw: item.usage_bw,
          usage_col: item.usage_col,
          last_modified_at: new Date().toISOString(),
          last_modified_by: user.id
        })
        .eq('id', item.id)
        .eq('inventory_id', item.inventory_id)

      if (updateError) throw updateError

      // 수정 이력(Audit) 기록
      await supabase.from('machine_history').insert({
        inventory_id: item.inventory_id,
        organization_id: profile?.organization_id,
        action_type: 'UPDATE_PAST',
        memo: `[타임라인 수정] ${item.settlement.billing_year}년 ${item.settlement.billing_month}월 데이터 변경`,
        bw_count: item.curr_count_bw,
        col_count: item.curr_count_col,
        recorded_at: new Date().toISOString()
      })
    })

    await Promise.all(updatePromises)
    
    revalidatePath('/accounting/history')
    return { success: true, message: '수정사항이 저장되었습니다.' }

  } catch (e: any) {
    return { success: false, message: '업데이트 실패: ' + e.message }
  }
}

// 9. 특정 거래처의 정산 타임라인 조회 (타임라인 수정용)
export async function fetchClientTimelineAction(clientId: string, startYear: number, endYear: number) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: '로그인이 필요합니다.', data: [] }

  const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
  if (!profile?.organization_id) return { success: false, message: '조직 정보를 찾을 수 없습니다.', data: [] }

  try {
    // settlement_details를 조회하되, 부모인 settlements의 정보(년/월, 입금여부)와 
    // inventory의 정보(기기명, 요금제)를 함께 가져옵니다.
    const { data, error } = await supabase
      .from('settlement_details')
      .select(`
        *,
        settlement:settlements!inner (
          billing_year, billing_month, is_paid, client_id, organization_id
        ),
        inventory:inventory (
          model_name, serial_number, billing_group_id,
          plan_basic_fee, plan_price_bw, plan_price_col,
          plan_weight_a3_bw, plan_weight_a3_col,
          plan_basic_cnt_bw, plan_basic_cnt_col
        )
      `)
      .eq('settlement.organization_id', profile.organization_id)
      .eq('settlement.client_id', clientId)
      .gte('settlement.billing_year', startYear)
      .lte('settlement.billing_year', endYear)
      .order('id', { ascending: true }) // 1차 정렬 (DB 기준)

    if (error) throw error

    // 날짜순(년->월)으로 JavaScript 정렬 (정산 데이터는 시간 순서가 중요하므로)
    // @ts-ignore
    const sortedData = data?.sort((a, b) => {
        const dateA = a.settlement.billing_year * 100 + a.settlement.billing_month;
        const dateB = b.settlement.billing_year * 100 + b.settlement.billing_month;
        return dateA - dateB;
    }) || [];

    return { success: true, data: sortedData }

  } catch (e: any) {
    console.error('Timeline Fetch Error:', e)
    return { success: false, message: '타임라인 조회 실패: ' + e.message, data: [] }
  }
}