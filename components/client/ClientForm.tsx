'use client'

import { useState, useEffect, useCallback } from 'react'
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
    phone: '', office_phone: '', email: '', address: '', memo: '', parent_id: '',
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
  const [clientNameSuggestions, setClientNameSuggestions] = useState<Array<{ value: string; hint?: string }>>([])
  const [machineModelSuggestions, setMachineModelSuggestions] = useState<Array<{ value: string; hint?: string }>>([])
  const [machineSnSuggestions, setMachineSnSuggestions] = useState<Array<{ value: string; hint?: string }>>([])

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

    if (editData) {
      setFormData({
        name: editData.name || '',
        business_number: editData.business_number || '',
        representative_name: editData.representative_name || '',
        contact_person: editData.contact_person || '',
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
    const dupInList = newMachines.some(
      (m) => m.serial_number.trim().toLowerCase() === draftMachine.serial_number.trim().toLowerCase()
    )
    const dupInWarehouse = warehouseAll.some(
      (m) => m.serial_number.toLowerCase() === draftMachine.serial_number.trim().toLowerCase()
    )
    if (dupInList || dupInWarehouse) {
      return alert('같은 S/N이 이미 목록 또는 창고에 있습니다.')
    }
    setNewMachines((prev) => [...prev, { ...draftMachine, model_name: modelName }])
    setDraftMachine(emptyNewMachine())
    setShowNewMachineForm(false)
  }

  const removeNewMachine = (index: number) => {
    setNewMachines((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
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

        <form onSubmit={handleSubmit}>
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
            <InputField label="연락처" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="010-0000-0000" />
          </div>
          <InputField label="이메일" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
          <InputField label="주소" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
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
                onClick={() => { setShowNewMachineForm((v) => !v); setDraftMachine(emptyNewMachine()) }}
              >
                {showNewMachineForm ? '신규 입력 닫기' : '+ 신규 기기'}
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
                      padding: '8px 10px', background: '#fff', border: '1px dashed #0070f3',
                      borderRadius: 6, marginBottom: 4, fontSize: '0.85rem',
                    }}
                  >
                    <span>
                      <strong>{m.model_name}</strong>
                      <span style={{ color: '#888', marginLeft: 8 }}>{m.serial_number}</span>
                      <span style={{ color: '#666', fontSize: '0.75rem', marginLeft: 8 }}>{m.type}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => removeNewMachine(idx)}
                      style={{ border: 'none', background: 'none', color: '#d93025', cursor: 'pointer', fontSize: '0.8rem' }}
                    >
                      제거
                    </button>
                  </div>
                ))}
              </div>
            )}

            {showNewMachineForm && (
              <div style={{
                padding: 12, background: '#fff', borderRadius: 8,
                border: '1px solid #0070f3', marginTop: 4,
              }}>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 10 }}>신규 기기 입력</div>
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
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowNewMachineForm(false)}>취소</Button>
                  <Button type="button" variant="primary" size="sm" onClick={addDraftMachine}>목록에 추가</Button>
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
    </div>
  )
}
