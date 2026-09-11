'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import styles from '@/app/accounting/accounting.module.css'
import {
  getBillingDashboardAction,
  markStatementSentAction,
  type BillingDashboardRow,
} from '@/app/actions/accounting'
import TaxInvoiceExcelModal from './TaxInvoiceExcelModal'

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

function formatDate(iso: string | null) {
  if (!iso) return null
  const d = new Date(iso)
  const yy = String(d.getFullYear()).slice(-2)
  return `${yy}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

const INVOICE_BADGE_COLOR: Record<BillingDashboardRow['tax_invoice_status'], string> = {
  '미발행': '#9ca3af',
  '정상': '#0f7b3a',
  '취소': '#b91c1c',
  '수정발행됨': '#b45309',
}

export default function BillingDashboard() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [rows, setRows] = useState<BillingDashboardRow[]>([])
  const [loading, setLoading] = useState(true)
  const [onlyUnpaid, setOnlyUnpaid] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [excelModalOpen, setExcelModalOpen] = useState(false)

  const load = async () => {
    setLoading(true)
    const res = await getBillingDashboardAction(year, month)
    setLoading(false)
    // 수금 현황은 "홈택스 발급 완료 → ERP 등록"이 끝난 건만 다룬다.
    // 아직 세금계산서가 기록되지 않은 정산 건은 청구 이력 페이지에서 처리한다.
    if (res.success) setRows(res.data.filter((r) => r.tax_invoice_status !== '미발행'))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month])

  const handleMarkSent = async (settlementId: string) => {
    if (!confirm('거래명세서를 발송하셨나요? 발송일로 오늘 날짜가 기록됩니다.')) return
    setBusyId(settlementId)
    const res = await markStatementSentAction(settlementId)
    setBusyId(null)
    if (!res.success) alert(res.message)
    else load()
  }

  const visibleRows = onlyUnpaid ? rows.filter((r) => !r.is_paid) : rows
  const totalBilled = rows.reduce((s, r) => s + r.total_amount, 0)
  const totalUnpaid = rows.filter((r) => !r.is_paid).reduce((s, r) => s + r.total_amount, 0)

  return (
    <div className={styles.container}>
      <div className={styles.header} style={{ cursor: 'default' }}>
        <span>수금 · 발송 · 발행 현황</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            onClick={() => setExcelModalOpen(true)}
            style={{ fontSize: '0.78rem', padding: '5px 10px', border: '1px solid var(--notion-border)', borderRadius: 4, background: '#fff', cursor: 'pointer' }}
          >
            세금계산서 엑셀로 가져오기
          </button>
        </div>
      </div>

      <p style={{ margin: '10px 20px 0', fontSize: '0.8rem', color: 'var(--notion-sub-text)' }}>
        홈택스에서 발급이 완료돼 세금계산서가 등록된 건만 표시됩니다. 발행 전 건은{' '}
        <Link href="/accounting/history" style={{ color: 'var(--notion-blue)' }}>청구 이력</Link> 페이지에서 홈택스 업로드용 엑셀을 먼저 받아 발급해 주세요.
      </p>

      <div className={styles.content}>
        <div className={styles.controls}>
          <div className={styles.controlItem}>
            <label>년도</label>
            <select className={styles.input} value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div className={styles.controlItem}>
            <label>월</label>
            <select className={styles.input} value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {MONTHS.map((m) => <option key={m} value={m}>{m}월</option>)}
            </select>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', color: 'var(--notion-sub-text)' }}>
            <input type="checkbox" checked={onlyUnpaid} onChange={(e) => setOnlyUnpaid(e.target.checked)} />
            미수금만 보기
          </label>
        </div>

        <div style={{ display: 'flex', gap: 16, margin: '4px 0 14px', fontSize: '0.85rem' }}>
          <span>총 청구액: <strong>{totalBilled.toLocaleString()}원</strong></span>
          <span style={{ color: totalUnpaid > 0 ? '#b91c1c' : 'inherit' }}>
            미수금 합계: <strong>{totalUnpaid.toLocaleString()}원</strong>
          </span>
        </div>

        {loading ? (
          <div>불러오는 중...</div>
        ) : (
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>등록일</th>
                  <th className={styles.th}>거래처</th>
                  <th className={styles.th} style={{ textAlign: 'right' }}>청구액</th>
                  <th className={styles.th}>입금</th>
                  <th className={styles.th}>메모</th>
                  <th className={styles.th}>명세서 발송</th>
                  <th className={styles.th}>세금계산서</th>
                  <th className={styles.th}>작업</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.length === 0 ? (
                  <tr><td className={styles.td} colSpan={8}>표시할 정산 건이 없습니다.</td></tr>
                ) : (
                  visibleRows.map((r) => (
                    <tr key={r.settlement_id}>
                      <td className={styles.td} style={{ fontSize: '0.8rem', color: 'var(--notion-sub-text)', whiteSpace: 'nowrap' }}>
                        {formatDate(r.created_at) || '-'}
                      </td>
                      <td className={styles.td}>{r.client_name}</td>
                      <td className={styles.td} style={{ textAlign: 'right' }}>{r.total_amount.toLocaleString()}원</td>
                      <td className={styles.td}>
                        <span className={styles.badge} style={{ background: r.is_paid ? '#e6f4ea' : '#fdecea', color: r.is_paid ? '#0f7b3a' : '#b91c1c' }}>
                          {r.is_paid ? '완납' : '미수금'}
                        </span>
                      </td>
                      <td className={styles.td} style={{ maxWidth: 180, whiteSpace: 'pre-wrap', fontSize: '0.8rem', color: 'var(--notion-sub-text)' }}>
                        {r.memo || '-'}
                      </td>
                      <td className={styles.td}>
                        {r.sent_at ? (
                          formatDate(r.sent_at)
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleMarkSent(r.settlement_id)}
                            disabled={busyId === r.settlement_id}
                            style={{ fontSize: '0.75rem', padding: '3px 8px', border: '1px solid var(--notion-border)', borderRadius: 4, background: '#fff', cursor: 'pointer' }}
                          >
                            발송완료 처리
                          </button>
                        )}
                      </td>
                      <td className={styles.td}>
                        <span className={styles.badge} style={{ background: '#f5f5f5', color: INVOICE_BADGE_COLOR[r.tax_invoice_status] }}>
                          {r.tax_invoice_status}
                        </span>
                      </td>
                      <td className={styles.td}>
                        <Link
                          href={`/accounting/history?client_id=${r.client_id}&focus_year=${r.billing_year}&focus_month=${r.billing_month}`}
                          style={{ fontSize: '0.78rem', color: 'var(--notion-blue)' }}
                        >
                          상세로 이동
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <TaxInvoiceExcelModal
        isOpen={excelModalOpen}
        onClose={() => setExcelModalOpen(false)}
        onImported={load}
      />
    </div>
  )
}
