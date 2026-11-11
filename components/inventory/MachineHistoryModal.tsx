'use client'

import { useCallback, useEffect, useState } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import InputField from '@/components/ui/Input'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { toast } from '@/components/ui/Toast'
import { useSingleFlight } from '@/hooks/useSingleFlight'
import {
  getMachineHistoryAction,
  createMachineHistoryAction,
  updateMachineHistoryAction,
  deleteMachineHistoryAction,
  type MachineHistoryAction,
} from '@/app/actions/machineHistory'
import styles from './MachineHistoryModal.module.css'

type Props = {
  inventoryId: string
  machineLabel: string
  clients: { id: string; name: string }[]
  onClose: () => void
  /** 이력이 바뀌면 목록을 새로 읽게 함 */
  onChanged?: () => void
}

type Row = {
  id: string
  action_type: string
  client_id: string | null
  client?: { id: string; name: string } | null
  recorded_at: string | null
  bw_count: number | null
  col_count: number | null
  bw_a3_count: number | null
  col_a3_count: number | null
  memo: string | null
  is_replacement: boolean | null
}

type Draft = {
  action_type: MachineHistoryAction
  client_id: string
  recorded_at: string
  bw_count: number
  col_count: number
  bw_a3_count: number
  col_a3_count: number
  memo: string
}

const emptyDraft = (): Draft => ({
  action_type: 'INSTALL',
  client_id: '',
  recorded_at: new Date().toISOString().split('T')[0],
  bw_count: 0,
  col_count: 0,
  bw_a3_count: 0,
  col_a3_count: 0,
  memo: '',
})

function toDateInput(value: string | null) {
  if (!value) return ''
  return String(value).split('T')[0]
}

function actionLabel(type: string) {
  return type === 'WITHDRAW' ? '철수' : '설치'
}

