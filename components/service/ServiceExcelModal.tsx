'use client'

import { useMemo, useRef, useState } from 'react'
import Button from '@/components/ui/Button'
import { ServiceLog } from '@/app/types'
import { importServiceLogsFromExcelAction } from '@/app/actions/service'
import {
  exportServiceLogsToExcel,
  filterExcelRowsByPeriod,
  filterLogsByPeriod,
  parseServiceLogExcel,
} from '@/utils/serviceLogExcel'
import styles from '@/app/login/auth.module.css'

type Mode = 'export' | 'import'
type PeriodKind = 'all' | 'month' | 'custom'

function formatLocalDate(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function monthRange(year: number, month: number) {
  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const last = new Date(year, month, 0).getDate()
  const to = `${year}-${String(month).padStart(2, '0')}-${String(last).padStart(2, '0')}`
  return { from, to }
}

export default function ServiceExcelModal({
  isOpen,
  onClose,
  logs,
  onImported,
}: {
  isOpen: boolean
  onClose: () => void
  logs: ServiceLog[]
  onImported: () => void
}) {
  const now = useMemo(() => new Date(), [])
  const [mode, setMode] = useState<Mode>('export')
  const [periodKind, setPeriodKind] = useState<PeriodKind>('month')
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [customFrom, setCustomFrom] = useState(formatLocalDate(new Date(now.getFullYear(), now.getMonth(), 1)))
  const [customTo, setCustomTo] = useState(formatLocalDate(now))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  const range = (() => {
    if (periodKind === 'all') return { from: null as string | null, to: null as string | null, label: '전체' }
    if (periodKind === 'month') {
      const r = monthRange(year, month)
      return { ...r, label: `${year}년 ${month}월` }
    }
    return {
      from: customFrom || null,
      to: customTo || null,
      label: `${customFrom || '?'}~${customTo || '?'}`,
    }
  })()

  const exportCount = filterLogsByPeriod(logs, range.from, range.to, false).length

  const handleExport = () => {
    setError('')
    setMessage('')
    const rows = filterLogsByPeriod(logs, range.from, range.to, false)
    exportServiceLogsToExcel(rows, { from: range.from, to: range.to, fileLabel: range.label })
    setMessage(`${rows.length}건을 엑셀로 저장했습니다. (${range.label})`)
  }

  const handleImportFile = async (file: File | null) => {
    if (!file) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const buf = await file.arrayBuffer()
      const parsed = parseServiceLogExcel(buf)
      const filtered = filterExcelRowsByPeriod(parsed, range.from, range.to)
      if (filtered.length === 0) {
        setError('선택한 기간에 해당하는 행이 없습니다.')
        return
      }
      if (!confirm(`${range.label} 기준 ${filtered.length}건을 가져오겠습니까?\n(거래처·시리얼·담당자 이름으로 매칭합니다)`)) {
        return
      }
      const result = await importServiceLogsFromExcelAction(filtered, {
        from: range.from,
        to: range.to,
      })
      if (!result.success) {
        setError(result.message)
        return
      }
      setMessage(
        `${result.message}` +
          (result.errors.length ? `\n\n일부 오류:\n${result.errors.slice(0, 8).join('\n')}` : '')
      )
      onImported()
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기 실패')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.45)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        className={styles.card}
        style={{ maxWidth: 480, margin: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className={styles.brand}>서비스 일지</p>
        <h2 className={styles.title} style={{ fontSize: '1.2rem' }}>엑셀 저장 / 불러오기</h2>
        <p className={styles.subtitle}>기간을 선택한 뒤 저장하거나 엑셀을 불러오세요.</p>

        <div className={styles.modeRow}>
          <button
            type="button"
            className={`${styles.modeBtn} ${mode === 'export' ? styles.modeBtnActive : ''}`}
            onClick={() => { setMode('export'); setError(''); setMessage('') }}
          >
            엑셀로 저장
          </button>
          <button
            type="button"
            className={`${styles.modeBtn} ${mode === 'import' ? styles.modeBtnActive : ''}`}
            onClick={() => { setMode('import'); setError(''); setMessage('') }}
          >
            엑셀 불러오기
          </button>
        </div>

        <div className={styles.form} style={{ marginTop: 12 }}>
          <div className={styles.field}>
            <span className={styles.label}>기간</span>
            <div className={styles.modeRow}>
              <button
                type="button"
                className={`${styles.modeBtn} ${periodKind === 'month' ? styles.modeBtnActive : ''}`}
                onClick={() => setPeriodKind('month')}
              >
                월 선택
              </button>
              <button
                type="button"
                className={`${styles.modeBtn} ${periodKind === 'custom' ? styles.modeBtnActive : ''}`}
                onClick={() => setPeriodKind('custom')}
              >
                기간지정
              </button>
              <button
                type="button"
                className={`${styles.modeBtn} ${periodKind === 'all' ? styles.modeBtnActive : ''}`}
                onClick={() => setPeriodKind('all')}
              >
                전체
              </button>
            </div>
          </div>

          {periodKind === 'month' && (
            <div style={{ display: 'flex', gap: 8 }}>
              <div className={styles.field} style={{ flex: 1 }}>
                <label className={styles.label}>연도</label>
                <input
                  className={styles.input}
                  type="number"
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value) || year)}
                />
              </div>
              <div className={styles.field} style={{ flex: 1 }}>
                <label className={styles.label}>월</label>
                <select
                  className={styles.input}
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>{m}월</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {periodKind === 'custom' && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <div className={styles.field} style={{ flex: 1 }}>
                <label className={styles.label}>시작일</label>
                <input
                  className={styles.input}
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                />
              </div>
              <span className={styles.hint} style={{ paddingBottom: 10 }}>~</span>
              <div className={styles.field} style={{ flex: 1 }}>
                <label className={styles.label}>종료일</label>
                <input
                  className={styles.input}
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                />
              </div>
            </div>
          )}

          {error ? <div className={styles.error}>{error}</div> : null}
          {message ? <div className={styles.success} style={{ whiteSpace: 'pre-wrap' }}>{message}</div> : null}

          {mode === 'export' ? (
            <>
              <p className={styles.hint}>선택 기간의 등록된 일지 <strong>{exportCount}</strong>건을 저장합니다. (미방문 행 제외)</p>
              <button className={styles.submit} type="button" onClick={handleExport} disabled={busy || exportCount === 0}>
                엑셀로 저장
              </button>
            </>
          ) : (
            <>
              <p className={styles.hint}>
                엑셀의 방문일자가 선택 기간에 해당하는 행만 가져옵니다.
                거래처명·시리얼·담당자명으로 매칭하며, 같은 날·같은 기기는 수정됩니다.
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                style={{ fontSize: '0.85rem' }}
                disabled={busy}
                onChange={(e) => handleImportFile(e.target.files?.[0] || null)}
              />
              {busy ? <p className={styles.hint}>불러오는 중…</p> : null}
            </>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <Button variant="outline" size="sm" type="button" onClick={onClose}>닫기</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
