'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  getBillingDashboardAction,
  markStatementSentAction,
  type BillingDashboardRow,
} from '@/app/actions/accounting'
import PageHeader from '@/components/ui/PageHeader'
import FilterBar from '@/components/ui/FilterBar'
import Select from '@/components/ui/Select'
import Button from '@/components/ui/Button'
import Table from '@/components/ui/Table'
import Badge, { type BadgeTone } from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { toast } from '@/components/ui/Toast'
import TaxInvoiceExcelModal from './TaxInvoiceExcelModal'
import styles from './BillingDashboard.module.css'

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

function formatDate(iso: string | null) {
  if (!iso) return null
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

const INVOICE_TONE: Record<BillingDashboardRow['tax_invoice_status'], BadgeTone> = {
  '미발행': 'neutral',
  '정상': 'success',
  '취소': 'danger',
  '수정발행됨': 'warning',
}

export default function BillingDashboard() {
  const confirm = useConfirm()
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
    const ok = await confirm({
      title: '거래명세서를 발송하셨나요?',
      description: '발송일로 오늘 날짜가 기록됩니다.',
      confirmLabel: '발송완료 처리',
    })
    if (!ok) return
    setBusyId(settlementId)
    const res = await markStatementSentAction(settlementId)
    setBusyId(null)
    if (!res.success) {
      await confirm({ title: '발송일을 기록하지 못했습니다', description: res.message, alertOnly: true })
      return
    }
    toast('발송일을 기록했습니다.')
    load()
  }

  const visibleRows = onlyUnpaid ? rows.filter((r) => !r.is_paid) : rows
  const totalBilled = rows.reduce((s, r) => s + r.total_amount, 0)
  const totalUnpaid = rows.filter((r) => !r.is_paid).reduce((s, r) => s + r.total_amount, 0)

  return (
    <div>
      <PageHeader
        title="수금 현황"
        description={
          <>
            홈택스에서 발급이 완료돼 세금계산서가 등록된 건만 표시됩니다. 발행 전 건은{' '}
            <Link href="/accounting/history" className={styles.link}>청구 이력</Link>
            {' '}페이지에서 홈택스 업로드용 엑셀을 먼저 받아 발급해 주세요.
          </>
        }
        actions={
          <Button variant="secondary" onClick={() => setExcelModalOpen(true)}>
            세금계산서 엑셀로 가져오기
          </Button>
        }
      />

      <FilterBar
        summary={
          <>
            총 청구액 <span className={styles.amount}>{totalBilled.toLocaleString()}</span><span className={styles.unit}>원</span>
            <span className={styles.sep}>·</span>
            미수금 합계{' '}
            <span className={totalUnpaid > 0 ? `${styles.amount} ${styles.danger}` : styles.amount}>
              {totalUnpaid.toLocaleString()}
            </span>
            <span className={styles.unit}>원</span>
          </>
        }
      >
        <Select label="연도" value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (
            <option key={y} value={y}>{y}년</option>
          ))}
        </Select>
        <Select label="월" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
          {MONTHS.map((m) => <option key={m} value={m}>{m}월</option>)}
        </Select>
        <label className={styles.check}>
          <input type="checkbox" checked={onlyUnpaid} onChange={(e) => setOnlyUnpaid(e.target.checked)} />
          미수금만 보기
        </label>
        <Button variant="primary" onClick={load}>조회</Button>
      </FilterBar>

      {loading ? (
        <EmptyState>불러오는 중…</EmptyState>
      ) : visibleRows.length === 0 ? (
        <EmptyState>표시할 정산 건이 없습니다.</EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              <th className="center">등록일</th>
              <th>거래처</th>
              <th className="num">청구액</th>
              <th className="center">입금</th>
              <th>메모</th>
              <th className="center">명세서 발송</th>
              <th className="center">세금계산서</th>
              <th className="num">작업</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((r) => (
              <tr key={r.settlement_id}>
                <td className={`center ${styles.date}`}>{formatDate(r.created_at) || '-'}</td>
                <td>{r.client_name}</td>
                <td className="num">{r.total_amount.toLocaleString()}<span className="unit">원</span></td>
                <td className="center">
                  <Badge tone={r.is_paid ? 'success' : 'danger'}>{r.is_paid ? '완납' : '미수금'}</Badge>
                </td>
                <td className={styles.memo}>{r.memo || '-'}</td>
                <td className={`center ${styles.date}`}>
                  {r.sent_at ? (
                    formatDate(r.sent_at)
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleMarkSent(r.settlement_id)}
                      disabled={busyId === r.settlement_id}
                    >
                      발송완료 처리
                    </Button>
                  )}
                </td>
                <td className="center">
                  <Badge tone={INVOICE_TONE[r.tax_invoice_status]}>{r.tax_invoice_status}</Badge>
                </td>
                <td className="num">
                  <Link
                    href={`/accounting/history?client_id=${r.client_id}&focus_year=${r.billing_year}&focus_month=${r.billing_month}`}
                    className={styles.link}
                  >
                    상세로 이동
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <TaxInvoiceExcelModal
        isOpen={excelModalOpen}
        onClose={() => setExcelModalOpen(false)}
        onImported={load}
      />
    </div>
  )
}
