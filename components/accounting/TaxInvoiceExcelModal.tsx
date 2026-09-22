'use client'

import { useRef, useState } from 'react'
import { parseHometaxTaxInvoiceExcel, type HometaxTaxInvoiceRow } from '@/utils/taxInvoiceExcel'
import {
  importTaxInvoicesFromExcelAction,
  type TaxInvoiceImportResult,
} from '@/app/actions/taxInvoice'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Table from '@/components/ui/Table'
import Badge, { type BadgeTone } from '@/components/ui/Badge'
import styles from './BillingDashboard.module.css'

interface Props {
  isOpen: boolean
  onClose: () => void
  onImported: () => void
}

const STATUS: Record<TaxInvoiceImportResult['status'], { label: string; tone: BadgeTone }> = {
  imported: { label: '기록됨', tone: 'success' },
  already_recorded: { label: '이미 기록됨 (건너뜀)', tone: 'neutral' },
  no_client_match: { label: '거래처 매칭 실패', tone: 'danger' },
  no_settlement_match: { label: '정산 건 매칭 실패', tone: 'danger' },
  ambiguous: { label: '정산 건 여러 개 (수동 확인 필요)', tone: 'warning' },
  amount_mismatch: { label: '금액 불일치 (수동 확인 필요)', tone: 'warning' },
}

export default function TaxInvoiceExcelModal({ isOpen, onClose, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<HometaxTaxInvoiceRow[]>([])
  const [fileName, setFileName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [results, setResults] = useState<TaxInvoiceImportResult[] | null>(null)

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
    } catch (e) {
      setError('파일을 읽지 못했습니다: ' + (e instanceof Error ? e.message : String(e)))
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
    if (busy) return
    reset()
    onClose()
  }

  return (
    <Modal
      open={isOpen}
      onClose={handleClose}
      title="세금계산서 발행 기록 가져오기"
      dismissible={!busy}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={busy}>닫기</Button>
          {!results && (
            <Button variant="primary" onClick={handleImport} disabled={busy || rows.length === 0}>
              {busy ? '가져오는 중…' : `${rows.length}건 가져오기`}
            </Button>
          )}
        </>
      }
    >
      <p className={styles.guide}>
        홈택스 <strong>전자세금계산서 발급 &gt; 목록조회 &gt; 엑셀 다운로드</strong>로 받은 파일을 그대로 올리면,
        거래처명 + 작성월로 정산 건을 찾아 승인번호·발행일·금액을 자동으로 기록합니다.
        발행 자체는 여전히 홈택스에서 직접 하셔야 합니다 — 이건 결과만 옮겨 적는 도구입니다.
      </p>

      <div className={styles.fileRow}>
        <input
          ref={fileRef}
          type="file"
          accept=".xls,.xlsx"
          className={styles.fileInput}
          onChange={(e) => handleFile(e.target.files?.[0] || null)}
        />
        <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={busy}>
          파일 선택
        </Button>
        {fileName ? (
          <span className={styles.fileName}>
            {fileName}{!error ? ` — ${rows.length}건 인식됨` : ''}
          </span>
        ) : (
          <span className={styles.fileName}>.xls, .xlsx 파일</span>
        )}
      </div>

      {error && <p className={styles.error} role="alert">{error}</p>}

      {results && (
        <div className={styles.results}>
          <Table>
            <thead>
              <tr>
                <th>거래처</th>
                <th>승인번호</th>
                <th className="num">금액</th>
                <th>결과</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.approvalNo}>
                  <td>{r.buyerName}</td>
                  <td className={styles.approvalNo}>{r.approvalNo}</td>
                  <td className="num">{r.totalAmount.toLocaleString()}<span className="unit">원</span></td>
                  <td title={r.detail}>
                    <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </Modal>
  )
}
