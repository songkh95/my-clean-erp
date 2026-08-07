'use client'

import { useRef, useState } from 'react'
import Button from '@/components/ui/Button'
import { createClient } from '@/utils/supabase'
import {
  importClientsMachinesFromExcelAction,
  type ClientImportResolution,
} from '@/app/actions/clientExcel'
import {
  downloadClientsMachinesTemplate,
  exportClientsAndMachinesToExcel,
  parseClientsMachinesExcel,
  type ClientExcelRow,
  type MachineExcelRow,
} from '@/utils/clientInventoryExcel'
import type { Client, Inventory } from '@/app/types'
import styles from '@/app/login/auth.module.css'

type Mode = 'export' | 'template' | 'import'

type CompareField = {
  key: string
  label: string
  existing: string
  excel: string
  changed: boolean
}

type ClientConflict = {
  key: string
  name: string
  existingId: string
  fields: CompareField[]
  choice: ClientImportResolution
}

const CLIENT_COMPARE_KEYS: Array<{
  label: string
  excelKey: keyof ClientExcelRow
  existingKey: keyof Client | 'parent_name'
}> = [
  { label: '담당자', excelKey: '담당자', existingKey: 'contact_person' },
  { label: '직책', excelKey: '직책', existingKey: 'job_title' },
  { label: '담당자 연락처', excelKey: '담당자연락처', existingKey: 'phone' },
  { label: '일반 연락처', excelKey: '일반연락처', existingKey: 'office_phone' },
  { label: '주소', excelKey: '주소', existingKey: 'address' },
  { label: '소속본사', excelKey: '소속본사', existingKey: 'parent_name' },
  { label: '사업자번호', excelKey: '사업자번호', existingKey: 'business_number' },
  { label: '대표자명', excelKey: '대표자명', existingKey: 'representative_name' },
  { label: '이메일', excelKey: '이메일', existingKey: 'email' },
  { label: '메모', excelKey: '메모', existingKey: 'memo' },
  { label: '상태', excelKey: '상태', existingKey: 'status' },
]

function norm(v: unknown): string {
  return String(v ?? '').trim()
}

function statusLabel(v: string): string {
  const s = v.trim().toLowerCase()
  if (!s || s === 'active' || s === '활성' || s === '사용') return '활성'
  if (s === 'inactive' || s === '비활성' || s === '중지') return '비활성'
  return v.trim() || '-'
}

function displayValue(label: string, v: string): string {
  if (label === '상태') return statusLabel(v)
  return v || '-'
}

