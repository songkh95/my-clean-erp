// app/actions/taxInvoice.ts
'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import type { HometaxTaxInvoiceRow } from '@/utils/taxInvoiceExcel'

async function requireOrg() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, error: '로그인이 필요합니다.' as string, orgId: null as string | null, userId: null as string | null }
  const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
  if (!profile?.organization_id) return { supabase, error: '조직 정보를 찾을 수 없습니다.', orgId: null, userId: user.id }
  return { supabase, error: null, orgId: profile.organization_id as string, userId: user.id }
}

export type TaxInvoiceStatus = '정상' | '취소' | '수정발행됨'

/** 정산 건에 딸린 세금계산서 발행 이력 (원본+취소/수정 묶음) */
export async function getTaxInvoicesForSettlementAction(settlementId: string) {
  const { supabase, error: authErr, orgId } = await requireOrg()
  if (authErr || !orgId) return { success: false, message: authErr || '조직 정보 없음', data: [] as any[] }

  const { data, error } = await supabase
    .from('tax_invoices')
    .select('*')
    .eq('organization_id', orgId)
    .eq('settlement_id', settlementId)
    .order('created_at', { ascending: true })

  if (error) return { success: false, message: error.message, data: [] as any[] }
  return { success: true, data: data || [] }
}

/**
 * 홈택스에서 수동 발행한 세금계산서의 결과(승인번호 등)를 ERP에 기록한다.
 * status가 '취소' 또는 '수정발행됨'이면 originalInvoiceId로 원본과 묶는다.
 */
export async function recordTaxInvoiceAction(input: {
  settlementId: string
  status?: TaxInvoiceStatus
  originalInvoiceId?: string | null
  issuedAt: string
  approvalNo?: string | null
  amount?: number | null
  memo?: string | null
}) {
  const { supabase, error: authErr, orgId, userId } = await requireOrg()
  if (authErr || !orgId) return { success: false, message: authErr || '조직 정보 없음' }

  if (!input.issuedAt) return { success: false, message: '발행일을 입력해 주세요.' }

  const status = input.status || '정상'
  if ((status === '취소' || status === '수정발행됨') && !input.originalInvoiceId) {
    return { success: false, message: '취소·수정발행은 원본 세금계산서를 선택해야 합니다.' }
  }

  try {
    const { error } = await supabase.from('tax_invoices').insert({
      organization_id: orgId,
      settlement_id: input.settlementId,
      status,
      original_invoice_id: input.originalInvoiceId || null,
      issued_at: input.issuedAt,
      approval_no: input.approvalNo || null,
      amount: input.amount ?? null,
      memo: input.memo || null,
      created_by: userId,
    })
    if (error) throw error

    revalidatePath('/accounting/history')
    revalidatePath('/accounting/registration')
    return { success: true, message: '세금계산서 발행 기록이 저장되었습니다.' }
  } catch (e: any) {
    return { success: false, message: '저장 실패: ' + e.message }
  }
}

export type TaxInvoiceImportResult = {
  approvalNo: string
  buyerName: string
  totalAmount: number
  status: 'imported' | 'already_recorded' | 'no_client_match' | 'no_settlement_match' | 'ambiguous' | 'amount_mismatch'
  detail?: string
}

/**
 * 홈택스 "매출 전자세금계산서 목록조회" 엑셀(클라이언트에서 파싱된 행)을 업로드해
 * 거래처명 + 작성월로 정산 건을 찾아 tax_invoices에 자동 기록한다.
 * 애매하거나 못 찾은 건은 건드리지 않고 사유와 함께 목록으로 돌려준다 (수동으로 처리하도록).
 */
