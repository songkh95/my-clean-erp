'use client'

import { useEffect, useState } from 'react'
import styles from '@/app/accounting/accounting.module.css'
import {
  getTaxInvoicesForSettlementAction,
  recordTaxInvoiceAction,
  deleteTaxInvoiceRecordAction,
  type TaxInvoiceStatus,
} from '@/app/actions/taxInvoice'
import { getHometaxUploadDataForSettlementAction } from '@/app/actions/accounting'
import { getOrgBusinessInfoAction } from '@/app/actions/auth'
import { downloadHometaxBulkUploadExcel } from '@/utils/hometaxBulkExcel'

interface TaxInvoiceRecord {
  id: string
  status: TaxInvoiceStatus
  original_invoice_id: string | null
  issued_at: string | null
  approval_no: string | null
  amount: number | null
  memo: string | null
  created_at: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
  settlementId: string
  clientName: string
  defaultAmount?: number
  onSaved?: () => void
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export default function TaxInvoiceModal({ isOpen, onClose, settlementId, clientName, defaultAmount, onSaved }: Props) {
  const [records, setRecords] = useState<TaxInvoiceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [downloading, setDownloading] = useState(false)

  const [status, setStatus] = useState<TaxInvoiceStatus>('정상')
  const [originalId, setOriginalId] = useState('')
  const [issuedAt, setIssuedAt] = useState(todayStr())
  const [approvalNo, setApprovalNo] = useState('')
  const [amount, setAmount] = useState<string>(defaultAmount != null ? String(defaultAmount) : '')
  const [memo, setMemo] = useState('')

  const load = async () => {
    setLoading(true)
    const res = await getTaxInvoicesForSettlementAction(settlementId)
    setLoading(false)
    if (res.success) setRecords(res.data as TaxInvoiceRecord[])
  }

  useEffect(() => {
    if (isOpen) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, settlementId])

  if (!isOpen) return null

  const normalRecords = records.filter((r) => r.status === '정상')

  const handleSave = async () => {
    setError('')
    if ((status === '취소' || status === '수정발행됨') && !originalId) {
      setError('취소·수정발행은 원본 세금계산서를 선택해야 합니다.')
      return
    }
    setSaving(true)
    const res = await recordTaxInvoiceAction({
      settlementId,
      status,
      originalInvoiceId: originalId || null,
      issuedAt,
      approvalNo: approvalNo || null,
      amount: amount ? Number(amount) : null,
      memo: memo || null,
    })
    setSaving(false)
    if (!res.success) {
      setError(res.message)
      return
    }
    setApprovalNo('')
    setMemo('')
    setOriginalId('')
    setStatus('정상')
    await load()
    onSaved?.()
  }

  const handleDownloadExcel = async () => {
    setDownloading(true)
    try {
      const orgRes = await getOrgBusinessInfoAction()
      if (!orgRes.success || !orgRes.data) {
        alert(orgRes.message || '사업자 정보를 불러오지 못했습니다.')
        return
      }
      const org = orgRes.data
      if (!org.business_number || !org.representative_name || !org.address) {
        alert('설정 > 계정 탭에서 우리 회사 사업자 정보(사업자번호·대표자명·주소)를 먼저 입력해 주세요.')
        return
      }

      const rowRes = await getHometaxUploadDataForSettlementAction(settlementId)
      if (!rowRes.success || !rowRes.row) {
        alert(rowRes.message || '정산 데이터를 불러오지 못했습니다.')
        return
      }
      const row = rowRes.row
      if (!row.buyerBizNo || !row.buyerName) {
        alert(`${clientName} 거래처에 사업자번호가 없어 엑셀을 생성할 수 없습니다. 거래처 정보에서 사업자번호를 먼저 입력해 주세요.`)
        return
      }

      downloadHometaxBulkUploadExcel(
        {
          name: org.name,
          businessNumber: org.business_number || '',
          representativeName: org.representative_name || '',
          address: org.address || '',
          businessType: org.business_type || '',
          businessItem: org.business_item || '',
          email: org.email || '',
        },
        [row],
        `홈택스_일괄등록_${clientName}_${row.writtenDate}.xlsx`
      )
    } finally {
      setDownloading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('이 기록을 삭제할까요? (실제 국세청 발행이 취소되는 건 아니고, ERP 기록만 지워집니다)')) return
    const res = await deleteTaxInvoiceRecordAction(id)
    if (!res.success) alert(res.message)
    await load()
    onSaved?.()
  }

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent} style={{ maxWidth: 560 }}>
        <h2 className={styles.modalTitle}>세금계산서 발행 기록 — {clientName}</h2>

        <p style={{ fontSize: '0.82rem', color: 'var(--notion-sub-text)', marginBottom: 10 }}>
          발행은 홈택스에서 직접 하시고, 여기서는 발행 결과(승인번호 등)만 기록합니다.
        </p>

