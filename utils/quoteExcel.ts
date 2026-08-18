import * as XLSX from 'xlsx'
import { formatQuoteDateKo, formatWon, numberToKoreanWon } from '@/utils/koreanAmount'
import { DEFAULT_FOOTER_NOTICE } from '@/utils/quoteDefaults'
import { calcQuoteTotals } from '@/utils/quoteTotals'

export type QuoteExportItem = {
  description: string
  unit: string
  quantity: number
  unit_price: number
  amount_text?: string | null
  exclude_from_total?: boolean
}

export type QuoteExportPayload = {
  quote_no?: string | null
  quote_date: string
  client_name: string
  notes?: string | null
  footer_notice?: string | null
  issuer_company?: string | null
  issuer_partner?: string | null
  issuer_manager?: string | null
  issuer_tel?: string | null
  issuer_hp?: string | null
  issuer_homepage?: string | null
  issuer_blog?: string | null
  vat_rate?: number
  items: QuoteExportItem[]
}

/** 기존 엑셀 양식과 비슷한 한 시트 견적서 */
export function exportQuoteToExcel(quote: QuoteExportPayload) {
  const vatRate = quote.vat_rate ?? 10
  const { supply, vat, total } = calcQuoteTotals(quote.items, vatRate)
  const rows: (string | number)[][] = []

  const showLeaseCol = quote.items.some((i) => Boolean(String(i.amount_text || '').trim()))

  rows.push(['', '見   積   書'])
  rows.push(['', `No. ${quote.quote_no || ''}`])
  rows.push(['', formatQuoteDateKo(quote.quote_date)])
  rows.push(['', `${quote.client_name}                    貴中`])
  rows.push([])
  rows.push(['', '아래와 같이 見積합니다.'])
  rows.push([])
  rows.push([])
  rows.push(['', '합 계 금 액', '金', numberToKoreanWon(total), '', '', formatWon(total)])
  if (showLeaseCol) {
    rows.push(['', ' Description ', '', ' Unit ', ' Quantity ', ' Unit Price ', ' Total Price ', ' Lease '])
    rows.push(['', ' 품 명 ', '', ' 단 위 ', ' 수 량 ', ' 단 가 ', ' 공급가액 ', ' 임대정보 '])
  } else {
    rows.push(['', ' Description ', '', ' Unit ', ' Quantity ', ' Unit Price ', ' Total Price '])
    rows.push(['', ' 품 명 ', '', ' 단 위 ', ' 수 량 ', ' 단 가 ', ' 공급가액 '])
  }

  for (const item of quote.items) {
    const amountText = String(item.amount_text || '').trim()
    const line = Math.round(Number(item.quantity) || 0) * Math.round(Number(item.unit_price) || 0)
    const label = item.exclude_from_total
      ? `${item.description} (합계 제외)`
      : item.description
    const row: (string | number)[] = [
      '',
      label,
      '',
      item.unit || '대',
      Number(item.quantity) || 0,
      formatWon(item.unit_price),
      formatWon(line),
    ]
    if (showLeaseCol) row.push(amountText)
    rows.push(row)
  }

  rows.push([])
  if (showLeaseCol) {
    rows.push(['', '', '', '', '', '', ' 소      계 ', formatWon(supply)])
    rows.push(['', '', '', '', '', '', ` 부가세 ${vatRate}% `, formatWon(vat)])
    rows.push(['', '', '', '', '', '', ' 합      계 ', formatWon(total)])
  } else {
    rows.push(['', '', '', '', '', ' 소      계 ', formatWon(supply)])
    rows.push(['', '', '', '', '', ` 부가세 ${vatRate}% `, formatWon(vat)])
    rows.push(['', '', '', '', '', ' 합      계 ', formatWon(total)])
  }
  rows.push([])
  rows.push(['', ' * 비 고'])
  rows.push(['', quote.notes || ''])
  rows.push([])
  rows.push([])
  rows.push(['', ` ${(quote.footer_notice || '').trim() || DEFAULT_FOOTER_NOTICE} `])
  rows.push([
    '',
    `  ■ 홈페이지: ${quote.issuer_homepage || ''}    ■ 블로그: ${quote.issuer_blog || ''}   `,
  ])
  rows.push([])
  rows.push(['', ` ${quote.issuer_company || '크린솔루션'}  `])
  rows.push(['', ` ${quote.issuer_partner || ''}`.trim()])
  rows.push([
    '',
    ` 담당자: ${quote.issuer_manager || ''} | TEL: ${quote.issuer_tel || ''} | HP: ${quote.issuer_hp || ''} `,
  ])

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = showLeaseCol
    ? [
        { wch: 2 },
        { wch: 28 },
        { wch: 4 },
        { wch: 8 },
        { wch: 8 },
        { wch: 12 },
        { wch: 12 },
        { wch: 36 },
      ]
    : [
        { wch: 2 },
        { wch: 42 },
        { wch: 4 },
        { wch: 8 },
        { wch: 10 },
        { wch: 14 },
        { wch: 14 },
      ]
  XLSX.utils.book_append_sheet(wb, ws, '견적서')
  const stamp = (quote.quote_date || '').replace(/-/g, '') || 'export'
  const safeName = (quote.client_name || '견적').replace(/[\\/:*?"<>|]/g, '_')
  XLSX.writeFile(wb, `견적서_${safeName}_${stamp}.xlsx`)
}
