import * as XLSX from 'xlsx'
import type { Client, Inventory } from '@/app/types'

/** 한 시트에 거래처 + 기기 (1행 = 회사 + 기계 1대) */
export const COMBINED_EXCEL_HEADERS = [
  '회사명',
  '담당자',
  '직책',
  '담당자연락처',
  '일반연락처',
  '주소',
  '소속본사',
  '사업자번호',
  '대표자명',
  '이메일',
  '기종',
  '기계번호',
  '부서',
  '브랜드',
  '종류',
  '구분',
  '기기상태',
  '계약구분',
  '보증금',
  '기본요금',
  '흑백기본매수',
  '칼라기본매수',
  '흑백추가매수',
  '칼라추가매수',
  '판매금액',
  '계약시작일',
  '계약년수',
  '계약종료일',
  '매입가',
  '청구일',
  '제품상태',
  '비고',
] as const

/** @deprecated 내부/구 양식 호환용 */
export const CLIENT_EXCEL_HEADERS = [
  '회사명',
  '담당자',
  '직책',
  '담당자연락처',
  '일반연락처',
  '주소',
  '소속본사',
  '사업자번호',
  '대표자명',
  '이메일',
  '메모',
  '상태',
] as const

/** @deprecated 내부/구 양식 호환용 */
export const MACHINE_EXCEL_HEADERS = [
  '거래처명',
  '기종',
  '기계번호',
  '부서',
  '브랜드',
  '종류',
  '구분',
  '상태',
  '계약구분',
  '보증금',
  '기본요금',
  '흑백기본매수',
  '칼라기본매수',
  '흑백추가매수',
  '칼라추가매수',
  '판매금액',
  '계약시작일',
  '계약년수',
  '계약종료일',
  '매입가',
  '청구일',
  '제품상태',
  '비고',
] as const

export type CombinedExcelRow = Record<(typeof COMBINED_EXCEL_HEADERS)[number], string>
export type ClientExcelRow = Record<(typeof CLIENT_EXCEL_HEADERS)[number], string>
export type MachineExcelRow = Record<(typeof MACHINE_EXCEL_HEADERS)[number], string>