export async function importTaxInvoicesFromExcelAction(rows: HometaxTaxInvoiceRow[]) {
  const { supabase, error: authErr, orgId, userId } = await requireOrg()
  if (authErr || !orgId) return { success: false, message: authErr || '조직 정보 없음', results: [] as TaxInvoiceImportResult[] }

  const results: TaxInvoiceImportResult[] = []

  try {
    // 이미 기록된 승인번호 목록
    const approvalNos = rows.map((r) => r.approvalNo).filter(Boolean)
    const { data: existing } = approvalNos.length
      ? await supabase.from('tax_invoices').select('approval_no').eq('organization_id', orgId).in('approval_no', approvalNos)
      : { data: [] as { approval_no: string | null }[] }
    const existingSet = new Set((existing || []).map((e) => e.approval_no))

    const { data: clients } = await supabase
      .from('clients')
      .select('id, name')
      .eq('organization_id', orgId)
      .eq('is_deleted', false)
    const clientByName = new Map((clients || []).map((c) => [c.name.trim().toLowerCase(), c.id]))

    for (const row of rows) {
      if (!row.approvalNo) continue

      if (existingSet.has(row.approvalNo)) {
        results.push({ approvalNo: row.approvalNo, buyerName: row.buyerName, totalAmount: row.totalAmount, status: 'already_recorded' })
        continue
      }

      const clientId = clientByName.get(row.buyerName.trim().toLowerCase())
      if (!clientId) {
        results.push({ approvalNo: row.approvalNo, buyerName: row.buyerName, totalAmount: row.totalAmount, status: 'no_client_match', detail: `거래처명 "${row.buyerName}"과 일치하는 거래처를 찾지 못함` })
        continue
      }

      const writtenDate = row.writtenDate ? new Date(row.writtenDate) : null
      if (!writtenDate || Number.isNaN(writtenDate.getTime())) {
        results.push({ approvalNo: row.approvalNo, buyerName: row.buyerName, totalAmount: row.totalAmount, status: 'no_settlement_match', detail: '작성일자를 해석하지 못함' })
        continue
      }
      const billingYear = writtenDate.getFullYear()
      const billingMonth = writtenDate.getMonth() + 1

      const { data: settlements } = await supabase
        .from('settlements')
        .select('id, total_amount')
        .eq('organization_id', orgId)
        .eq('client_id', clientId)
        .eq('billing_year', billingYear)
        .eq('billing_month', billingMonth)

      if (!settlements || settlements.length === 0) {
        results.push({ approvalNo: row.approvalNo, buyerName: row.buyerName, totalAmount: row.totalAmount, status: 'no_settlement_match', detail: `${billingYear}.${billingMonth} 정산 건 없음` })
        continue
      }
      if (settlements.length > 1) {
        results.push({ approvalNo: row.approvalNo, buyerName: row.buyerName, totalAmount: row.totalAmount, status: 'ambiguous', detail: `${billingYear}.${billingMonth} 정산 건이 ${settlements.length}개라 자동 매칭 보류` })
        continue
      }

      const settlement = settlements[0]
      if (settlement.total_amount != null && settlement.total_amount !== row.totalAmount) {
        results.push({
          approvalNo: row.approvalNo,
          buyerName: row.buyerName,
          totalAmount: row.totalAmount,
          status: 'amount_mismatch',
          detail: `ERP 청구액 ${settlement.total_amount.toLocaleString()}원 ≠ 세금계산서 ${row.totalAmount.toLocaleString()}원`,
        })
        continue
      }

      const { error: insErr } = await supabase.from('tax_invoices').insert({
        organization_id: orgId,
        settlement_id: settlement.id,
        status: row.invoiceType.includes('수정') ? '수정발행됨' : '정상',
        issued_at: row.issuedDate || row.writtenDate,
        approval_no: row.approvalNo,
        amount: row.totalAmount,
        memo: row.note || null,
        created_by: userId,
      })

      if (insErr) {
        results.push({ approvalNo: row.approvalNo, buyerName: row.buyerName, totalAmount: row.totalAmount, status: 'no_settlement_match', detail: insErr.message })
        continue
      }

      results.push({ approvalNo: row.approvalNo, buyerName: row.buyerName, totalAmount: row.totalAmount, status: 'imported' })
    }

    revalidatePath('/accounting/history')
    revalidatePath('/accounting/dashboard')

    const imported = results.filter((r) => r.status === 'imported').length
    return { success: true, message: `${imported}건 기록됨 (전체 ${results.length}건)`, results }
  } catch (e: any) {
    return { success: false, message: '가져오기 실패: ' + e.message, results }
  }
}

/** 잘못 기록한 발행 이력 삭제 (완전 삭제 — 실제 국세청 발행 취소가 아니라 ERP 입력 실수 정정용) */
export async function deleteTaxInvoiceRecordAction(id: string) {
  const { supabase, error: authErr, orgId } = await requireOrg()
  if (authErr || !orgId) return { success: false, message: authErr || '조직 정보 없음' }

  const { error } = await supabase
    .from('tax_invoices')
    .delete()
    .eq('id', id)
    .eq('organization_id', orgId)

  if (error) return { success: false, message: '삭제 실패: ' + error.message }

  revalidatePath('/accounting/history')
  return { success: true, message: '기록을 삭제했습니다.' }
}
