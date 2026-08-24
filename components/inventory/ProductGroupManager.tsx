'use client'

import { useCallback, useEffect, useState } from 'react'
import Button from '../ui/Button'
import InputField from '../ui/Input'
import SuggestInput from '../ui/SuggestInput'
import {
  deleteProductGroupAction,
  listProductGroupsAction,
  saveProductGroupAction,
  type ProductGroupRow,
} from '@/app/actions/productGroups'
import { getMachineModelOptionsAction } from '@/app/actions/consumable'
import { toMachineModelName } from '@/utils/suggestMatch'
import styles from './InventoryForm.module.css'
import local from './ProductGroupManager.module.css'

type Props = {
  isOpen: boolean
  onClose: () => void
  onChanged?: () => void
}

export default function ProductGroupManager({ isOpen, onClose, onChanged }: Props) {
  const [rows, setRows] = useState<ProductGroupRow[]>([])
  const [loading, setLoading] = useState(true)
  const [hint, setHint] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [memo, setMemo] = useState('')
  const [models, setModels] = useState<string[]>([])
  const [machineDraft, setMachineDraft] = useState('')
  const [machineSuggestions, setMachineSuggestions] = useState<Array<{ value: string; hint?: string }>>([])
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await listProductGroupsAction()
    setRows(res.data || [])
    setHint(res.message || '')
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!isOpen) return
    load()
    getMachineModelOptionsAction().then((list) => {
      setMachineSuggestions(list.map((g) => ({ value: g, hint: '기기 모델' })))
    })
  }, [isOpen, load])

  const resetForm = () => {
    setEditingId(null)
    setName('')
    setMemo('')
    setModels([])
    setMachineDraft('')
  }

  const startEdit = (row: ProductGroupRow) => {
    setEditingId(row.id)
    setName(row.name)
    setMemo(row.memo || '')
    setModels([...(row.machine_models || [])])
    setMachineDraft('')
  }

  const addModel = (raw?: string) => {
    const m = toMachineModelName(raw ?? machineDraft).trim()
    if (!m) return
    setModels((prev) => (prev.includes(m) ? prev : [...prev, m]))
    setMachineDraft('')
  }

  const handleSave = async () => {
    setSaving(true)
    const res = await saveProductGroupAction({
      id: editingId,
      name,
      memo,
      machineModels: models,
    })
    setSaving(false)
    if (!res.success) {
      alert(res.message || '저장 실패')
      return
    }
    alert(res.message || '저장되었습니다.')
    resetForm()
    await load()
    onChanged?.()
  }

  const handleDelete = async (row: ProductGroupRow) => {
    if (!confirm(`제품군 「${row.name}」을(를) 삭제할까요?\n(이미 소모품에 연결된 이름은 그대로 남습니다.)`)) return
    const res = await deleteProductGroupAction(row.id)
    if (!res.success) {
      alert(res.message || '삭제 실패')
      return
    }
    if (editingId === row.id) resetForm()
    await load()
    onChanged?.()
  }

  if (!isOpen) return null

  return (
    <div className={styles.overlay} style={{ zIndex: 1300 }}>
      <div className={`${styles.modal} ${local.wide}`}>
        <h2 className={styles.title}>제품군 · 호환기기 정리</h2>
        <p className={local.desc}>
          제품군은 여러 기기 모델을 묶는 이름입니다. 소모품 등록 시 제품군을 고르면 호환 기기가 자동으로 채워집니다.
        </p>

        {hint && !loading ? <p className={local.hint}>{hint}</p> : null}

        <div className={local.layout}>
          <section className={local.listPane}>
            <div className={local.paneTitle}>등록된 제품군</div>
            {loading ? (
              <p className={local.empty}>불러오는 중…</p>
            ) : rows.length === 0 ? (
              <p className={local.empty}>아직 제품군이 없습니다. 오른쪽에서 등록하세요.</p>
            ) : (
              <ul className={local.list}>
                {rows.map((row) => (
                  <li
                    key={row.id}
                    className={`${local.item} ${editingId === row.id ? local.itemActive : ''}`}
                  >
                    <button type="button" className={local.itemMain} onClick={() => startEdit(row)}>
                      <div className={local.itemName}>{row.name}</div>
                      <div className={local.itemModels}>
                        {row.machine_models.length > 0
                          ? row.machine_models.join(', ')
                          : '기기 없음'}
                      </div>
                    </button>
                    <button type="button" className={local.delBtn} onClick={() => void handleDelete(row)}>
                      삭제
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={local.formPane}>
            <div className={local.paneTitle}>{editingId ? '제품군 수정' : '제품군 신규 등록'}</div>
            <InputField label="제품군 이름 *" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: A3컬러복합기군" />
            <InputField
              label="메모"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="선택 사항"
            />

            <div className={local.modelsBlock}>
              <div className={local.modelsLabel}>호환 기기 * ({models.length})</div>
              <div className={local.chips}>
                {models.map((m) => (
                  <span key={m} className={local.chip}>
                    {m}
                    <button type="button" onClick={() => setModels((prev) => prev.filter((x) => x !== m))}>
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className={local.addRow}>
                <div style={{ flex: 1 }}>
                  <SuggestInput
                    label=""
                    value={machineDraft}
                    suggestions={machineSuggestions.filter((s) => !models.includes(s.value))}
                    transform={toMachineModelName}
                    onChange={setMachineDraft}
                    placeholder="예: HL-L64100DW"
                    style={{ textTransform: 'uppercase' }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addModel()
                      }
                    }}
                  />
                </div>
                <button type="button" className={local.addBtn} onClick={() => addModel()}>
                  추가
                </button>
              </div>
            </div>

            <div className={local.actions}>
              {editingId ? (
                <Button type="button" variant="ghost" onClick={resetForm}>
                  신규로 전환
                </Button>
              ) : null}
              <Button type="button" variant="ghost" onClick={onClose}>
                닫기
              </Button>
              <Button type="button" onClick={() => void handleSave()} disabled={saving}>
                {saving ? '저장 중…' : '저장'}
              </Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
