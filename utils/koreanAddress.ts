/** 지오코딩 성공률을 높이기 위해 한국 주소 변형을 만든다. */

const SEOUL_GU = [
  '강남구', '강동구', '강북구', '강서구', '관악구', '광진구', '구로구', '금천구',
  '노원구', '도봉구', '동대문구', '동작구', '마포구', '서대문구', '서초구', '성동구',
  '성북구', '송파구', '양천구', '영등포구', '용산구', '은평구', '종로구', '중구', '중랑구',
]

function withCity(s: string) {
  if (/서울|부산|인천|대구|대전|광주|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주|특별시|광역시/.test(s)) {
    return s
  }
  if (SEOUL_GU.some((gu) => s.includes(gu))) return `서울 ${s}`
  return s
}

function addQuery(out: string[], q: string) {
  const t = q.replace(/\s+/g, ' ').trim()
  if (t.length >= 4 && !out.includes(t)) out.push(t)
  const city = withCity(t)
  if (city.length >= 4 && !out.includes(city)) out.push(city)
}

function insertAddressSpaces(s: string) {
  return s
    .replace(/(길)(\d)/g, '$1 $2')
    .replace(/(로)(\d+)(?!(가|나|다|라|마|바|사|아|자|차|카|타|파|하)?길|번길)/g, '$1 $2')
    // 디지털2로 / 17가길처럼 도로명 안 숫자는 붙인 채 유지
    .replace(/([가-힣])(\d+)(?!로|길|가길|번길)/g, '$1 $2')
    // 2로·17가길 등은 유지, 15층·101호 등은 숫자와 분리
    .replace(/(\d)([가-힣])/g, (m, d: string, h: string, offset: number, str: string) => {
      if (h === '로' || h === '길') return m
      if (h === '가' && str.slice(offset + 2, offset + 3) === '길') return m
      return `${d} ${h}`
    })
    .replace(/([A-Za-z])(\d)/g, '$1 $2')
    .replace(/(\d)([A-Za-z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
}

function stripDetails(s: string) {
  return s
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s*지하\s*\d+\s*층\b.*$/i, '')
    .replace(/\s*\d+\s*층\b.*$/i, '')
    .replace(/\s*지하\s*\d*\s*층?\b.*$/i, '')
    .replace(/\s*\d+\s*호\b.*$/i, '')
    .replace(/\s*(관리사무소|관리실|관리단|주차관리|주차장|경비실|옥상).*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function koreanAddressQueries(raw: string): string[] {
  const src = String(raw || '').replace(/\s+/g, ' ').trim()
  const queries: string[] = []
  if (!src) return queries

  addQuery(queries, src)

  const spaced = insertAddressSpaces(src)
  addQuery(queries, spaced)

  const noParen = spaced.replace(/\([^)]*\)/g, ' ')
  addQuery(queries, noParen)

  const noDetail = stripDetails(noParen)
  addQuery(queries, noDetail)

  const road = noDetail.match(/^(.+?[로길]\s*\d+(-\d+)?)/)
  if (road) addQuery(queries, road[1])

  const dong = noDetail.match(/^(.+?[동가]\s*\d+(-\d+)?)/)
  if (dong) addQuery(queries, dong[1])

  const afterRoad = noDetail.replace(/^.*?[로길]\s*\d+(-\d+)?\s*/, '').trim()
  const building = afterRoad.split(' ')[0] || ''
  if (building.length >= 3 && /[가-힣]/.test(building)) addQuery(queries, building)

  return queries.slice(0, 8)
}

/** Nominatim용: 도로명+건물번호처럼 짧은 형태를 우선 */
export function bestStreetQuery(raw: string): string {
  const queries = koreanAddressQueries(raw)
  const road = queries.find((q) => /[로길]\s*\d+(-\d+)?$/.test(q) && q.startsWith('서울'))
    || queries.find((q) => /[로길]\s*\d+(-\d+)?$/.test(q))
  if (road) return road
  const dong = queries.find((q) => /[동가]\s*\d+(-\d+)?$/.test(q))
  if (dong) return dong
  const cleaned = queries.find((q) => !/(층|호|지하|관리사무소|관리실)/.test(q))
  return cleaned || queries[1] || queries[0] || String(raw || '').trim()
}
