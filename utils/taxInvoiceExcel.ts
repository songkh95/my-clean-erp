// utils/taxInvoiceExcel.ts
// 홈택스 "매출 전자(수정)세금계산서 목록조회" 다운로드 파일(.xls/.xlsx) 파싱.
// 실제 다운로드 샘플 기준 컬럼(요약행 5줄 뒤에 헤더가 옴):
// 작성일자 | 승인번호 | 발급일자 | 전송일자 | 공급자사업자등록번호 | 종사업장번호 | 상호 | 대표자명 | 주소
// | 공급받는자사업자등록번호 | 종사업장번호 | 상호 | 대표자명 | 주소 | 합계금액 | 공급가액 | 세액
// | 전자세금계산서분류 | 전자세금계산서종류 | 발급유형 | 비고 | 영수/청구 구분 | 공급자 이메일
// | 공급받는자 이메일1 | 공급받는자 이메일2 | 품목일자 | 품목명 | 품목규격 | 품목수량 | 품목단가
// | 품목공급가액 | 품목세액 | 품목비고
// 품목이 여러 줄이면 같은 승인번호가 여러 행에 걸쳐 반복되므로, 승인번호 기준으로 1건씩 묶는다.

import * as XLSX from 'xlsx'

export type HometaxTaxInvoiceRow = {
  writtenDate: string // 작성일자
  approvalNo: string // 승인번호
  issuedDate: string // 발급일자
  buyerBizNo: string // 공급받는자사업자등록번호
  buyerName: string // 공급받는자 상호
  totalAmount: number // 합계금액
  supplyAmount: number // 공급가액
  taxAmount: number // 세액
  invoiceType: string // 전자세금계산서분류 (세금계산서/수정세금계산서 등)
  note: string // 비고
}

function toNumber(v: unknown): number {
  const s = String(v ?? '').replace(/,/g, '').trim()
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

function toStr(v: unknown): string {
  return String(v ?? '').trim()
}

/** 헤더 행 인덱스를 찾는다 ('승인번호' 셀이 있는 첫 행). */
function findHeaderRowIndex(rows: unknown[][]): number {
  for (let i = 0; i < rows.length; i++) {
    if ((rows[i] || []).some((cell) => toStr(cell) === '승인번호')) return i
  }
  return -1
}

export function parseHometaxTaxInvoiceExcel(buffer: ArrayBuffer): {
  ok: true
  rows: HometaxTaxInvoiceRow[]
} | {
  ok: false
  message: string
} {
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })

  const headerIdx = findHeaderRowIndex(raw)
  if (headerIdx === -1) {
    return { ok: false, message: '홈택스 세금계산서 목록조회 파일이 맞는지 확인해 주세요 ("승인번호" 컬럼을 찾을 수 없습니다).' }
  }

  const headers = (raw[headerIdx] || []).map((h) => toStr(h))
  const col = (name: string) => headers.indexOf(name)

  const idx = {
    writtenDate: col('작성일자'),
    approvalNo: col('승인번호'),
    issuedDate: col('발급일자'),
    buyerBizNo: col('공급받는자사업자등록번호'),
    // 공급자/공급받는자 둘 다 '상호' 컬럼이 있어 두 번째 등장(공급받는자)을 찾는다
    buyerName: headers.indexOf('상호', headers.indexOf('상호') + 1),
    totalAmount: col('합계금액'),
    supplyAmount: col('공급가액'),
    taxAmount: col('세액'),
    invoiceType: col('전자세금계산서분류'),
    note: col('비고'),
  }

  if (idx.approvalNo === -1 || idx.totalAmount === -1) {
    return { ok: false, message: '필요한 컬럼(승인번호/합계금액)을 찾지 못했습니다. 홈택스 양식이 바뀌었을 수 있습니다.' }
  }

  const dataRows = raw.slice(headerIdx + 1).filter((r) => (r || []).some((c) => toStr(c) !== ''))

  const byApprovalNo = new Map<string, HometaxTaxInvoiceRow>()
  for (const r of dataRows) {
    const approvalNo = toStr(r[idx.approvalNo])
    if (!approvalNo) continue
    if (byApprovalNo.has(approvalNo)) continue // 같은 승인번호(품목 여러 줄)는 첫 줄만 사용

    byApprovalNo.set(approvalNo, {
      writtenDate: toStr(r[idx.writtenDate]),
      approvalNo,
      issuedDate: toStr(r[idx.issuedDate]),
      buyerBizNo: toStr(r[idx.buyerBizNo]),
      buyerName: idx.buyerName >= 0 ? toStr(r[idx.buyerName]) : '',
      totalAmount: toNumber(r[idx.totalAmount]),
      supplyAmount: toNumber(r[idx.supplyAmount]),
      taxAmount: toNumber(r[idx.taxAmount]),
      invoiceType: idx.invoiceType >= 0 ? toStr(r[idx.invoiceType]) : '',
      note: idx.note >= 0 ? toStr(r[idx.note]) : '',
    })
  }

  return { ok: true, rows: Array.from(byApprovalNo.values()) }
}
