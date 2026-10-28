/** 계약 기간 표시용 계산 (거래처 목록 등에서 사용) */

/** YYYY-MM-DD → YY.MM.DD */
export function formatYyMmDd(dateStr: string): string {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return '-'
  const yy = String(d.getFullYear()).slice(-2)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yy}.${mm}.${dd}`
}

/**
 * 오늘부터 종료일까지 남은 기간을 가장 큰 단위 하나로 돌려준다 (1년 / 5개월 / 12일).
 * 날짜 수가 아니라 달력 기준으로 세므로 "1년"은 같은 날짜까지를 뜻한다.
 */
export function remainingLabel(endStr: string, today: Date = new Date()): string {
  const base = new Date(today)
  base.setHours(0, 0, 0, 0)
  const end = new Date(endStr)
  end.setHours(0, 0, 0, 0)
  if (Number.isNaN(end.getTime())) return '-'

  const days = Math.round((end.getTime() - base.getTime()) / 86400000)
  if (days < 0) return '만료'
  if (days === 0) return '오늘 만료'

  let months = (end.getFullYear() - base.getFullYear()) * 12 + (end.getMonth() - base.getMonth())
  if (end.getDate() < base.getDate()) months -= 1

  if (months >= 12) return `${Math.floor(months / 12)}년`
  if (months >= 1) return `${months}개월`
  return `${days}일`
}