        <div style={{ marginBottom: 14 }}>
          <button
            type="button"
            onClick={handleDownloadExcel}
            disabled={downloading}
            style={{ fontSize: '0.78rem', padding: '6px 10px', border: '1px solid #0070f3', color: '#0070f3', borderRadius: 4, background: '#fff', cursor: 'pointer' }}
          >
            {downloading ? '생성 중...' : '📥 홈택스 일괄등록 엑셀 다운로드'}
          </button>
          <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--notion-sub-text)', marginTop: 4 }}>
            이 정산 건 1건만 담은 홈택스 업로드용 엑셀을 받습니다. 홈택스에서 이 파일을 업로드해 발급하세요.
          </span>
        </div>

        {loading ? (
          <p>불러오는 중...</p>
        ) : records.length > 0 ? (
          <table className={styles.modalTable} style={{ marginBottom: 16 }}>
            <thead>
              <tr>
                <th>상태</th>
                <th>발행일</th>
                <th>승인번호</th>
                <th>금액</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td>{r.status}</td>
                  <td style={{ fontSize: '0.78rem' }}>{r.issued_at || '-'}</td>
                  <td style={{ fontSize: '0.72rem' }}>{r.approval_no || '-'}</td>
                  <td>{r.amount != null ? r.amount.toLocaleString() + '원' : '-'}</td>
                  <td>
                    <button
                      type="button"
                      onClick={() => handleDelete(r.id)}
                      style={{ fontSize: '0.72rem', color: '#b91c1c', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{ fontSize: '0.82rem', color: 'var(--notion-sub-text)', marginBottom: 14 }}>
            아직 기록된 발행 내역이 없습니다.
          </p>
        )}

        <div style={{ borderTop: '1px solid var(--notion-border)', paddingTop: 14 }}>
          <h3 style={{ fontSize: '0.88rem', fontWeight: 700, marginBottom: 10 }}>새 기록 추가</h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <label style={{ fontSize: '0.8rem' }}>
              상태
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaxInvoiceStatus)}
                style={{ display: 'block', width: '100%', marginTop: 4, padding: '6px 8px', border: '1px solid var(--notion-border)', borderRadius: 4 }}
              >
                <option value="정상">정상</option>
                <option value="취소">취소</option>
                <option value="수정발행됨">수정발행됨</option>
              </select>
            </label>

            <label style={{ fontSize: '0.8rem' }}>
              발행일
              <input
                type="date"
                value={issuedAt}
                onChange={(e) => setIssuedAt(e.target.value)}
                style={{ display: 'block', width: '100%', marginTop: 4, padding: '6px 8px', border: '1px solid var(--notion-border)', borderRadius: 4, boxSizing: 'border-box' }}
              />
            </label>
          </div>

          {(status === '취소' || status === '수정발행됨') && (
            <label style={{ fontSize: '0.8rem', display: 'block', marginBottom: 10 }}>
              원본 세금계산서
              <select
                value={originalId}
                onChange={(e) => setOriginalId(e.target.value)}
                style={{ display: 'block', width: '100%', marginTop: 4, padding: '6px 8px', border: '1px solid var(--notion-border)', borderRadius: 4 }}
              >
                <option value="">-- 선택 --</option>
                {normalRecords.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.issued_at} · {r.approval_no} · {r.amount?.toLocaleString()}원
                  </option>
                ))}
              </select>
            </label>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <label style={{ fontSize: '0.8rem' }}>
              승인번호
              <input
                value={approvalNo}
                onChange={(e) => setApprovalNo(e.target.value)}
                placeholder="홈택스 승인번호"
                style={{ display: 'block', width: '100%', marginTop: 4, padding: '6px 8px', border: '1px solid var(--notion-border)', borderRadius: 4, boxSizing: 'border-box' }}
              />
            </label>
            <label style={{ fontSize: '0.8rem' }}>
              금액
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={{ display: 'block', width: '100%', marginTop: 4, padding: '6px 8px', border: '1px solid var(--notion-border)', borderRadius: 4, boxSizing: 'border-box' }}
              />
            </label>
          </div>

          <label style={{ fontSize: '0.8rem', display: 'block', marginBottom: 10 }}>
            메모
            <input
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              style={{ display: 'block', width: '100%', marginTop: 4, padding: '6px 8px', border: '1px solid var(--notion-border)', borderRadius: 4, boxSizing: 'border-box' }}
            />
          </label>

          {error && <p style={{ fontSize: '0.8rem', color: '#b91c1c', marginBottom: 10 }}>{error}</p>}
        </div>

        <div className={styles.modalActions}>
          <button type="button" className={styles.btnCancel} onClick={onClose}>닫기</button>
          <button type="button" className={styles.btnConfirm} onClick={handleSave} disabled={saving}>
            {saving ? '저장 중...' : '기록 저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
