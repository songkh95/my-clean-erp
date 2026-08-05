import * as XLSX from 'xlsx'
import { ServiceLog } from '@/app/types'

/** 일지 엑셀 표준 컬럼 (저장/불러오기 공통) */
export const SERVICE_LOG_EXCEL_HEADERS = [
  '방문일자',
  '상태',
  '구분',
  '거래처',
  '기기모델',
  '시리얼번호',
  '증상요청',
  '조치내용',
  '교체배송',
  '담당자',
  '현재재고',
  '재고기록일',
  '메모',
  '일지ID',
] as const

export type ServiceLogExcelRow = {
  방문일자: string
  상태: string
  구분: string
  거래처: string
  기기모델: string
  시리얼번호: string
  증상요청: string
  조치내용: string
  교체배송: string
  담당자: string
  현재재고: string
  재고기록일: string
  메모: string
  일지ID: string
}

function partsToText(log: ServiceLog) {
  if (!log.parts_usage?.length) return ''
  const merged = new Map<string, { name: string; qty: number }>()
  for (const p of log.parts_usage) {
    const name = p.consumable?.model_name || '?'
    const prev = merged.get(name)
    if (prev) prev.qty += Number(p.quantity) || 0
    else merged.set(name, { name, qty: Number(p.quantity) || 0 })
  }
  return Array.from(merged.values())
    .map((p) => `${p.name}(${p.qty})`)
    .join(', ')
}

export function serviceLogToExcelRow(log: ServiceLog): ServiceLogExcelRow {
  return {
    방문일자: log.visit_date || '',
    상태: log.status || '',
    구분: log.service_type || '',
    거래처: log.client?.name || '',
    기기모델: log.inventory?.model_name || '',
    시리얼번호: log.inventory?.serial_number || '',
    증상요청: log.symptom || '',
    조치내용: log.action_detail || '',
    교체배송: partsToText(log),
    담당자: log.manager?.name || '',
    현재재고: log.spare_stock || '',
    재고기록일: log.spare_stock_at || '',
    메모: log.memo || '',
    일지ID: isDummyLike(log.id) ? '' : log.id,
  }
}

function isDummyLike(id: string) {
  return !id || id.startsWith('dummy_')
}

export function filterLogsByPeriod(
  logs: ServiceLog[],
  from: string | null,
  to: string | null,
  includeUnvisited: boolean
) {
  return logs.filter((log) => {
    if (isDummyLike(log.id)) return false
    if (log.status === '미방문' || !log.visit_date) {
      return includeUnvisited
    }
    if (!from || !to) return true
    return log.visit_date >= from && log.visit_date <= to
  })
}

export function exportServiceLogsToExcel(
  logs: ServiceLog[],
  opts?: { from?: string | null; to?: string | null; fileLabel?: string }
) {
  const rows = logs.map(serviceLogToExcelRow)
  if (rows.length === 0) {
    alert('내보낼 일지가 없습니다. 기간을 확인하세요.')
    return
  }

  const header = [...SERVICE_LOG_EXCEL_HEADERS]
  const worksheet = XLSX.utils.json_to_sheet(rows, { header })
  worksheet['!cols'] = header.map((h) => ({
    wch: h === '증상요청' || h === '조치내용' || h === '교체배송' ? 28 : h === '일지ID' ? 36 : 14,
  }))

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '서비스일지')

  const from = opts?.from || ''
  const to = opts?.to || ''
  const range =
    from && to
      ? `${from.replace(/-/g, '')}-${to.replace(/-/g, '')}`
      : opts?.fileLabel || '전체'
  const fileName = `서비스일지_${range}_${new Date().toISOString().slice(0, 10)}.xlsx`
  XLSX.writeFile(workbook, fileName)
}

function cellStr(v: unknown): string {
  if (v == null) return ''
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const y = v.getFullYear()
    const m = String(v.getMonth() + 1).padStart(2, '0')
    const d = String(v.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  const s = String(v).trim()
  // Excel serial date number
  if (/^\d+(\.\d+)?$/.test(s) && Number(s) > 20000 && Number(s) < 80000) {
    const parsed = XLSX.SSF.parse_date_code(Number(s))
    if (parsed) {
      return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`
    }
  }
  // 2026.8.5 / 2026/08/05
  const m = s.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/)
  if (m) {
    return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  }
  return s
}

export function parseServiceLogExcel(buffer: ArrayBuffer): ServiceLogExcelRow[] {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return []
  const sheet = workbook.Sheets[sheetName]
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

  return raw
    .map((row) => {
      const get = (...keys: string[]) => {
        for (const k of keys) {
          if (k in row && row[k] != null && String(row[k]).trim() !== '') return row[k]
        }
        // case-insensitive / spaced keys
        const found = Object.keys(row).find((rk) =>
          keys.some((k) => rk.replace(/\s/g, '') === k.replace(/\s/g, ''))
        )
        return found ? row[found] : ''
      }

      return {
        방문일자: cellStr(get('방문일자', '방문일', 'visit_date')),
        상태: cellStr(get('상태', 'status')),
        구분: cellStr(get('구분', 'service_type')),
        거래처: cellStr(get('거래처', '거래처명', 'client')),
        기기모델: cellStr(get('기기모델', '모델', 'model_name')),
        시리얼번호: cellStr(get('시리얼번호', '시리얼', 'S/N', 'serial_number')),
        증상요청: cellStr(get('증상요청', '증상', 'symptom')),
        조치내용: cellStr(get('조치내용', '조치', 'action_detail')),
        교체배송: cellStr(get('교체배송', '교체/배송', 'parts')),
        담당자: cellStr(get('담당자', 'manager')),
        현재재고: cellStr(get('현재재고', 'spare_stock')),
        재고기록일: cellStr(get('재고기록일', 'spare_stock_at')),
        메모: cellStr(get('메모', 'memo')),
        일지ID: cellStr(get('일지ID', 'id')),
      } satisfies ServiceLogExcelRow
    })
    .filter((r) => r.거래처 || r.방문일자 || r.일지ID)
}

export function filterExcelRowsByPeriod(
  rows: ServiceLogExcelRow[],
  from: string | null,
  to: string | null
) {
  if (!from || !to) return rows
  return rows.filter((r) => {
    if (!r.방문일자) return true
    return r.방문일자 >= from && r.방문일자 <= to
  })
}