/** 기기 한 대가 거쳐 간 거래처와 설치·철수 기록 (DESIGN_SYSTEM.md 7.5) */
export default function MachineHistoryModal({ inventoryId, machineLabel, clients, onClose, onChanged }: Props) {
  const confirm = useConfirm()
  const runOnce = useSingleFlight()

  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft())
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await getMachineHistoryAction(inventoryId)
    if (res.success) setRows(res.data as Row[])
    else toast.error(res.message || '이력을 불러오지 못했습니다.')
    setLoading(false)
  }, [inventoryId])

  useEffect(() => { void load() }, [load])

  const startAdd = () => {
    setEditingId(null)
    setDraft(emptyDraft())
    setAdding(true)
  }

  const startEdit = (row: Row) => {
    setAdding(false)
    setEditingId(row.id)
    setDraft({
      action_type: row.action_type === 'WITHDRAW' ? 'WITHDRAW' : 'INSTALL',
      client_id: row.client_id || '',
      recorded_at: toDateInput(row.recorded_at) || new Date().toISOString().split('T')[0],
      bw_count: Number(row.bw_count || 0),
      col_count: Number(row.col_count || 0),
      bw_a3_count: Number(row.bw_a3_count || 0),
      col_a3_count: Number(row.col_a3_count || 0),
      memo: row.memo || '',
    })
  }

  const cancelEdit = () => {
    setAdding(false)
    setEditingId(null)
  }

  const save = () => runOnce('save-history', async () => {
    if (!draft.client_id) {
      toast.error('거래처를 선택해 주세요.')
      return
    }
    const input = {
      action_type: draft.action_type,
      client_id: draft.client_id,
      recorded_at: new Date(`${draft.recorded_at}T00:00:00`).toISOString(),
      bw_count: draft.bw_count,
      col_count: draft.col_count,
      bw_a3_count: draft.bw_a3_count,
      col_a3_count: draft.col_a3_count,
      memo: draft.memo.trim() || null,
    }
    const res = editingId
      ? await updateMachineHistoryAction(editingId, input)
      : await createMachineHistoryAction(inventoryId, input)

    if (!res.success) {
      toast.error(res.message)
      return
    }
    toast(res.message)
    cancelEdit()
    await load()
    onChanged?.()
  })

  const remove = (row: Row) => runOnce(`delete-history:${row.id}`, async () => {
    const ok = await confirm({
      title: '이 이력을 삭제할까요?',
      description: '정산은 이 기록을 보고 계산합니다. 지우면 지난 청구 금액이 달라질 수 있습니다.',
      confirmLabel: '삭제',
      danger: true,
    })
    if (!ok) return
    const res = await deleteMachineHistoryAction(row.id)
    if (!res.success) {
      toast.error(res.message)
      return
    }
    toast(res.message)
    await load()
    onChanged?.()
  })

  const editor = (
    <div className={styles.editor}>
      <div className={styles.editorGrid}>
        <InputField
          label="구분"
          as="select"
          value={draft.action_type}
          onChange={(e) => setDraft({ ...draft, action_type: e.target.value as MachineHistoryAction })}
        >
          <option value="INSTALL">설치</option>
          <option value="WITHDRAW">철수</option>
        </InputField>
        <InputField
          label="거래처"
          as="select"
          value={draft.client_id}
          onChange={(e) => setDraft({ ...draft, client_id: e.target.value })}
        >
          <option value="">거래처 선택</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </InputField>
        <InputField
          label="날짜"
          type="date"
          value={draft.recorded_at}
          onChange={(e) => setDraft({ ...draft, recorded_at: e.target.value })}
        />
      </div>
      <div className={styles.editorGrid}>
        <InputField
          label="흑백"
          type="number"
          value={draft.bw_count}
          onChange={(e) => setDraft({ ...draft, bw_count: Number(e.target.value) })}
        />
        <InputField
          label="컬러"
          type="number"
          value={draft.col_count}
          onChange={(e) => setDraft({ ...draft, col_count: Number(e.target.value) })}
        />
        <InputField
          label="흑백 A3"
          type="number"
          value={draft.bw_a3_count}
          onChange={(e) => setDraft({ ...draft, bw_a3_count: Number(e.target.value) })}
        />
        <InputField
          label="컬러 A3"
          type="number"
          value={draft.col_a3_count}
          onChange={(e) => setDraft({ ...draft, col_a3_count: Number(e.target.value) })}
        />
      </div>
      <InputField
        label="메모"
        value={draft.memo}
        onChange={(e) => setDraft({ ...draft, memo: e.target.value })}
        placeholder="예: 교체로 인한 회수"
      />
      <div className={styles.editorActions}>
        <Button variant="danger" onClick={cancelEdit}>취소</Button>
        <Button variant="primary" onClick={save}>{editingId ? '수정' : '추가'}</Button>
      </div>
    </div>
  )

  return (
    <Modal
      open
      onClose={onClose}
      title={`설치·철수 이력 — ${machineLabel}`}
      size="lg"
      footer={<Button variant="secondary" onClick={onClose}>닫기</Button>}
    >
      <div className={styles.toolbar}>
        <span className={styles.hint}>이 기기가 거쳐 간 거래처 기록입니다. 잘못된 내용은 고칠 수 있습니다.</span>
        <Button variant="primary" onClick={startAdd} disabled={adding}>이력 추가</Button>
      </div>

      {adding && !editingId ? editor : null}

      {loading ? (
        <p className={styles.empty}>불러오는 중…</p>
      ) : rows.length === 0 ? (
        <p className={styles.empty}>아직 기록된 설치·철수 이력이 없습니다.</p>
      ) : (
        <ul className={styles.list}>
          {rows.map((row) => (
            <li key={row.id} className={styles.row}>
              {editingId === row.id ? (
                editor
              ) : (
                <>
                  <div className={styles.rowMain}>
                    <span className={styles.rowTop}>
                      <span className={row.action_type === 'WITHDRAW' ? styles.tagOut : styles.tagIn}>
                        {actionLabel(row.action_type)}
                      </span>
                      <span className={styles.rowClient}>{row.client?.name || '(거래처 없음)'}</span>
                      <span className={styles.rowDate}>{toDateInput(row.recorded_at) || '-'}</span>
                      {row.is_replacement ? <span className={styles.rowFlag}>교체</span> : null}
                    </span>
                    <span className={styles.rowCounts}>
                      흑백 {Number(row.bw_count || 0).toLocaleString()} · 컬러 {Number(row.col_count || 0).toLocaleString()}
                      {row.bw_a3_count || row.col_a3_count
                        ? ` · A3 ${Number(row.bw_a3_count || 0).toLocaleString()}/${Number(row.col_a3_count || 0).toLocaleString()}`
                        : ''}
                    </span>
                    {row.memo ? <span className={styles.rowMemo}>{row.memo}</span> : null}
                  </div>
                  <div className={styles.rowActions}>
                    <Button variant="secondary" onClick={() => startEdit(row)}>수정</Button>
                    <Button variant="danger" onClick={() => remove(row)}>삭제</Button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
