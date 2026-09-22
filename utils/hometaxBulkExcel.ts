// utils/hometaxBulkExcel.ts
// 홈택스 "전자세금계산서 일괄등록(엑셀 업로드, 일반(영세율) - 100건 이하)" 양식에 맞춰
// ERP 정산 데이터를 채운 엑셀을 생성해 다운로드한다.
// 실제 홈택스 양식(2026-09-11 확보) 기준 59개 컬럼, 데이터는 7행(1-indexed)부터.
// 발행 자체는 여전히 홈택스에서 이 파일을 업로드해 수동으로 진행한다.

import * as XLSX from 'xlsx'
import type { HometaxUploadRow } from '@/app/actions/accounting'

export type HometaxOrgInfo = {
  name: string
  businessNumber: string
  representativeName: string
  address: string
  businessType: string
  businessItem: string
  email: string
}

const HEADER = [
  '전자(세금)계산서 종류\n(01:일반, 02:영세율)', '작성일자', '공급자 등록번호\n("-" 없이 입력)', '공급자\n 종사업장번호',
  '공급자 상호', '공급자 성명', '공급자 사업장주소', '공급자 업태', '공급자 종목', '공급자 이메일',
  '공급받는자 등록번호\n("-" 없이 입력)', '공급받는자 \n종사업장번호', '공급받는자 상호 ', '공급받는자 성명',
  '공급받는자 사업장주소', '공급받는자 업태', '공급받는자 종목', '공급받는자 이메일1', '공급받는자 이메일2',
  '공급가액\n합계', '세액\n합계', '비고',
  '일자1\n(2자리, 작성년월 제외)', '품목1', '규격1', '수량1', '단가1', '공급가액1', '세액1', '품목비고1',
  '일자2\n(2자리, 작성년월 제외)', '품목2', '규격2', '수량2', '단가2', '공급가액2', '세액2', '품목비고2',
  '일자3\n(2자리, 작성년월 제외)', '품목3', '규격3', '수량3', '단가3', '공급가액3', '세액3', '품목비고3',
  '일자4\n(2자리, 작성년월 제외)', '품목4', '규격4', '수량4', '단가4', '공급가액4', '세액4', '품목비고4',
  '현금', '수표', '어음', '외상미수금', '영수(01),\n청구(02)',
]

const NOTICE_ROWS: (string | null)[][] = [
  ['엑셀 업로드 양식(전자세금계산서-일반(영세율)) - 100건 이하'],
  ["○ 필수항목(주황색)은 반드시 입력하셔야 합니다.\n     > 아래 '항목설명' 및 '올바른 예시' 시트를 참고하여 작성하시기 바랍니다."],
  ['○ 임의로 양식을 변경[행 또는 열 추가 삭제 등]하는 경우 발급시 오류가 발생할 수 있으므로, 정해진 양식으로 작성하시기 바랍니다\n     > 실제 업로드할 DATA는 7행부터 입력하여야 하며, 최대 100건까지 입력이 가능합니다.(100건 초과 자료는 처리 안되며, 발급은 최대 50건씩 처리가능합니다)'],
  ["> 거래한 재화 또는 용역에 맞는 전자(세금)계산서 종류코드(01, 02)를 정확히 입력하셔야 합니다.\n     > 품목은 1건 이상 입력해야 합니다.\n     > 공급받는자 등록번호는 사업자등록번호, 주민등록번호를 입력할 수 있습니다. \n        외국인의 경우 공급받는자 등록번호(C열)에 '9999999999999'를 입력하시고, 비고란(N열)에  외국인등록번호 또는 여권번호를 입력하시기 바랍니다.\n     > 마지막 열(오른쪽 끝)의 '영수(01), 청구(02)'는 필수 항목이니 누락하지 마시기 바랍니다.(영수 : 대가를 받은 경우, 청구 : 대가를 아직 못 받은 경우)"],
  ["○ 처음 사용자께서는 '올바른 예시' 시트에 있는 내용을 복사ᆞ붙여넣기 하신 후 내용을 수정하시면 오류 없이 쉽게 발급하실 수 있습니다.\n     > 오류발생시 '잘못된 예시' 시트에 있는 내용들을 참고하시면 대표적인 오류 원인을 확인할 수 있습니다. \n○ 발급가능한 파일 확장자는 XLS, XLSX 입니다.\n○ 일괄발급에 도움을 받고자 하시면 국세상담센터(국번없이 126번→ 1번 → 2번)로 문의주시기 바랍니다."],
]

function ymd2(dateStr: string): string {
  // 일자1은 "2자리(작성년월 제외)" — 작성일자의 '일'만 2자리로
  const d = new Date(dateStr)
  return String(d.getDate()).padStart(2, '0')
}

export function buildHometaxBulkUploadRows(org: HometaxOrgInfo, rows: HometaxUploadRow[]): (string | number)[][] {
  const out: (string | number)[][] = []
  for (const n of NOTICE_ROWS) out.push([n[0] || ''])
  out.push(HEADER)

  for (const r of rows) {
    const day = ymd2(r.writtenDate)
    out.push([
      '01', r.writtenDate, org.businessNumber.replace(/-/g, ''), '',
      org.name, org.representativeName, org.address, org.businessType, org.businessItem, org.email,
      r.buyerBizNo, '', r.buyerName, r.buyerRepName,
      r.buyerAddress, '', '', r.buyerEmail, '',
      r.supplyAmount, r.taxAmount, '',
      day, r.itemName, '', 1, r.supplyAmount, r.supplyAmount, r.taxAmount, '',
      '', '', '', '', '', '', '', '',
      '', '', '', '', '', '', '', '',
      '', '', '', '', '', '', '', '',
      '', '', '', '', '02',
    ])
  }
  return out
}

export function downloadHometaxBulkUploadExcel(org: HometaxOrgInfo, rows: HometaxUploadRow[], fileName: string) {
  const data = buildHometaxBulkUploadRows(org, rows)
  const wb = XLSX.utils.book_new()
  const sheet = XLSX.utils.aoa_to_sheet(data)
  XLSX.utils.book_append_sheet(wb, sheet, 'Sheet1')
  XLSX.writeFile(wb, fileName)
}
