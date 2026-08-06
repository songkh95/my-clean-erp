'use client'

import { useRef, useState } from 'react'
import Button from '@/components/ui/Button'
import { createClient } from '@/utils/supabase'
import { importClientsMachinesFromExcelAction } from '@/app/actions/clientExcel'
import {
  downloadClientsMachinesTemplate,
  exportClientsAndMachinesToExcel,
  parseClientsMachinesExcel,
} from '@/utils/clientInventoryExcel'
import type { Client, Inventory } from '@/app/types'
import styles from '@/app/login/auth.module.css'

type Mode = 'export' | 'template' | 'import'

export default function ClientExcelModal({
  isOpen,
  onClose,
  onImported,
}: {
  isOpen: boolean
  onClose: () => void
  onImported: () => void
}) {
  const [mode, setMode] = useState<Mode>('export')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  const clearMsg = () => {
    setError('')
    setMessage('')
  }

  const handleExport = async () => {
    setBusy(true)
    clearMsg()
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('로그인이 필요합니다.')

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single()
      if (!profile?.organization_id) throw new Error('조직 정보가 없습니다.')

      const orgId = profile.organization_id
      const [{ data: clients }, { data: machines }] = await Promise.all([
        supabase
          .from('clients')
          .select('*')
          .eq('organization_id', orgId)
          .eq('is_deleted', false)
          .order('name'),
        supabase
          .from('inventory')
          .select('*, client:clients(name)')
          .eq('organization_id', orgId)
          .order('created_at'),
      ])

      exportClientsAndMachinesToExcel(
        (clients || []) as Client[],
        (machines || []) as Array<Inventory & { client?: { name?: string | null } | null }>
      )
      setMessage(
        `거래처 ${(clients || []).length}건 · 기기 ${(machines || []).length}건을 엑셀로 저장했습니다.`
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패')
    } finally {
      setBusy(false)
    }
  }

  const handleTemplate = () => {
    clearMsg()
    downloadClientsMachinesTemplate()
    setMessage('양식 파일(거래처_기기_일괄등록_양식.xlsx)을 받았습니다. 샘플을 지우고 입력하세요.')
  }

  const handleImportFile = async (file: File | null) => {
    if (!file) return
    setBusy(true)
    clearMsg()
    try {
      const buf = await file.arrayBuffer()
      const parsed = parseClientsMachinesExcel(buf)
      if (parsed.clients.length === 0 && parsed.machines.length === 0) {
        setError('가져올 행이 없습니다. 회사명 또는 기종/기계번호 열을 확인하세요.')
        return
      }
      if (
        !confirm(
          `거래처 ${parsed.clients.length}곳 · 기기 ${parsed.machines.length}대를 한 번에 등록할까요?\n` +
            `(같은 회사명/기계번호는 건너뜁니다)`
        )
      ) {
        return
      }

      const result = await importClientsMachinesFromExcelAction(parsed.clients, parsed.machines)
      if (!result.success) {
        setError(result.message)
        return
      }
      setMessage(
        result.message +
          (result.errors.length
            ? `\n\n일부 오류 (${result.errors.length}건):\n${result.errors.slice(0, 10).join('\n')}`
            : '')
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
        style={{ maxWidth: 520, margin: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className={styles.brand}>거래처 · 기기</p>
        <h2 className={styles.title} style={{ fontSize: '1.2rem' }}>
          엑셀 저장 / 양식 / 불러오기
        </h2>
        <p className={styles.subtitle}>
          <strong>한 시트</strong>에 회사 정보와 기계를 같이 적으면 한 번에 등록됩니다.
          <br />
          같은 회사명으로 여러 행을 쓰면 기계만 추가됩니다.
        </p>

        <div className={styles.modeRow}>
          <button
            type="button"
            className={`${styles.modeBtn} ${mode === 'export' ? styles.modeBtnActive : ''}`}
            onClick={() => {
              setMode('export')
              clearMsg()
            }}
          >
            엑셀로 저장
          </button>
          <button
            type="button"
            className={`${styles.modeBtn} ${mode === 'template' ? styles.modeBtnActive : ''}`}
            onClick={() => {
              setMode('template')
              clearMsg()
            }}
          >
            양식 받기
          </button>
          <button
            type="button"
            className={`${styles.modeBtn} ${mode === 'import' ? styles.modeBtnActive : ''}`}
            onClick={() => {
              setMode('import')
              clearMsg()
            }}
          >
            엑셀 불러오기
          </button>
        </div>

        {mode === 'export' && (
          <div style={{ marginTop: 16 }}>
            <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: 12, lineHeight: 1.5 }}>
              등록된 거래처·기기를 <strong>한 시트</strong>로 내려받습니다. (기계 1대 = 1행)
            </p>
            <Button variant="primary" onClick={handleExport} disabled={busy} style={{ width: '100%' }}>
              {busy ? '내보내는 중...' : '엑셀로 저장'}
            </Button>
          </div>
        )}

        {mode === 'template' && (
          <div style={{ marginTop: 16 }}>
            <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: 12, lineHeight: 1.5 }}>
              한 시트 양식입니다. <strong>회사명 + 기계</strong>를 같은 행에 입력하세요.
              <br />
              같은 회사에 기계가 여러 대면 <strong>회사명을 반복</strong>하고 기계만 다르게 적습니다.
              <br />
              <strong>계약시작일 + 계약년수</strong> → 종료일 자동 계산
            </p>
            <Button variant="primary" onClick={handleTemplate} style={{ width: '100%' }}>
              양식 다운로드
            </Button>
          </div>
        )}

        {mode === 'import' && (
          <div style={{ marginTop: 16 }}>
            <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: 12, lineHeight: 1.5 }}>
              일괄등록 양식을 올리면 거래처와 기계를 <strong>한 번에</strong> 등록합니다.
              <br />
              이미 있는 회사명·기계번호는 건너뜁니다.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              disabled={busy}
              onChange={(e) => handleImportFile(e.target.files?.[0] || null)}
              style={{ width: '100%', fontSize: '0.85rem' }}
            />
          </div>
        )}

        {error && (
          <pre
            style={{
              marginTop: 14,
              padding: 10,
              background: '#fef2f2',
              color: '#b91c1c',
              borderRadius: 8,
              fontSize: '0.8rem',
              whiteSpace: 'pre-wrap',
            }}
          >
            {error}
          </pre>
        )}
        {message && (
          <pre
            style={{
              marginTop: 14,
              padding: 10,
              background: '#f0fdf4',
              color: '#166534',
              borderRadius: 8,
              fontSize: '0.8rem',
              whiteSpace: 'pre-wrap',
            }}
          >
            {message}
          </pre>
        )}

        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            닫기
          </Button>
        </div>
      </div>
    </div>
  )
}
