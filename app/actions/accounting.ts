// app/actions/accounting.ts
'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { calcGrandTotal, nextYearMonth } from '@/utils/billingAmounts'
import { calculateSingleDetailAmount } from '@/utils/billingCalculator'

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

async function refreshSettlementTotal(
  supabase: Awaited<ReturnType<typeof createClient>>,
  settlementId: string
) {
  const { data: details } = await supabase
    .from('settlement_details')
    .select('calculated_amount')
    .eq('settlement_id', settlementId)

  const supply = (details || []).reduce((sum, d) => sum + (d.calculated_amount || 0), 0)
  const total = calcGrandTotal(supply)
  await supabase.from('settlements').update({ total_amount: total }).eq('id', settlementId)
  return total
}

// 1. 월 정산 내역 일괄 저장 (기기 단위 — 기존 거래처 settlement에 detail append 가능)
export async function saveSettlementAction(unsafeParams: unknown) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: '로그인이 필요합니다.' }

  const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
  if (!profile?.organization_id) return { success: false, message: '조직 정보를 찾을 수 없습니다.' }

  const orgId = profile.organization_id!

  try {
    const params = SettlementSchema.parse(unsafeParams)
    const allInvIds = params.clientData.flatMap(c => c.details.map(d => d.inventory_id))

    if (allInvIds.length === 0) {
      return { success: false, message: '저장할 기기가 없습니다.' }
    }

    // 기기 단위 중복 검사 (같은 연월에 이미 detail이 있으면 거부)
    const { data: existingMonthSettlements } = await supabase
      .from('settlements')
      .select('id')
      .eq('organization_id', orgId)
      .eq('billing_year', params.year)
      .eq('billing_month', params.month)

    const monthSettlementIds = (existingMonthSettlements || []).map(s => s.id)
    if (monthSettlementIds.length > 0) {
      const { data: dupDetails } = await supabase
        .from('settlement_details')
        .select('inventory_id, inventory:inventory(model_name, serial_number)')
        .in('settlement_id', monthSettlementIds)
        .in('inventory_id', allInvIds)

      if (dupDetails && dupDetails.length > 0) {
        const names = dupDetails.map((d: any) =>
          d.inventory ? `${d.inventory.model_name}(${d.inventory.serial_number})` : d.inventory_id
        ).join(', ')
        return {
          success: false,
          message: `⛔ 이미 해당 월에 정산된 기기가 있습니다.\n중복: ${names}\n\n[조회] 후 미정산 기기만 선택해주세요.`
        }
      }
    }

    for (const item of params.clientData) {
      const { data: existingSettlement } = await supabase
        .from('settlements')
        .select('id, total_amount, is_paid')
        .eq('organization_id', orgId)
        .eq('client_id', item.client.id)
        .eq('billing_year', params.year)
        .eq('billing_month', params.month)
        .maybeSingle()

      if (existingSettlement?.is_paid) {
        throw new Error('이미 입금 완료된 청구서가 있어 기기를 추가할 수 없습니다.')
      }

      let settlementId = existingSettlement?.id

      if (!settlementId) {
        const invoiceTotal = calcGrandTotal(item.totalAmount)
        const { data: settlement, error: sErr } = await supabase.from('settlements').insert({
          organization_id: orgId,
          client_id: item.client.id,
          billing_year: params.year,
          billing_month: params.month,
          total_amount: invoiceTotal,
          is_paid: false
        }).select('id').single()

        if (sErr || !settlement) throw new Error(`정산서 생성 실패: ${sErr?.message}`)
        settlementId = settlement.id
      }

      const detailsPayload = item.details.map(d => ({
        settlement_id: settlementId!,
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
      }))

      const { error: dErr } = await supabase.from('settlement_details').insert(detailsPayload)
      if (dErr) throw new Error(`상세내역 저장 실패: ${dErr.message}`)

      await refreshSettlementTotal(supabase, settlementId!)
    }

    revalidatePath('/accounting')
    revalidatePath('/accounting/registration')
    revalidatePath('/accounting/history')
    return { success: true, message: '정산이 정상적으로 완료되었습니다!' }

  } catch (error: any) {
    console.error('Save Error:', error)
    return { success: false, message: '저장 실패: ' + error.message }
  }
}

export async function deleteSettlementAction(settlementId: string) {
  const supabase = await createClient()
  try {
    await supabase.from('settlement_details').delete().eq('settlement_id', settlementId)
    const { error } = await supabase.from('settlements').delete().eq('id', settlementId)
    if (error) throw error
    revalidatePath('/accounting')
    revalidatePath('/accounting/registration')
    revalidatePath('/accounting/history')
    return { success: true, message: '삭제되었습니다.' }
  } catch (e: any) {
    return { success: false, message: '삭제 실패: ' + e.message }
  }
}

