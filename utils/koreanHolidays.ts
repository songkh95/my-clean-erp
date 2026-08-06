/** 한국 공휴일 (양력 고정 + 음력 주요일 2020–2035) */

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function ymd(year: number, month: number, day: number) {
  return `${year}-${pad2(month)}-${pad2(day)}`
}

function parseYmd(s: string): { y: number; m: number; d: number } {
  const [y, m, d] = s.split('-').map(Number)
  return { y, m, d }
}

function addDays(dateStr: string, days: number): string {
  const { y, m, d } = parseYmd(dateStr)
  const dt = new Date(y, m - 1, d + days)
  return ymd(dt.getFullYear(), dt.getMonth() + 1, dt.getDate())
}

function dayOfWeek(dateStr: string): number {
  const { y, m, d } = parseYmd(dateStr)
  return new Date(y, m - 1, d).getDay()
}

/** 음력 설날(1/1) 양력 — 연휴는 전날·당일·다음날 */
const SEOLLAL: Record<number, string> = {
  2020: '2020-01-25',
  2021: '2021-02-12',
  2022: '2022-02-01',
  2023: '2023-01-22',
  2024: '2024-02-10',
  2025: '2025-01-29',
  2026: '2026-02-17',
  2027: '2027-02-06',
  2028: '2028-01-26',
  2029: '2029-02-13',
  2030: '2030-02-03',
  2031: '2031-01-23',
  2032: '2032-02-11',
  2033: '2033-01-31',
  2034: '2034-02-19',
  2035: '2035-02-08',
}

/** 음력 추석(8/15) 양력 — 연휴는 전날·당일·다음날 */
const CHUSEOK: Record<number, string> = {
  2020: '2020-10-01',
  2021: '2021-09-21',
  2022: '2022-09-10',
  2023: '2023-09-29',
  2024: '2024-09-17',
  2025: '2025-10-06',
  2026: '2026-09-25',
  2027: '2027-09-15',
  2028: '2028-10-03',
  2029: '2029-09-22',
  2030: '2030-09-12',
  2031: '2031-10-01',
  2032: '2032-09-19',
  2033: '2033-09-08',
  2034: '2034-09-27',
  2035: '2035-09-16',
}

/** 부처님오신날(음력 4/8) */
const BUDDHA: Record<number, string> = {
  2020: '2020-04-30',
  2021: '2021-05-19',
  2022: '2022-05-08',
  2023: '2023-05-27',
  2024: '2024-05-15',
  2025: '2025-05-05',
  2026: '2026-05-24',
  2027: '2027-05-13',
  2028: '2028-05-02',
  2029: '2029-05-20',
  2030: '2030-05-09',
  2031: '2031-05-28',
  2032: '2032-05-16',
  2033: '2033-05-06',
  2034: '2034-05-25',
  2035: '2035-05-15',
}

const holidayCache = new Map<number, Map<string, string>>()

function setHoliday(map: Map<string, string>, date: string, name: string) {
  const existing = map.get(date)
  if (!existing) map.set(date, name)
  else if (!existing.includes(name)) map.set(date, `${existing}·${name}`)
}

/** 공휴일이 일요일(또는 토·일)이면 다음 평일을 대체공휴일로 */
function addSubstitute(map: Map<string, string>, holidayDate: string, baseName: string) {
  const dow = dayOfWeek(holidayDate)
  if (dow !== 0 && dow !== 6) return

  let cursor = addDays(holidayDate, 1)
  // 주말·이미 공휴일인 날은 건너뜀
  for (let i = 0; i < 7; i++) {
    const d = dayOfWeek(cursor)
    if (d !== 0 && d !== 6 && !map.has(cursor)) {
      setHoliday(map, cursor, `${baseName} 대체휴일`)
      return
    }
    cursor = addDays(cursor, 1)
  }
}

export function getKoreanHolidays(year: number): Map<string, string> {
  const cached = holidayCache.get(year)
  if (cached) return cached

  const map = new Map<string, string>()

  const solar: [number, number, string][] = [
    [1, 1, '신정'],
    [3, 1, '삼일절'],
    [5, 5, '어린이날'],
    [6, 6, '현충일'],
    [8, 15, '광복절'],
    [10, 3, '개천절'],
    [10, 9, '한글날'],
    [12, 25, '성탄절'],
  ]

  for (const [m, d, name] of solar) {
    setHoliday(map, ymd(year, m, d), name)
  }

  const seollal = SEOLLAL[year]
  if (seollal) {
    setHoliday(map, addDays(seollal, -1), '설 연휴')
    setHoliday(map, seollal, '설날')
    setHoliday(map, addDays(seollal, 1), '설 연휴')
  }

  const chuseok = CHUSEOK[year]
  if (chuseok) {
    setHoliday(map, addDays(chuseok, -1), '추석 연휴')
    setHoliday(map, chuseok, '추석')
    setHoliday(map, addDays(chuseok, 1), '추석 연휴')
  }

  const buddha = BUDDHA[year]
  if (buddha) setHoliday(map, buddha, '부처님오신날')

  // 대체공휴일 (주요 법정공휴일)
  const forSub = [
    ymd(year, 3, 1),
    ymd(year, 5, 5),
    ymd(year, 8, 15),
    ymd(year, 10, 3),
    ymd(year, 10, 9),
    ...(seollal ? [addDays(seollal, -1), seollal, addDays(seollal, 1)] : []),
    ...(chuseok ? [addDays(chuseok, -1), chuseok, addDays(chuseok, 1)] : []),
    ...(buddha ? [buddha] : []),
  ]
  // 이름 보존을 위해 원본 스냅샷 후 대체일 추가
  const snapshot = [...map.entries()]
  for (const date of forSub) {
    const name = snapshot.find(([d]) => d === date)?.[1] || '공휴일'
    addSubstitute(map, date, name.split('·')[0])
  }

  holidayCache.set(year, map)
  return map
}

export function getHolidayName(dateYmd: string): string | undefined {
  const year = Number(dateYmd.slice(0, 4))
  if (!Number.isFinite(year)) return undefined
  return getKoreanHolidays(year).get(dateYmd)
}