function buildConflicts(
  excelClients: ClientExcelRow[],
  existingClients: Client[]
): ClientConflict[] {
  const nameById = new Map(existingClients.map((c) => [c.id, c.name]))
  const byName = new Map(
    existingClients
      .filter((c) => c.name)
      .map((c) => [c.name.trim().toLowerCase(), c] as const)
  )

  const conflicts: ClientConflict[] = []

  for (const row of excelClients) {
    const name = row.회사명?.trim()
    if (!name) continue
    const key = name.toLowerCase()
    const existing = byName.get(key)
    if (!existing) continue

    const existingView = {
      ...existing,
      parent_name: existing.parent_id ? nameById.get(existing.parent_id) || '' : '',
    }

    const fields: CompareField[] = CLIENT_COMPARE_KEYS.map(({ label, excelKey, existingKey }) => {
      const existingRaw = norm((existingView as Record<string, unknown>)[existingKey])
      const excelRaw = norm(row[excelKey])
      const existingShown =
        label === '상태' ? statusLabel(existingRaw) : existingRaw
      const excelShown = label === '상태' ? statusLabel(excelRaw) : excelRaw
      return {
        key: excelKey,
        label,
        existing: existingShown || '-',
        excel: excelShown || '-',
        changed: existingShown !== excelShown,
      }
    })

    // 내용이 완전히 같으면 선택 UI에 안 띄움 (자동 기존 유지)
    if (!fields.some((f) => f.changed)) continue

    conflicts.push({
      key,
      name,
      existingId: existing.id,
      fields,
      choice: 'overwrite',
    })
  }

  return conflicts
}

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
  const [pendingClients, setPendingClients] = useState<ClientExcelRow[] | null>(null)
  const [pendingMachines, setPendingMachines] = useState<MachineExcelRow[] | null>(null)
  const [conflicts, setConflicts] = useState<ClientConflict[] | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  const clearMsg = () => {
    setError('')
    setMessage('')
  }

  const resetImportState = () => {
    setPendingClients(null)
    setPendingMachines(null)
    setConflicts(null)
  }

  const handleClose = () => {
    if (busy) return
    resetImportState()
    onClose()
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

  const runImport = async (
    clients: ClientExcelRow[],
    machines: MachineExcelRow[],
    resolutions: Record<string, ClientImportResolution>
  ) => {
    const result = await importClientsMachinesFromExcelAction(clients, machines, resolutions)
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
    resetImportState()
    onImported()
  }

  const handleImportFile = async (file: File | null) => {
    if (!file) return
    setBusy(true)
    clearMsg()
    resetImportState()
    try {
      const buf = await file.arrayBuffer()
      const parsed = parseClientsMachinesExcel(buf)
      if (parsed.clients.length === 0 && parsed.machines.length === 0) {
        setError('가져올 행이 없습니다. 회사명 또는 기종/기계번호 열을 확인하세요.')
        return
      }

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

      const { data: existingClients, error: fetchErr } = await supabase
        .from('clients')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .eq('is_deleted', false)

      if (fetchErr) throw new Error(fetchErr.message)

      const found = buildConflicts(parsed.clients, (existingClients || []) as Client[])

      if (found.length > 0) {
        setPendingClients(parsed.clients)
        setPendingMachines(parsed.machines)
        setConflicts(found)
        setMessage(
          `중복 거래처 ${found.length}건이 있습니다. 기존 정보와 엑셀 내용을 비교한 뒤 선택하세요.`
        )
        return
      }

      const newCount = parsed.clients.length
      if (
        !confirm(
          `거래처 ${newCount}곳 · 기기 ${parsed.machines.length}대를 등록할까요?\n` +
            `(동일 회사명·내용이 같으면 유지, 기계번호 중복은 건너뜁니다)`
        )
      ) {
        return
      }

      await runImport(parsed.clients, parsed.machines, {})
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기 실패')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const setAllChoices = (choice: ClientImportResolution) => {
    setConflicts((prev) => (prev ? prev.map((c) => ({ ...c, choice })) : prev))
  }

  const setOneChoice = (key: string, choice: ClientImportResolution) => {
    setConflicts((prev) =>
      prev ? prev.map((c) => (c.key === key ? { ...c, choice } : c)) : prev
    )
  }

  const handleConfirmConflicts = async () => {
    if (!pendingClients || !pendingMachines || !conflicts) return
    setBusy(true)
    clearMsg()
    try {
      const resolutions: Record<string, ClientImportResolution> = {}
      for (const c of conflicts) {
        resolutions[c.key] = c.choice
      }
      // 내용이 같아 목록에 안 오른 중복은 기본 keep
      await runImport(pendingClients, pendingMachines, resolutions)
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기 실패')
    } finally {
      setBusy(false)
    }
  }

  const showingConflicts = !!conflicts && conflicts.length > 0

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
      onClick={handleClose}
    >
      <div
        className={styles.card}
        style={{
          maxWidth: showingConflicts ? 720 : 520,
          width: '100%',
          margin: 0,
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className={styles.brand}>거래처 · 기기</p>
        <h2 className={styles.title} style={{ fontSize: '1.2rem' }}>
          {showingConflicts ? '중복 거래처 선택' : '엑셀 저장 / 양식 / 불러오기'}
        </h2>

        {showingConflicts ? (
          <>
            <p className={styles.subtitle}>
              이미 등록된 거래처와 엑셀 내용이 다릅니다.
              <br />
              거래처마다 <strong>기존 유지</strong> 또는 <strong>엑셀로 덮어쓰기</strong>를 선택하세요.
            </p>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAllChoices('keep')}
                disabled={busy}
              >
                모두 기존 유지
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAllChoices('overwrite')}
                disabled={busy}
              >
                모두 엑셀로
              </Button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {conflicts.map((c) => (
                <div
                  key={c.key}
                  style={{
                    border: '1px solid #e5e5e5',
                    borderRadius: 10,
                    padding: 14,
                    background: '#fff',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 12,
                      marginBottom: 10,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{c.name}</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => setOneChoice(c.key, 'keep')}
                        disabled={busy}
                        style={{
                          border: `1px solid ${c.choice === 'keep' ? '#2563eb' : '#ddd'}`,
                          background: c.choice === 'keep' ? '#eff6ff' : '#fff',
                          color: c.choice === 'keep' ? '#1d4ed8' : '#555',
                          borderRadius: 6,
                          padding: '6px 10px',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          fontWeight: c.choice === 'keep' ? 700 : 500,
                        }}
                      >
                        기존 유지
                      </button>
                      <button
                        type="button"
                        onClick={() => setOneChoice(c.key, 'overwrite')}
                        disabled={busy}
                        style={{
                          border: `1px solid ${c.choice === 'overwrite' ? '#16a34a' : '#ddd'}`,
                          background: c.choice === 'overwrite' ? '#f0fdf4' : '#fff',
                          color: c.choice === 'overwrite' ? '#15803d' : '#555',
                          borderRadius: 6,
                          padding: '6px 10px',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          fontWeight: c.choice === 'overwrite' ? 700 : 500,
                        }}
                      >
                        엑셀로 덮어쓰기
                      </button>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '100px 1fr 1fr',
                      gap: 6,
                      fontSize: '0.78rem',
                    }}
                  >
                    <div style={{ color: '#888', fontWeight: 600 }}>항목</div>
                    <div style={{ color: '#888', fontWeight: 600 }}>프로그램(기존)</div>
                    <div style={{ color: '#888', fontWeight: 600 }}>엑셀</div>
                    {c.fields
                      .filter((f) => f.changed || (f.existing !== '-' && f.excel !== '-'))
                      .map((f) => (
                        <div key={f.key} style={{ display: 'contents' }}>
                          <div style={{ color: '#555', padding: '4px 0' }}>{f.label}</div>
                          <div
                            style={{
                              padding: '4px 6px',
                              borderRadius: 4,
                              background: f.changed && c.choice === 'keep' ? '#eff6ff' : '#fafafa',
                              color: f.changed ? '#111' : '#777',
                              fontWeight: f.changed ? 600 : 400,
                              wordBreak: 'break-word',
                            }}
                          >
                            {displayValue(f.label, f.existing === '-' ? '' : f.existing)}
                          </div>
                          <div
                            style={{
                              padding: '4px 6px',
                              borderRadius: 4,
                              background:
                                f.changed && c.choice === 'overwrite' ? '#f0fdf4' : '#fafafa',
                              color: f.changed ? '#111' : '#777',
                              fontWeight: f.changed ? 600 : 400,
                              wordBreak: 'break-word',
                            }}
                          >
                            {displayValue(f.label, f.excel === '-' ? '' : f.excel)}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                marginTop: 16,
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
              }}
            >
              <Button
                variant="outline"
                onClick={() => {
                  resetImportState()
                  clearMsg()
                }}
                disabled={busy}
              >
                취소
              </Button>
              <Button variant="primary" onClick={handleConfirmConflicts} disabled={busy}>
                {busy
                  ? '적용 중...'
                  : `선택 반영 후 가져오기 (기기 ${pendingMachines?.length || 0}대)`}
              </Button>
            </div>
          </>
        ) : (
          <>
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
                  이미 있는 회사명이면 <strong>내용을 비교</strong>한 뒤 기존 유지 / 엑셀 덮어쓰기를 고릅니다.
                  <br />
                  기계번호가 같으면 해당 기기는 건너뜁니다.
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

            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="outline" onClick={handleClose} disabled={busy}>
                닫기
              </Button>
            </div>
          </>
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
      </div>
    </div>
  )
}
