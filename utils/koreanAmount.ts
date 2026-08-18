/** 금액을 한글 읽기 + '원' (견적서 합계 표기용) */

const DIGITS = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구']
const SMALL = ['', '십', '백', '천']
const BIG = ['', '만', '억', '조']

function chunkToKorean(n: number): string {
  if (n === 0) return ''
  let s = ''
  const str = String(n).padStart(4, '0')
  for (let i = 0; i < 4; i++) {
    const d = Number(str[i])
    if (!d) continue
    const unit = SMALL[3 - i]
    // 일십 → 십 (관용)
    if (d === 1 && unit === '십') s += '십'
    else s += DIGITS[d] + unit
  }
  return s
}

/** 예: 110000 → "일십일만 원" */
export function numberToKoreanWon(amount: number): string {
  const n = Math.round(Math.abs(Number(amount) || 0))
  if (n === 0) return '영원'
  const parts: string[] = []
  let rest = n
  let bigIdx = 0
  while (rest > 0 && bigIdx < BIG.length) {
    const chunk = rest % 10000
    if (chunk) {
      const body = chunkToKorean(chunk)
      parts.unshift(body + BIG[bigIdx])
    }
    rest = Math.floor(rest / 10000)
    bigIdx += 1
  }
  return parts.join('') + ' 원'
}

export function formatWon(n: number): string {
  const v = Math.round(Number(n) || 0)
  return `₩${v.toLocaleString('ko-KR')}`
}

export function formatQuoteDateKo(ymd: string): string {
  const m = String(ymd || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return ymd || ''
  return `${m[1]}년 ${m[2]}월 ${m[3]}일`
}

export function todayYmd(): string {
  const d = new Date()
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${day}`
}
