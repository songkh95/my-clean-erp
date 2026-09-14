'use client'

import { useRef, useState } from 'react'
import styles from '@/app/accounting/accounting.module.css'
import { parseHometaxTaxInvoiceExcel, type HometaxTaxInvoiceRow } from '@/utils/taxInvoiceExcel'
import {
  importTaxInvoicesFromExcelAction,
  type TaxInvoiceImportResult,
} from '@/app/actions/taxInvoice'

interface Props {
  isOpen: boolean
  onClose: () => void
  onImported: () => void
}

const STATUS_LABEL: Record<TaxInvoiceImportResult['status'], string> = {
  imported: '✅ 기록됨',
  already_recorded: '이미 기록됨 (건너뜀)',
  no_client_match: '❌ 거래처 매칭 실패',
  no_settlement_match: '❌ 정산 건 매칭 실패',
  ambiguous: '⚠️ 정산 건 여러 개 (수동 확인 필요)',
  amount_mismatch: '⚠️ 금액 불일치 (수동 확인 필요)',
}

export default function TaxInvoiceExcelModal({ isOpen, onClose, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<HometaxTaxInvoiceRow[]>([])
  const [fileName, setFileName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [results, setResults] = useState<TaxInvoiceImportResult[] | null>(null)

  if (!isOpen) return null

  const reset = () => {
    setRows([])
    setFileName('')
    setError('')
    setResults(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleFile = async (file: File | null) => {
    if (!file) return
    setError('')
    setResults(null)
    setFileName(file.name)
    try {
      const buf = await file.arrayBuffer()
      const parsed = parseHometaxTaxInvoiceExcel(buf)
      if (!parsed.ok) {
        setError(parsed.message)
        setRows([])
        return
      }
      if (parsed.rows.length === 0) {
        setError('파일에서 세금계산서 행을 찾지 못했습니다.')
        setRows([])
        return
      }
      setRows(parsed.rows)
    } catch (e: any) {
      setError('파일을 읽지 못했습니다: ' + e.message)
    }
  }

  const handleImport = async () => {
    if (rows.length === 0) return
    setBusy(true)
    setError('')
    try {
      const res = await importTaxInvoicesFromExcelAction(rows)
      if (!res.success) {
        setError(res.message)
      } else {
        setResults(res.results)
        onImported()
      }
    } finally {
      setBusy(false)
    }
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent} style={{ maxWidth: 640 }}>
        <h2 className={styles.modalTitle}>세금계산서 발행 기록 가져오기</h2>

        <p style={{ fontSize: '0.85rem', color: 'var(--notion-sub-text)', marginBottom: 14 }}>
          홈택스 <strong>전자세금계산서 발급 &gt; 목록조회 &gt; 엑셀 다운로드</strong>로 받은 파일을 그대로 올리면,
          거래처명 + 작성월로 정산 건을 찾아 승인번호·발행일·금액을 자동으로 기록합니다.
          발행 자체는 여전히 홈택스에서 직접 하셔야 합니다 — 이건 결과만 옮겨 적는 도구입니다.
        </p>

        <input
          ref={fileRef}
          type="file"
          accept=".xls,.xlsx"
          onChange={(e) => handleFile(e.target.files?.[0] || null)}
          style={{ marginBottom: 12 }}
        />

        {fileName && !error && (
          <p style={{ fontSize: '0.82rem', marginBottom: 8 }}>
            📄 {fileName} — {rows.length}건 인식됨
          </p>
        )}

        {error && (
          <p style={{ fontSize: '0.82rem', color: '#b91c1c', marginBottom: 8 }}>{error}</p>
        )}

        {results && (
          <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid var(--notion-border)', borderRadius: 6, marginBottom: 12 }}>
            <table className={styles.modalTable} style={{ marginBottom: 0 }}>
              <thead>
                <tr>
                  <th>거래처</th>
                  <th>승인번호</th>
                  <th>금액</th>
                  <th>결과</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.approvalNo}>
                    <td>{r.buyerName}</td>
                    <td style={{ fontSize: '0.72rem' }}>{r.approvalNo}</td>
                    <td>{r.totalAmount.toLocaleString()}원</td>
                    <td style={{ fontSize: '0.75rem' }} title={r.detail}>{STATUS_LABEL[r.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className={styles.modalActions}>
          <button type="button" className={styles.btnCancel} onClick={handleClose}>닫기</button>
          {!results && (
            <button
              type="button"
              className={styles.btnConfirm}
              onClick={handleImport}
              disabled={busy || rows.length === 0}
            >
              {busy ? '가져오는 중...' : `${rows.length}건 가져오기`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