export async function rebillSettlementHistoryAction(settlementId: string) {
  return deleteSettlementAction(settlementId);
}

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
    if (count === 0) {
      await supabase.from('settlements').delete().eq('id', settlementId)
    } else {
      await refreshSettlementTotal(supabase, settlementId)
    }

    revalidatePath('/accounting')
    revalidatePath('/accounting/history')
    return { success: true, message: '처리되었습니다.' }
  } catch (e: any) {
    return { success: false, message: '실패: ' + e.message }
  }
}

export async function deleteSettlementDetailAction(
  settlementId: string, detailId: string, amountToRemove: number
) {
  const supabase = await createClient()
  try {
    await supabase.from('settlement_details').delete().eq('id', detailId)
    const { count } = await supabase
      .from('settlement_details')
      .select('*', { count: 'exact', head: true })
      .eq('settlement_id', settlementId)

    if ((count || 0) === 0) {
      await supabase.from('settlements').delete().eq('id', settlementId)
    } else {
      await refreshSettlementTotal(supabase, settlementId)
    }

    revalidatePath('/accounting')
    revalidatePath('/accounting/history')
    return { success: true, message: '내역이 삭제되었습니다.' }
  } catch (e: any) {
    return { success: false, message: '실패: ' + e.message }
  }
}

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

// 미래 정산 검사 — 실패 시 fail-closed
export async function checkFutureSettlementsAction(inventoryId: string, year: number, month: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { hasFuture: false, error: true, message: '로그인이 필요합니다.' }

  const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
  if (!profile?.organization_id) {
    return { hasFuture: false, error: true, message: '조직 정보를 찾을 수 없습니다.' }
  }

  const { count, error } = await supabase
    .from('settlements')
    .select('id, billing_year, billing_month, settlement_details!inner(inventory_id)', { count: 'exact', head: true })
    .eq('organization_id', profile.organization_id)
    .eq('settlement_details.inventory_id', inventoryId)
    .or(`billing_year.gt.${year},and(billing_year.eq.${year},billing_month.gt.${month})`)

  if (error) {
    console.error('Check Future Error:', error)
    return { hasFuture: false, error: true, message: '미래 정산 검증에 실패했습니다. 잠시 후 다시 시도해주세요.' }
  }

  return { hasFuture: (count || 0) > 0, error: false }
}

