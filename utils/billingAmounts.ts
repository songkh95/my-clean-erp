/** 청구 금액 공통 규칙: 공급가 → VAT → 10원 절사 합계 */

export function calcVat(supply: number): number {
  return Math.floor(Math.max(0, supply) * 0.1)
}

/** 세금계산서/청구 확정액 (공급가 + VAT, 10원 단위 절사) */
export function calcGrandTotal(supply: number): number {
  const s = Math.max(0, supply)
  return Math.floor((s + calcVat(s)) / 10) * 10
}

export function formatBillingBreakdown(supply: number) {
  const vat = calcVat(supply)
  const total = calcGrandTotal(supply)
  return { supply, vat, total }
}

/** 로컬 캘린더 기준 월 구간 (타임존 밀림 방지) */
export function getMonthDateRange(year: number, month: number) {
  const pad = (n: number) => String(n).padStart(2, '0')
  const lastDay = new Date(year, month, 0).getDate()
  return {
    start: `${year}-${pad(month)}-01T00:00:00`,
    end: `${year}-${pad(month)}-${pad(lastDay)}T23:59:59`,
  }
}

export function nextYearMonth(year: number, month: number) {
  if (month === 12) return { year: year + 1, month: 1 }
  return { year, month: month + 1 }
}

export function prevYearMonth(year: number, month: number) {
  if (month === 1) return { year: year - 1, month: 12 }
  return { year, month: month - 1 }
}
