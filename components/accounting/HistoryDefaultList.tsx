'use client'

import React, { ReactNode } from 'react'
import { BillingDashboardRow } from '@/app/actions/accounting'

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
    <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #ddd', overflow: 'hidden', minHeight: '400px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #eee', backgroundColor: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#171717' }}>월 정산 등록 현황</span>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ padding: '5px 8px', border: '1px solid #ddd', borderRadius: 4, fontSize: '0.85rem' }}>
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (
              <option key={y} value={y}>{y}년</option>
            ))}
          </select>
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} style={{ padding: '5px 8px', border: '1px solid #ddd', borderRadius: 4, fontSize: '0.85rem' }}>
            {MONTHS.map((m) => <option key={m} value={m}>{m}월</option>)}
          </select>
        </div>

        <button
          type="button"
          onClick={onBulkDownload}
          disabled={checkedIds.size === 0 || bulkDownloading}
          style={{
            fontSize: '0.8rem', padding: '6px 12px', borderRadius: 4,
            border: '1px solid #0070f3', color: checkedIds.size === 0 ? '#9ca3af' : '#0070f3',
            borderColor: checkedIds.size === 0 ? '#ddd' : '#0070f3',
            background: '#fff', cursor: checkedIds.size === 0 ? 'not-allowed' : 'pointer',
          }}
        >
          {bulkDownloading ? '생성 중...' : `📥 선택한 ${checkedIds.size}건 홈택스 엑셀 일괄 다운로드`}
        </button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead style={{ backgroundColor: '#f5f5f5', borderBottom: '2px solid #ccc', color: '#444' }}>
            <tr>
              <th style={{ padding: '10px', width: '36px', borderRight: '1px solid #ddd' }}>
                <input type="checkbox" checked={allChecked} onChange={onToggleAll} />
              </th>
              <th style={{ padding: '10px', width: '40px', borderRight: '1px solid #ddd' }}>No.</th>
              <th style={{ padding: '10px', textAlign: 'left', borderRight: '1px solid #ddd' }}>거래처</th>
              <th style={{ padding: '10px', textAlign: 'right', borderRight: '1px solid #ddd', width: '110px' }}>청구액</th>
              <th style={{ padding: '10px', width: '90px', borderRight: '1px solid #ddd' }}>명세서 발송</th>
              <th style={{ padding: '10px', width: '90px', borderRight: '1px solid #ddd' }}>세금계산서</th>
              <th style={{ padding: '10px', width: '90px' }}>상세</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: '60px', textAlign: 'center' }}>불러오는 중...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: '60px', textAlign: 'center', color: '#888' }}>이 달에 등록된 월 정산 건이 없습니다.</td></tr>
            ) : (
              rows.map((r, idx) => {
                const isOpen = r.settlement_id === openSettlementId
                return (
                  <React.Fragment key={r.settlement_id}>
                    <tr style={{ borderBottom: '1px solid #eee', backgroundColor: isOpen ? '#f0f7ff' : undefined }}>
                      <td style={{ textAlign: 'center', borderRight: '1px solid #eee' }}>
                        <input type="checkbox" checked={checkedIds.has(r.settlement_id)} onChange={() => onToggleOne(r.settlement_id)} />
                      </td>
                      <td style={{ textAlign: 'center', color: '#888', borderRight: '1px solid #eee' }}>{idx + 1}</td>
                      <td style={{ padding: '10px', borderRight: '1px solid #eee' }}>{r.client_name}</td>
                      <td style={{ textAlign: 'right', padding: '10px', borderRight: '1px solid #eee' }}>{r.total_amount.toLocaleString()}원</td>
                      <td style={{ textAlign: 'center', fontSize: '0.78rem', color: '#666', borderRight: '1px solid #eee' }}>
                        {formatDate(r.sent_at) || '미발송'}
                      </td>
                      <td style={{ textAlign: 'center', borderRight: '1px solid #eee' }}>
                        <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: 10, background: '#f5f5f5', color: INVOICE_BADGE_COLOR[r.tax_invoice_status] }}>
                          {r.tax_invoice_status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => onRowOpen(r)}
                          style={{ fontSize: '0.75rem', padding: '3px 8px', border: `1px solid ${isOpen ? '#0070f3' : 'var(--notion-border, #ddd)'}`, borderRadius: 4, background: isOpen ? '#0070f3' : '#fff', color: isOpen ? '#fff' : '#333', cursor: 'pointer' }}
                        >
                          {isOpen ? '▲ 닫기' : '▼ 열기'}
                        </button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={7} style={{ padding: 0, background: '#fafbfc', borderBottom: '2px solid #0070f3' }}>
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