function cellStr(v: unknown): string {
  if (v == null) return ''
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const y = v.getFullYear()
    const m = String(v.getMonth() + 1).padStart(2, '0')
    const d = String(v.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  const s = String(v).trim()
  if (/^\d+(\.\d+)?$/.test(s) && Number(s) > 20000 && Number(s) < 80000) {
    const parsed = XLSX.SSF.parse_date_code(Number(s))
    if (parsed) {
      return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`
    }
  }
  const m = s.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/)
  if (m) {
    return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  }
  return s
}

function getCell(row: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    if (k in row && row[k] != null && String(row[k]).trim() !== '') return cellStr(row[k])
  }
  const found = Object.keys(row).find((rk) =>
    keys.some((k) => rk.replace(/\s/g, '') === k.replace(/\s/g, ''))
  )
  return found ? cellStr(row[found]) : ''
}

function numStr(v: unknown): string {
  if (v == null || v === '') return ''
  const n = Number(v)
  return Number.isFinite(n) ? String(n) : ''
}

export function calcContractEndDate(startYmd: string, years: number): string | null {
  if (!startYmd || !Number.isFinite(years) || years <= 0) return null
  const m = startYmd.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  if (Number.isNaN(dt.getTime())) return null
  dt.setFullYear(dt.getFullYear() + Math.floor(years))
  const frac = years - Math.floor(years)
  if (frac > 0) {
    dt.setMonth(dt.getMonth() + Math.round(frac * 12))
  }
  dt.setDate(dt.getDate() - 1)
  const y = dt.getFullYear()
  const mo = String(dt.getMonth() + 1).padStart(2, '0')
  const d = String(dt.getDate()).padStart(2, '0')
  return `${y}-${mo}-${d}`
}

export function yearsBetween(startYmd: string | null, endYmd: string | null): string {
  if (!startYmd || !endYmd) return ''
  const a = startYmd.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const b = endYmd.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!a || !b) return ''
  const start = new Date(Number(a[1]), Number(a[2]) - 1, Number(a[3]))
  const endPlus = new Date(Number(b[1]), Number(b[2]) - 1, Number(b[3]) + 1)
  if (Number.isNaN(start.getTime()) || Number.isNaN(endPlus.getTime())) return ''
  const years =
    endPlus.getFullYear() -
    start.getFullYear() +
    (endPlus.getMonth() - start.getMonth()) / 12 +
    (endPlus.getDate() - start.getDate()) / 365
  const rounded = Math.round(years * 10) / 10
  return Number.isFinite(rounded) && rounded > 0 ? String(rounded) : ''
}

function emptyCombined(): CombinedExcelRow {
  return Object.fromEntries(COMBINED_EXCEL_HEADERS.map((h) => [h, ''])) as CombinedExcelRow
}

function toCombinedRow(
  client: Client | null,
  parentNameById: Map<string, string>,
  inv: (Inventory & { client?: { name?: string | null } | null }) | null
): CombinedExcelRow {
  const row = emptyCombined()
  if (client) {
    row.회사명 = client.name || ''
    row.담당자 = client.contact_person || ''
    row.직책 = (client as any).job_title || ''
    row.담당자연락처 = client.phone || ''
    row.일반연락처 = client.office_phone || ''
    row.주소 = client.address || ''
    row.소속본사 = client.parent_id ? parentNameById.get(client.parent_id) || '' : ''
    row.사업자번호 = client.business_number || ''
    row.대표자명 = client.representative_name || ''
    row.이메일 = client.email || ''
  } else if (inv?.client?.name) {
    row.회사명 = inv.client.name
  }

  if (inv) {
    const yearsStored = numStr((inv as any).contract_years)
    const years =
      yearsStored ||
      yearsBetween(inv.contract_start_date || null, inv.contract_end_date || null)
    row.기종 = inv.model_name || ''
    row.기계번호 = inv.serial_number || ''
    row.부서 = (inv as any).department || ''
    row.브랜드 = inv.brand || ''
    row.종류 = inv.type || ''
    row.구분 = inv.category || ''
    row.기기상태 = inv.status || '창고'
    row.계약구분 = (inv as any).contract_type || ''
    row.보증금 = numStr((inv as any).deposit)
    row.기본요금 = numStr(inv.plan_basic_fee)
    row.흑백기본매수 = numStr(inv.plan_basic_cnt_bw)
    row.칼라기본매수 = numStr(inv.plan_basic_cnt_col)
    row.흑백추가매수 = numStr(inv.plan_price_bw)
    row.칼라추가매수 = numStr(inv.plan_price_col)
    row.판매금액 = numStr((inv as any).sale_price)
    row.계약시작일 = inv.contract_start_date || ''
    row.계약년수 = years
    row.계약종료일 = inv.contract_end_date || ''
    row.매입가 = numStr(inv.purchase_price)
    row.청구일 = inv.billing_date || ''
    row.제품상태 = inv.product_condition || '새제품'
    row.비고 = inv.memo || ''
  }
  return row
}

function writeCombinedWorkbook(rows: CombinedExcelRow[], fileName: string) {
  const wb = XLSX.utils.book_new()
  const sheet = XLSX.utils.json_to_sheet(rows, { header: [...COMBINED_EXCEL_HEADERS] })
  sheet['!cols'] = COMBINED_EXCEL_HEADERS.map((h) => ({
    wch:
      h === '주소' || h === '비고' || h === '회사명' || h === '기종'
        ? 18
        : h === '기계번호' || h === '이메일'
          ? 16
          : 12,
  }))
  XLSX.utils.book_append_sheet(wb, sheet, '거래처기기')
  XLSX.writeFile(wb, fileName)
}

/** 저장: 기계마다 1행 (거래처 정보 포함). 기계 없는 거래처도 1행 */
export function exportClientsAndMachinesToExcel(
  clients: Client[],
  machines: Array<Inventory & { client?: { name?: string | null } | null }>
) {
  const nameById = new Map(clients.map((c) => [c.id, c.name]))
  const clientById = new Map(clients.map((c) => [c.id, c]))
  const usedClientIds = new Set<string>()
  const rows: CombinedExcelRow[] = []

  for (const inv of machines) {
    const client = inv.client_id ? clientById.get(inv.client_id) || null : null
    if (inv.client_id) usedClientIds.add(inv.client_id)
    rows.push(toCombinedRow(client, nameById, inv))
  }

  for (const c of clients) {
    if (usedClientIds.has(c.id)) continue
    rows.push(toCombinedRow(c, nameById, null))
  }

  if (rows.length === 0) {
    rows.push(emptyCombined())
  }

  const stamp = new Date().toISOString().slice(0, 10)
  writeCombinedWorkbook(rows, `거래처_기기_${stamp}.xlsx`)
}

/** 양식: 한 시트, 샘플 2행(같은 회사 + 기계 2대 예시) */
export function downloadClientsMachinesTemplate() {
  const base = emptyCombined()
  base.회사명 = '샘플거래처'
  base.담당자 = '김담당'
  base.직책 = '과장'
  base.담당자연락처 = '010-1234-5678'
  base.일반연락처 = '02-123-4567'
  base.주소 = '서울특별시 강남구'
  base.사업자번호 = '123-45-67890'
  base.대표자명 = '홍길동'
  base.이메일 = 'sample@example.com'
  base.기종 = 'Apeos C3070'
  base.기계번호 = 'SAMPLE-SN-001'
  base.부서 = '총무팀'
  base.브랜드 = 'FUJI'
  base.종류 = 'A3 레이저복합기'
  base.구분 = '컬러'
  base.기기상태 = '설치'
  base.계약구분 = '임대'
  base.보증금 = '0'
  base.기본요금 = '30000'
  base.흑백기본매수 = '1000'
  base.칼라기본매수 = '100'
  base.흑백추가매수 = '10'
  base.칼라추가매수 = '100'
  base.계약시작일 = '2026-01-01'
  base.계약년수 = '3'
  base.계약종료일 = '2028-12-31'
  base.청구일 = '말일'
  base.제품상태 = '새제품'
  base.비고 = '샘플 — 같은 회사명으로 여러 행을 쓰면 기계만 추가됩니다'

  const second: CombinedExcelRow = {
    ...emptyCombined(),
    회사명: '샘플거래처',
    기종: 'Apeos C5570',
    기계번호: 'SAMPLE-SN-002',
    부서: '영업팀',
    브랜드: 'FUJI',
    종류: 'A3 레이저복합기',
    구분: '컬러',
    기기상태: '설치',
    계약구분: '임대',
    기본요금: '40000',
    흑백기본매수: '1500',
    칼라기본매수: '150',
    흑백추가매수: '10',
    칼라추가매수: '100',
    계약시작일: '2026-01-01',
    계약년수: '3',
    비고: '같은 회사 두 번째 기계 예시',
  }

  writeCombinedWorkbook([base, second], '거래처_기기_일괄등록_양식.xlsx')
}

function parseSheetRows(sheet: XLSX.WorkSheet): Record<string, unknown>[] {
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
}

function parseClientFromRow(row: Record<string, unknown>): ClientExcelRow | null {
  const name = getCell(row, '회사명', '거래처명', '거래처', 'name')
  if (!name || name.startsWith('샘플')) return null
  return {
    회사명: name,
    담당자: getCell(row, '담당자'),
    직책: getCell(row, '직책', '직위'),
    담당자연락처: getCell(row, '담당자연락처', '연락처', '휴대폰', '전화'),
    일반연락처: getCell(row, '일반연락처', '사무실전화', '회사전화', '일반전화'),
    주소: getCell(row, '주소', 'address'),
    소속본사: getCell(row, '소속본사', '본사', 'parent'),
    사업자번호: getCell(row, '사업자번호', '사업자등록번호'),
    대표자명: getCell(row, '대표자명', '대표'),
    이메일: getCell(row, '이메일', 'email'),
    메모: getCell(row, '메모'),
    상태: getCell(row, '거래처상태', '상태') || 'active',
  }
}

function parseMachineFromRow(row: Record<string, unknown>): MachineExcelRow | null {
  const model = getCell(row, '기종', '모델명', '제품명', 'model_name')
  const serial = getCell(row, '기계번호', '시리얼번호', '시리얼', 'S/N', 'SN', 'serial_number')
  if ((!model && !serial) || String(serial).startsWith('SAMPLE')) return null

  const start = getCell(row, '계약시작일', '계약일시작', '계약시작')
  const years = getCell(row, '계약년수', '년수')
  let end = getCell(row, '계약종료일', '계약일종료', '계약종료')
  const yearsNum = parseNumberCell(years)
  if (!end && start && yearsNum != null) {
    end = calcContractEndDate(start, yearsNum) || ''
  }

  const company = getCell(row, '회사명', '거래처명', '거래처', '설치처')
  return {
    거래처명: company,
    기종: model,
    기계번호: serial,
    부서: getCell(row, '부서', '설치부서', '위치', '호출명', 'department'),
    브랜드: getCell(row, '브랜드', 'brand'),
    종류: getCell(row, '종류', 'type') || 'A3 레이저복합기',
    구분: getCell(row, '구분', '분류', 'category') || '컬러',
    상태: getCell(row, '기기상태', '상태', 'status') || (company ? '설치' : '창고'),
    계약구분: getCell(row, '계약구분', '계약유형'),
    보증금: getCell(row, '보증금'),
    기본요금: getCell(row, '기본요금', '월기본료', '기본료'),
    흑백기본매수: getCell(row, '흑백기본매수', '흑백무료매수'),
    칼라기본매수: getCell(row, '칼라기본매수', '컬러기본매수', '칼라무료매수', '컬러무료매수'),
    흑백추가매수: getCell(row, '흑백추가매수', '흑백초과단가'),
    칼라추가매수: getCell(row, '칼라추가매수', '컬러추가매수', '칼라초과단가', '컬러초과단가'),
    판매금액: getCell(row, '판매금액', '판매가'),
    계약시작일: start,
    계약년수: years,
    계약종료일: end,
    매입가: getCell(row, '매입가', '구입가'),
    청구일: getCell(row, '청구일', 'billing_date'),
    제품상태: getCell(row, '제품상태') || '새제품',
    비고: getCell(row, '비고', '메모'),
  }
}

/** 통합 시트 우선, 구 양식(거래처/기기 2시트)도 지원 */
export function parseClientsMachinesExcel(buffer: ArrayBuffer): {
  clients: ClientExcelRow[]
  machines: MachineExcelRow[]
} {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })

  const findSheet = (...names: string[]) => {
    const found = workbook.SheetNames.find((n) =>
      names.some((want) => n.replace(/\s/g, '') === want.replace(/\s/g, ''))
    )
    return found ? workbook.Sheets[found] : null
  }

  const combinedSheet = findSheet('거래처기기', '일괄등록', '통합', '등록')
  const clientSheet = findSheet('거래처', 'clients', '고객')
  const machineSheet = findSheet('기기', '자산', 'inventory', 'machines', '기계')

  // 1) 통합 시트 (또는 시트가 1개만 있고 기종/기계번호 헤더가 있는 경우)
  const primary =
    combinedSheet ||
    (!clientSheet && !machineSheet && workbook.SheetNames[0]
      ? workbook.Sheets[workbook.SheetNames[0]]
      : null)

  if (primary) {
    const raw = parseSheetRows(primary)
    const clientMap = new Map<string, ClientExcelRow>()
    const machines: MachineExcelRow[] = []

    for (const row of raw) {
      const client = parseClientFromRow(row)
      if (client) {
        const key = client.회사명.toLowerCase()
        const prev = clientMap.get(key)
        // 같은 회사 여러 행: 비어 있지 않은 연락처 등으로 보강
        if (!prev) {
          clientMap.set(key, client)
        } else {
          clientMap.set(key, {
            ...prev,
            담당자: prev.담당자 || client.담당자,
            직책: prev.직책 || client.직책,
            담당자연락처: prev.담당자연락처 || client.담당자연락처,
            일반연락처: prev.일반연락처 || client.일반연락처,
            주소: prev.주소 || client.주소,
            소속본사: prev.소속본사 || client.소속본사,
            사업자번호: prev.사업자번호 || client.사업자번호,
            대표자명: prev.대표자명 || client.대표자명,
            이메일: prev.이메일 || client.이메일,
            메모: prev.메모 || client.메모,
          })
        }
      }
      const machine = parseMachineFromRow(row)
      if (machine) machines.push(machine)
    }

    return { clients: Array.from(clientMap.values()), machines }
  }

  // 2) 구 양식: 거래처 / 기기 시트 분리
  const clients: ClientExcelRow[] = clientSheet
    ? parseSheetRows(clientSheet)
        .map(parseClientFromRow)
        .filter((r): r is ClientExcelRow => !!r)
    : []

  const machines: MachineExcelRow[] = machineSheet
    ? parseSheetRows(machineSheet)
        .map(parseMachineFromRow)
        .filter((r): r is MachineExcelRow => !!r)
    : []

  return { clients, machines }
}

export function parseNumberCell(v: string): number | null {
  if (!v || !String(v).trim()) return null
  const n = Number(String(v).replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}
