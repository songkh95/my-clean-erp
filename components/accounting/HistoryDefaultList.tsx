'use client'

import Button from '@/components/ui/Button'
import React, { ReactNode } from 'react'
import { BillingDashboardRow } from '@/app/actions/accounting'
import styles from '@/app/accounting/accounting.module.css'

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

const INVOICE_BADGE_COLOR: Record<BillingDashboardRow['tax_invoice_status'], string> = {
  '미발행': '#9ca3af',
  '정상': '#0f7b3a',
  '취소': '#b91c1c',
  '수정발행됨': '#b45309',
}

function formatDate(iso: string | null) {
  if (!iso) return null
  const d = new Date(iso)
  const yy = String(d.getFullYear()).slice(-2)
  return `${yy}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

interface Props {
  year: number
  month: number
  setYear: (y: number) => void
  setMonth: (m: number) => void
  rows: BillingDashboardRow[]
  loading: boolean
  checkedIds: Set<string>
  onToggleOne: (settlementId: string) => void
  onToggleAll: () => void
  onRowOpen: (row: BillingDashboardRow) => void
  bulkDownloading: boolean
  onBulkDownload: () => void
  /** 아코디언으로 펼칠 행의 settlement_id (없으면 아무 것도 펼치지 않음) */
  openSettlementId: string | null
  /** 펼쳐진 행 바로 밑에 그릴 상세 내용 (부모가 상태를 들고 있는 렌더 프롭 — 별도 컴포넌트로 안 뺌) */
  renderDetail: (row: BillingDashboardRow) => ReactNode
}

export default function HistoryDefaultList({
  year, month, setYear, setMonth, rows, loading,
  checkedIds, onToggleOne, onToggleAll, onRowOpen,
  bulkDownloading, onBulkDownload,
  openSettlementId, renderDetail,
}: Props) {
  const allChecked = rows.length > 0 && rows.every((r) => checkedIds.has(r.settlement_id))

  return (
    <div className={styles.section}>
      <div className={styles.header} style={{ cursor: 'default', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className={styles.cardTitle}>월 정산 등록 현황</span>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className={styles.input}>
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (
              <option key={y} value={y}>{y}년</option>
            ))}
          </select>
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className={styles.input}>
            {MONTHS.map((m) => <option key={m} value={m}>{m}월</option>)}
          </select>
        </div>

        <Button variant="secondary"
          type="button"
          onClick={onBulkDownload}
          disabled={checkedIds.size === 0 || bulkDownloading}>{bulkDownloading ? '생성 중...' : `선택한 ${checkedIds.size}건 홈택스 엑셀 일괄 다운로드`}</Button>
      </div>

      <div className={styles.tableContainer} style={{ overflowX: 'auto' }}>
        <table className={styles.table} style={{ tableLayout: 'auto' }}>
          <thead>
            <tr>
              <th className={styles.th} style={{ width: '36px' }}>
                <input type="checkbox" checked={allChecked} onChange={onToggleAll} />
              </th>
              <th className={styles.th} style={{ width: '40px' }}>No.</th>
              <th className={styles.th} style={{ textAlign: 'left' }}>거래처</th>
              <th className={styles.th} style={{ textAlign: 'right', width: '110px' }}>청구액</th>
              <th className={styles.th} style={{ width: '90px' }}>명세서 발송</th>
              <th className={styles.th} style={{ width: '90px' }}>세금계산서</th>
              <th className={styles.th} style={{ width: '90px' }}>상세</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className={styles.td} style={{ padding: '60px' }}>불러오는 중...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className={styles.td} style={{ padding: '60px', color: 'var(--notion-sub-text)' }}>이 달에 등록된 월 정산 건이 없습니다.</td></tr>
            ) : (
              rows.map((r, idx) => {
                const isOpen = r.settlement_id === openSettlementId
                return (
                  <React.Fragment key={r.settlement_id}>
                    <tr style={{ backgroundColor: isOpen ? 'var(--notion-blue-light)' : undefined }}>
                      <td className={styles.td}>
                        <input type="checkbox" checked={checkedIds.has(r.settlement_id)} onChange={() => onToggleOne(r.settlement_id)} />
                      </td>
                      <td className={styles.td} style={{ color: 'var(--notion-sub-text)' }}>{idx + 1}</td>
                      <td className={styles.td} style={{ textAlign: 'left', padding: '8px 10px' }}>{r.client_name}</td>
                      <td className={styles.td} style={{ textAlign: 'right', padding: '8px 10px' }}>{r.total_amount.toLocaleString()}원</td>
                      <td className={styles.td} style={{ fontSize: '0.78rem', color: 'var(--notion-sub-text)' }}>
                        {formatDate(r.sent_at) || '미발송'}
                      </td>
                      <td className={styles.td}>
                        <span className={styles.badge} style={{ backgroundColor: 'var(--notion-soft-bg)', color: INVOICE_BADGE_COLOR[r.tax_invoice_status] }}>
                          {r.tax_invoice_status}
                        </span>
                      </td>
                      <td className={styles.td}>
                        <Button variant="secondary" size="sm"
                          type="button"
                          onClick={() => onRowOpen(r)}>{isOpen ? '닫기' : '열기'}</Button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={7} style={{ padding: 0, background: 'var(--notion-soft-bg)', borderBottom: '2px solid var(--notion-blue)' }}>
                          {renderDetail(r)}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