/** 이력 일괄 수정 — A3/변환/금액/헤더합계 + 다음 달 전월 지침 cascade */
export async function updateBulkSettlementHistoryAction(updates: any[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: '로그인이 필요합니다.' }

  const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
  if (!profile?.organization_id) return { success: false, message: '조직 정보가 없습니다.' }

  const orgId = profile.organization_id
  const cascadeWarnings: string[] = []
  const touchedSettlementIds = new Set<string>()

  try {
    for (const item of updates) {
      if (item.settlement?.is_paid) {
        throw new Error('이미 입금 처리된 내역은 수정할 수 없습니다.')
      }

      const prev = {
        bw: item.prev_count_bw || 0,
        col: item.prev_count_col || 0,
        bw_a3: item.prev_count_bw_a3 || 0,
        col_a3: item.prev_count_col_a3 || 0,
      }
      const curr = {
        bw: item.curr_count_bw || 0,
        col: item.curr_count_col || 0,
        bw_a3: item.curr_count_bw_a3 || 0,
        col_a3: item.curr_count_col_a3 || 0,
      }

      const inv = item.inventory || {}
      const computed = calculateSingleDetailAmount({
        prev,
        curr,
        plan_basic_fee: inv.plan_basic_fee,
        plan_basic_cnt_bw: inv.plan_basic_cnt_bw,
        plan_basic_cnt_col: inv.plan_basic_cnt_col,
        plan_price_bw: inv.plan_price_bw,
        plan_price_col: inv.plan_price_col,
        plan_weight_a3_bw: inv.plan_weight_a3_bw,
        plan_weight_a3_col: inv.plan_weight_a3_col,
      })

      // 클라이언트가 보낸 금액이 있으면 우선(그룹 재계산 결과), 없으면 단기기 재계산
      const amount = typeof item.calculated_amount === 'number'
        ? item.calculated_amount
        : computed.amount
      const usage = {
        bw: Math.max(0, item.usage_bw ?? computed.usage.bw),
        col: Math.max(0, item.usage_col ?? computed.usage.col),
        bw_a3: Math.max(0, item.usage_bw_a3 ?? computed.usage.bw_a3),
        col_a3: Math.max(0, item.usage_col_a3 ?? computed.usage.col_a3),
      }
      const converted = {
        bw: item.converted_usage_bw ?? computed.converted.bw,
        col: item.converted_usage_col ?? computed.converted.col,
      }

      const { error: updateError } = await supabase
        .from('settlement_details')
        .update({
          prev_count_bw: prev.bw,
          prev_count_col: prev.col,
          prev_count_bw_a3: prev.bw_a3,
          prev_count_col_a3: prev.col_a3,
          curr_count_bw: curr.bw,
          curr_count_col: curr.col,
          curr_count_bw_a3: curr.bw_a3,
          curr_count_col_a3: curr.col_a3,
          usage_bw: usage.bw,
          usage_col: usage.col,
          usage_bw_a3: usage.bw_a3,
          usage_col_a3: usage.col_a3,
          converted_usage_bw: converted.bw,
          converted_usage_col: converted.col,
          calculated_amount: amount,
        })
        .eq('id', item.id)
        .eq('inventory_id', item.inventory_id)

      if (updateError) throw updateError

      const settlementId = item.settlement_id || item.settlement?.id
      if (settlementId) touchedSettlementIds.add(settlementId)

      await supabase.from('machine_history').insert({
        inventory_id: item.inventory_id,
        organization_id: orgId,
        action_type: 'UPDATE_PAST',
        memo: `[이력 수정] ${item.settlement.billing_year}년 ${item.settlement.billing_month}월`,
        bw_count: curr.bw,
        col_count: curr.col,
        bw_a3_count: curr.bw_a3,
        col_a3_count: curr.col_a3,
        recorded_at: new Date().toISOString()
      })

      // 다음 달 전월 지침 cascade
      const { year: nY, month: nM } = nextYearMonth(
        item.settlement.billing_year,
        item.settlement.billing_month
      )

      const { data: nextSettlements } = await supabase
        .from('settlements')
        .select('id, is_paid')
        .eq('organization_id', orgId)
        .eq('billing_year', nY)
        .eq('billing_month', nM)

      if (nextSettlements && nextSettlements.length > 0) {
        const nextIds = nextSettlements.map(s => s.id)
        const { data: nextDetails } = await supabase
          .from('settlement_details')
          .select('*, settlement:settlements(id, is_paid), inventory:inventory(plan_basic_fee, plan_price_bw, plan_price_col, plan_basic_cnt_bw, plan_basic_cnt_col, plan_weight_a3_bw, plan_weight_a3_col)')
          .in('settlement_id', nextIds)
          .eq('inventory_id', item.inventory_id)

        for (const next of nextDetails || []) {
          const paid = (next as any).settlement?.is_paid
          if (paid) {
            cascadeWarnings.push(
              `${nY}-${nM} 입금완료 건은 전월 지침을 자동 반영하지 못했습니다.`
            )
            continue
          }

          const nextPrev = { ...curr }
          const nextCurr = {
            bw: next.curr_count_bw || 0,
            col: next.curr_count_col || 0,
            bw_a3: next.curr_count_bw_a3 || 0,
            col_a3: next.curr_count_col_a3 || 0,
          }
          const invPlan = (next as any).inventory || {}
          const nextComputed = calculateSingleDetailAmount({
            prev: nextPrev,
            curr: nextCurr,
            ...invPlan,
          })

          await supabase.from('settlement_details').update({
            prev_count_bw: nextPrev.bw,
            prev_count_col: nextPrev.col,
            prev_count_bw_a3: nextPrev.bw_a3,
            prev_count_col_a3: nextPrev.col_a3,
            usage_bw: nextComputed.usage.bw,
            usage_col: nextComputed.usage.col,
            usage_bw_a3: nextComputed.usage.bw_a3,
            usage_col_a3: nextComputed.usage.col_a3,
            converted_usage_bw: nextComputed.converted.bw,
            converted_usage_col: nextComputed.converted.col,
            calculated_amount: nextComputed.amount,
          }).eq('id', next.id)

          if (next.settlement_id) {
            touchedSettlementIds.add(next.settlement_id)
          }
        }
      }
    }

    for (const sid of touchedSettlementIds) {
      await refreshSettlementTotal(supabase, sid)
    }

    revalidatePath('/accounting/history')
    revalidatePath('/accounting/registration')

    const msg = cascadeWarnings.length > 0
      ? `수정되었습니다.\n\n⚠️ 주의:\n- ${cascadeWarnings.join('\n- ')}`
      : '수정사항이 저장되었습니다. (다음 달 전월 지침도 반영)'

    return { success: true, message: msg }

  } catch (e: any) {
    return { success: false, message: '업데이트 실패: ' + e.message }
  }
}

export async function fetchClientTimelineAction(clientId: string, startYear: number, endYear: number) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, message: '로그인이 필요합니다.', data: [] }

  const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
  if (!profile?.organization_id) return { success: false, message: '조직 정보를 찾을 수 없습니다.', data: [] }

  try {
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
      .order('id', { ascending: true })

    if (error) throw error

    const sortedData = data?.sort((a: any, b: any) => {
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
