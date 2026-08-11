'use client'

import { useState, useEffect, useCallback, type KeyboardEvent, type FormEvent } from 'react'
import { createClient } from '@/utils/supabase'
import Button from './../ui/Button'
import InputField from './../ui/Input'
import { Client } from '@/app/types'
import {
  createClientAction,
  updateClientAction,
  getWarehouseMachinesAction,
  getClientInstalledMachinesAction,
  attachMachinesToClientAction,
  type NewMachineDraft,
} from '@/app/actions/client'
import { loadAppSettings } from '@/utils/appSettings'
import SuggestInput from '@/components/ui/SuggestInput'
import { toMachineModelName } from '@/utils/suggestMatch'
import { normalizeInventoryModelNamesAction } from '@/app/actions/inventory'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  editData?: Client | null
}

interface ClientFormState {
  name: string
  business_number: string
  representative_name: string
  contact_person: string
  job_title: string
  phone: string
  office_phone: string
  email: string
  address: string
  memo: string
  parent_id: string
  status: string
}

type WarehouseMachine = {
  id: string
  type: string | null
  category: string | null
  brand: string | null
  model_name: string
  serial_number: string
  status: string | null
  billing_date: string | null
  plan_basic_fee: number | null
}

function buildInitialClientForm(): ClientFormState {
  return {
    name: '', business_number: '', representative_name: '', contact_person: '',
    job_title: '', phone: '', office_phone: '', email: '', address: '', memo: '', parent_id: '',
    status: loadAppSettings().clients.defaultStatus,
  }
}

function emptyNewMachine(): NewMachineDraft {
  const inv = loadAppSettings().inventory
  return {
    type: inv.defaultMachineType,
    category: inv.defaultCategory,
    brand: '',
    model_name: '',
    serial_number: '',
    department: '',
    billing_date: inv.defaultBillingDate,
    plan_basic_fee: 0,
    initial_count_bw: 0,
    initial_count_col: 0,
  }
}

const MACHINE_TYPES = [
  'A3 레이저복합기', 'A4 레이저복합기',
  'A3 레이저프린터', 'A4 레이저프린터',
  'A3 잉크젯복합기', 'A4 잉크젯복합기',
  'A3 잉크젯프린터', 'A4 잉크젯프린터',
]

export default function ClientForm({ isOpen, onClose, onSuccess, editData }: Props) {
  const [loading, setLoading] = useState(false)
  const [potentialParents, setPotentialParents] = useState<Client[]>([])
  const [formData, setFormData] = useState<ClientFormState>(buildInitialClientForm)

  const [warehouseAll, setWarehouseAll] = useState<WarehouseMachine[]>([])
  const [machineSearch, setMachineSearch] = useState('')
  const [selectedWarehouseIds, setSelectedWarehouseIds] = useState<string[]>([])
  const [installedMachines, setInstalledMachines] = useState<WarehouseMachine[]>([])
  const [newMachines, setNewMachines] = useState<NewMachineDraft[]>([])
  const [showNewMachineForm, setShowNewMachineForm] = useState(false)
  const [draftMachine, setDraftMachine] = useState<NewMachineDraft>(emptyNewMachine)
  const [editingMachineIndex, setEditingMachineIndex] = useState<number | null>(null)
  const [clientNameSuggestions, setClientNameSuggestions] = useState<Array<{ value: string; hint?: string }>>([])
  const [machineModelSuggestions, setMachineModelSuggestions] = useState<Array<{ value: string; hint?: string }>>([])
  const [machineSnSuggestions, setMachineSnSuggestions] = useState<Array<{ value: string; hint?: string }>>([])
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false)

  const fetchPotentialParents = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
    if (profile?.organization_id) {
      let query = supabase.from('clients')
        .select('id, name, organization_id, address, business_number')
        .eq('organization_id', profile.organization_id)
        .eq('is_deleted', false)

      if (editData && editData.id) {
        query = query.neq('id', editData.id)
      }

      const { data } = await query
      if (data) {
        setPotentialParents(data as Client[])
        setClientNameSuggestions(
          data.map((c) => ({
            value: c.name,
            hint: c.address || c.business_number || undefined,
          }))
        )
      }

      const { data: inv } = await supabase
        .from('inventory')
        .select('model_name, serial_number, brand, type')
        .eq('organization_id', profile.organization_id)

      setMachineModelSuggestions(
        (inv || [])
          .filter((i) => i.model_name)
          .map((i) => ({
            value: toMachineModelName(i.model_name),
            hint: [i.brand, i.type].filter(Boolean).join(' · ') || undefined,
          }))
      )
      setMachineSnSuggestions(
        (inv || [])
          .filter((i) => i.serial_number)
          .map((i) => ({
            value: i.serial_number,
            hint: toMachineModelName(i.model_name || '') || undefined,
          }))
      )
    }
  }, [editData])

  const loadMachines = useCallback(async () => {
    const wh = await getWarehouseMachinesAction()
    if (wh.success) setWarehouseAll(wh.data as WarehouseMachine[])

    if (editData?.id) {
      const inst = await getClientInstalledMachinesAction(editData.id)
      if (inst.success) setInstalledMachines(inst.data as WarehouseMachine[])
    } else {
      setInstalledMachines([])
    }
  }, [editData?.id])

  useEffect(() => {
    if (!isOpen) return
    fetchPotentialParents()
    loadMachines()
    normalizeInventoryModelNamesAction().catch(() => {})
    setSelectedWarehouseIds([])
    setNewMachines([])
    setMachineSearch('')
    setShowNewMachineForm(false)
    setDraftMachine(emptyNewMachine())
    setEditingMachineIndex(null)
    setConfirmSaveOpen(false)

    if (editData) {
      setFormData({
        name: editData.name || '',
        business_number: editData.business_number || '',
        representative_name: editData.representative_name || '',
        contact_person: editData.contact_person || '',
        job_title: editData.job_title || '',
        phone: editData.phone || '',
        office_phone: editData.office_phone || '',
        email: editData.email || '',
        address: editData.address || '',
        memo: editData.memo || '',
        parent_id: editData.parent_id || '',
        status: editData.status || 'active',
      })
    } else {
      setFormData(buildInitialClientForm())
    }
  }, [editData, isOpen, fetchPotentialParents, loadMachines])

  const filteredWarehouse = warehouseAll.filter((m) => {
    if (selectedWarehouseIds.includes(m.id)) return true
    const q = machineSearch.trim().toLowerCase()
    if (!q) return true
    return (
      m.model_name.toLowerCase().includes(q) ||
      m.serial_number.toLowerCase().includes(q) ||
      (m.brand || '').toLowerCase().includes(q) ||
      (m.type || '').toLowerCase().includes(q)
    )
  })

  const toggleWarehouse = (id: string) => {
    setSelectedWarehouseIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const addDraftMachine = () => {
    const modelName = toMachineModelName(draftMachine.model_name || '')
    if (!modelName || !draftMachine.serial_number.trim()) {
      return alert('신규 기기의 모델명(영문 대문자)과 S/N을 입력해주세요.')
    }
    if (!draftMachine.type || !draftMachine.category) {
      return alert('종류와 구분을 선택해주세요.')
    }
    const snKey = draftMachine.serial_number.trim().toLowerCase()
    const dupInList = newMachines.some(
      (m, i) =>
        i !== editingMachineIndex &&
        m.serial_number.trim().toLowerCase() === snKey
    )
    const dupInWarehouse = warehouseAll.some(
      (m) => m.serial_number.toLowerCase() === snKey
    )
    if (dupInList || dupInWarehouse) {
      return alert('같은 S/N이 이미 목록 또는 창고에 있습니다.')
    }

    const nextMachine = { ...draftMachine, model_name: modelName }
    if (editingMachineIndex !== null) {
      setNewMachines((prev) =>
        prev.map((m, i) => (i === editingMachineIndex ? nextMachine : m))
      )
    } else {
      setNewMachines((prev) => [...prev, nextMachine])
    }
    setDraftMachine(emptyNewMachine())
    setEditingMachineIndex(null)
    setShowNewMachineForm(false)
  }

  const startEditNewMachine = (index: number) => {
    const m = newMachines[index]
    if (!m) return
    setDraftMachine({ ...m })
    setEditingMachineIndex(index)
    setShowNewMachineForm(true)
  }

  const cancelMachineDraft = () => {
    setShowNewMachineForm(false)
    setDraftMachine(emptyNewMachine())
    setEditingMachineIndex(null)
  }

  const removeNewMachine = (index: number) => {
    setNewMachines((prev) => prev.filter((_, i) => i !== index))
    if (editingMachineIndex === index) {
      cancelMachineDraft()
    } else if (editingMachineIndex !== null && editingMachineIndex > index) {
      setEditingMachineIndex(editingMachineIndex - 1)
    }
  }

  /** Enter = Tab처럼 다음 입력으로 이동 (저장 제출 방지) */
  const handleFormKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
    if (e.key !== 'Enter') return
    const target = e.target as HTMLElement
    const tag = target.tagName
    if (tag === 'TEXTAREA') return
    if (tag === 'BUTTON') return
    if ((target as HTMLInputElement).type === 'submit') return

    e.preventDefault()
    e.stopPropagation()

    const form = e.currentTarget
    const nodes = Array.from(
      form.querySelectorAll<HTMLElement>(
        'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])'
      )
    ).filter((el) => {
      if ((el as HTMLInputElement).type === 'checkbox') return false
      const rect = el.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0
    })

    const idx = nodes.indexOf(target)
    if (idx === -1) return
    const next = nodes[idx + 1]
    if (next) {
      next.focus()
      if (next instanceof HTMLInputElement || next instanceof HTMLTextAreaElement) {
        next.select?.()
      }
    }
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (loading) return
    setConfirmSaveOpen(true)
  }

  const performSave = async () => {
    setConfirmSaveOpen(false)
    setLoading(true)
    try {
      const payload = {
        ...formData,
        parent_id: formData.parent_id === '' ? null : formData.parent_id,
      }

      let clientId = editData?.id || null
      let result: { success: boolean; message: string; clientId?: string | null }

      if (editData && editData.id) {
        result = await updateClientAction(editData.id, payload)
        clientId = editData.id
      } else {
        result = await createClientAction(payload)
        clientId = result.clientId || null
      }

      if (!result.success) throw new Error(result.message)
      if (!clientId) throw new Error('거래처 ID를 확인할 수 없습니다.')

      if (selectedWarehouseIds.length > 0 || newMachines.length > 0) {
        const attach = await attachMachinesToClientAction(
          clientId,
          selectedWarehouseIds,
          newMachines
        )
        if (!attach.success) throw new Error(attach.message)
        alert(`${result.message}\n${attach.message}`)
      } else {
        alert(result.message)
      }

      onSuccess()
      onClose()
    } catch (error: any) {
      alert('저장 오류: ' + (error.message || String(error)))
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const selectedCount = selectedWarehouseIds.length + newMachines.length

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex',
      justifyContent: 'center', alignItems: 'center', zIndex: 1000,
    }}>
      <div style={{
        backgroundColor: 'var(--notion-bg)', padding: '28px 32px', borderRadius: '12px',
        width: 'min(720px, 96vw)', maxHeight: '92vh', overflowY: 'auto',
        boxShadow: '0 15px 50px rgba(0,0,0,0.1)',
      }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '20px' }}>
          {editData ? '거래처 수정' : '거래처 등록'}
        </h2>

        <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown}>
          <div style={{
            padding: '16px', backgroundColor: 'var(--notion-soft-bg)', borderRadius: '8px',
            marginBottom: '16px', border: '1px solid var(--notion-border)',
          }}>
            <InputField
              label="소속 본사"
              as="select"
              value={formData.parent_id}
              onChange={(e) => setFormData({ ...formData, parent_id: e.target.value })}
              style={{ marginBottom: 0 }}
            >
              <option value="">(독립 거래처)</option>
              {potentialParents.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </InputField>
          </div>

          <SuggestInput
            label="거래처명 *"
            required
            value={formData.name}
            suggestions={clientNameSuggestions}
            onChange={(v) => setFormData({ ...formData, name: v })}
            placeholder="기존 거래처와 비슷한 이름이 아래에 표시됩니다"
          />
          <div style={{ display: 'flex', gap: '12px' }}>
            <InputField label="사업자번호" value={formData.business_number} onChange={(e) => setFormData({ ...formData, business_number: e.target.value })} />
            <InputField label="대표자명" value={formData.representative_name} onChange={(e) => setFormData({ ...formData, representative_name: e.target.value })} />
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <InputField label="담당자" value={formData.contact_person} onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })} />
            <InputField label="직책" value={formData.job_title} onChange={(e) => setFormData({ ...formData, job_title: e.target.value })} placeholder="예: 과장, 팀장" />
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <InputField label="담당자 연락처" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="010-0000-0000" />
            <InputField label="일반 연락처" value={formData.office_phone} onChange={(e) => setFormData({ ...formData, office_phone: e.target.value })} placeholder="02-000-0000" />
          </div>
          <InputField label="이메일" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
          <InputField label="주소" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
          <InputField
            label="상태"
            as="select"
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
          >
            <option value="active">활성</option>
            <option value="inactive">비활성</option>
          </InputField>
          <InputField label="메모" as="textarea" value={formData.memo} onChange={(e) => setFormData({ ...formData, memo: e.target.value })} style={{ height: '70px' }} />

          {/* 기계 연결 섹션 */}
          <div style={{
            marginTop: '8px', padding: '16px', borderRadius: '8px',
            border: '1px solid var(--notion-border)', background: '#fafafa',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>설치 기계</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--notion-sub-text)', marginTop: 2 }}>
                  창고 기기를 찾거나 신규 기기를 추가한 뒤 저장하면 이 거래처에 설치됩니다.
                  {selectedCount > 0 ? ` (이번에 추가 ${selectedCount}대)` : ''}
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (showNewMachineForm) {
                    cancelMachineDraft()
                  } else {
                    setEditingMachineIndex(null)
                    setDraftMachine(emptyNewMachine())
                    setShowNewMachineForm(true)
                  }
                }}
              >
                {showNewMachineForm ? '입력 닫기' : '+ 신규 기기'}
              </Button>
            </div>

            {editData && installedMachines.length > 0 && (
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 6, color: '#555' }}>
                  현재 설치됨 ({installedMachines.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {installedMachines.map((m) => (
                    <div
                      key={m.id}
                      style={{
                        padding: '8px 10px', background: '#fff', borderRadius: 6,
                        border: '1px solid #e5e5e5', fontSize: '0.85rem',
                        display: 'flex', justifyContent: 'space-between',
                      }}
                    >
                      <span>
                        <strong>{m.model_name}</strong>
                        <span style={{ color: '#888', marginLeft: 8 }}>{m.serial_number}</span>
                      </span>
                      <span style={{ color: '#666', fontSize: '0.75rem' }}>{m.type}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <InputField
              label="창고 기계 검색"
              value={machineSearch}
              onChange={(e) => setMachineSearch(e.target.value)}
              placeholder="모델명, S/N, 브랜드…"
            />

            <div style={{
              maxHeight: 180, overflowY: 'auto', border: '1px solid #e5e5e5',
              borderRadius: 6, background: '#fff', marginBottom: 10,
            }}>
              {filteredWarehouse.length === 0 ? (
                <div style={{ padding: 14, fontSize: '0.85rem', color: '#888', textAlign: 'center' }}>
                  창고에 연결 가능한 기기가 없습니다. 신규 기기를 추가하세요.
                </div>
              ) : (
                filteredWarehouse.map((m) => {
                  const checked = selectedWarehouseIds.includes(m.id)
                  return (
                    <label
                      key={m.id}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10,
                        padding: '8px 12px', borderBottom: '1px solid #f0f0f0',
                        cursor: 'pointer', background: checked ? 'rgba(0,112,243,0.06)' : '#fff',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleWarehouse(m.id)}
                        style={{ marginTop: 3 }}
                      />
                      <span style={{ flex: 1, fontSize: '0.85rem' }}>
                        <strong>{m.model_name}</strong>
                        <span style={{ color: '#888' }}> · {m.serial_number}</span>
                        <div style={{ fontSize: '0.75rem', color: '#666', marginTop: 2 }}>
                          {[m.type, m.category, m.brand].filter(Boolean).join(' / ')}
                          {m.plan_basic_fee != null ? ` · 기본료 ${m.plan_basic_fee.toLocaleString()}원` : ''}
                        </div>
                      </span>
                    </label>
                  )
                })
              )}
            </div>

            {newMachines.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 6 }}>신규 추가 예정</div>
                {newMachines.map((m, idx) => (
                  <div
                    key={`${m.serial_number}-${idx}`}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '8px 10px', background: editingMachineIndex === idx ? '#eff6ff' : '#fff',
                      border: editingMachineIndex === idx ? '1px solid #0070f3' : '1px dashed #0070f3',
                      borderRadius: 6, marginBottom: 4, fontSize: '0.85rem',
                    }}
                  >
                    <span>
                      <strong>{m.model_name}</strong>
                      <span style={{ color: '#888', marginLeft: 8 }}>{m.serial_number}</span>
                      {m.department ? (
                        <span style={{ color: '#0070f3', fontSize: '0.75rem', marginLeft: 8 }}>{m.department}</span>
                      ) : null}
                      <span style={{ color: '#666', fontSize: '0.75rem', marginLeft: 8 }}>{m.type}</span>
                    </span>
                    <span style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => startEditNewMachine(idx)}
                        style={{ border: 'none', background: 'none', color: '#0070f3', cursor: 'pointer', fontSize: '0.8rem' }}
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => removeNewMachine(idx)}
                        style={{ border: 'none', background: 'none', color: '#d93025', cursor: 'pointer', fontSize: '0.8rem' }}
                      >
                        제거
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            )}

            {showNewMachineForm && (
              <div style={{
                padding: 12, background: '#fff', borderRadius: 8,
                border: '1px solid #0070f3', marginTop: 4,
              }}>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 10 }}>
                  {editingMachineIndex !== null ? `신규 기기 수정 (#${editingMachineIndex + 1})` : '신규 기기 입력'}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <InputField
                    label="종류 *"
                    as="select"
                    value={draftMachine.type}
                    onChange={(e) => setDraftMachine({ ...draftMachine, type: e.target.value })}
                  >
                    {MACHINE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </InputField>
                  <InputField
                    label="구분 *"
                    as="select"
                    value={draftMachine.category}
                    onChange={(e) => setDraftMachine({ ...draftMachine, category: e.target.value })}
                  >
                    <option value="컬러">컬러</option>
                    <option value="흑백">흑백</option>
                  </InputField>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <InputField
                    label="브랜드"
                    value={draftMachine.brand || ''}
                    onChange={(e) => setDraftMachine({ ...draftMachine, brand: e.target.value })}
                  />
                  <InputField
                    label="청구일"
                    as="select"
                    value={draftMachine.billing_date || '말일'}
                    onChange={(e) => setDraftMachine({ ...draftMachine, billing_date: e.target.value })}
                  >
                    <option value="말일">매월 말일</option>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={String(d)}>매월 {d}일</option>
                    ))}
                  </InputField>
                </div>
                <SuggestInput
                  label="모델명 * (영문 대문자)"
                  value={draftMachine.model_name}
                  suggestions={machineModelSuggestions}
                  transform={toMachineModelName}
                  onChange={(v) => setDraftMachine({ ...draftMachine, model_name: v })}
                  placeholder="예: APEOS C3060"
                  style={{ textTransform: 'uppercase' }}
                />
                <SuggestInput
                  label="S/N *"
                  value={draftMachine.serial_number}
                  suggestions={machineSnSuggestions}
                  onChange={(v) => setDraftMachine({ ...draftMachine, serial_number: v })}
                />
                <InputField
                  label="부서 (호출명)"
                  placeholder="예: 총무팀, 1층 데스크"
                  value={draftMachine.department || ''}
                  onChange={(e) => setDraftMachine({ ...draftMachine, department: e.target.value })}
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <InputField
                    label="초기 카운터(흑백)"
                    type="number"
                    value={draftMachine.initial_count_bw ?? 0}
                    onChange={(e) => setDraftMachine({ ...draftMachine, initial_count_bw: Number(e.target.value) })}
                  />
                  <InputField
                    label="초기 카운터(칼라)"
                    type="number"
                    value={draftMachine.initial_count_col ?? 0}
                    onChange={(e) => setDraftMachine({ ...draftMachine, initial_count_col: Number(e.target.value) })}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                  <Button type="button" variant="ghost" size="sm" onClick={cancelMachineDraft}>취소</Button>
                  <Button type="button" variant="primary" size="sm" onClick={addDraftMachine}>
                    {editingMachineIndex !== null ? '수정 반영' : '목록에 추가'}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '24px' }}>
            <Button variant="ghost" type="button" onClick={onClose}>취소</Button>
            <Button variant="primary" type="submit" disabled={loading}>
              {loading ? '저장 중…' : selectedCount > 0 ? `저장 (기계 ${selectedCount}대 포함)` : '저장하기'}
            </Button>
          </div>
        </form>
      </div>

      {confirmSaveOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.45)',
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => !loading && setConfirmSaveOpen(false)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: '24px 28px',
              width: 'min(360px, 92vw)',
              boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 8 }}>
              정말로 저장하시겠습니까?
            </div>
            <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: 20, lineHeight: 1.5 }}>
              {editData ? '거래처 정보가 수정됩니다.' : '새 거래처가 등록됩니다.'}
              {selectedCount > 0 ? ` 기계 ${selectedCount}대도 함께 연결됩니다.` : ''}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmSaveOpen(false)}
                disabled={loading}
              >
                아니오
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={performSave}
                disabled={loading}
              >
                {loading ? '저장 중…' : '예'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
