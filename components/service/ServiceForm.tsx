'use client'

import { useState, useEffect, useMemo, useRef, type CSSProperties } from 'react'
import { createClient } from '@/utils/supabase'
import Button from '@/components/ui/Button'
import InputField from '@/components/ui/Input'
import PartsUsagePicker, { type UsedPartRow } from '@/components/service/PartsUsagePicker'
import ServiceImages, {
  uploadPendingServiceImages,
  type LocalFile,
} from '@/components/service/ServiceImages'
import styles from '@/app/service/service.module.css'
import {
  getClientMachinesAction,
  getOfficeMachinesAction,
  getConsumablesAction,
  createServiceLogAction,
  updateServiceLogAction,
  getEmployeesAction,
  type ServiceLogKind,
} from '@/app/actions/service'
import { rollbackDraftConsumablesAction } from '@/app/actions/consumable'
import { loadAppSettings } from '@/utils/appSettings'
import { useAppSettings } from '@/hooks/useAppSettings'
import {
  canonicalizeMachineModel,
  collectKnownMachineModels,
  resolveMachineModel,
} from '@/utils/machineModelResolve'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  editData?: any
  logKind?: ServiceLogKind
}

type MachineOpt = {
  id: string
  model_name: string
  serial_number?: string | null
  department?: string | null
  source: 'client' | 'office'
}

const KIND_FORM_TITLE: Record<ServiceLogKind, { create: string; edit: string }> = {
  service: { create: '서비스 일지 작성', edit: '서비스 일지 수정' },
  sales_trip: { create: '판매_출장 일지 작성', edit: '판매_출장 일지 수정' },
  short_rental: { create: '단기 렌탈 일지 작성', edit: '단기 렌탈 일지 수정' },
}

const inputBoxStyle: CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid var(--notion-border)',
  borderRadius: 'var(--radius-sm)',
  fontSize: '0.9rem',
  boxSizing: 'border-box',
  background: 'var(--notion-bg)',
  color: 'var(--notion-main-text)',
}

function buildInitialServiceForm(logKind: ServiceLogKind = 'service') {
  const s = loadAppSettings().service
  return {
    log_kind: logKind,
    client_id: '',
    client_name: '',
    machine_model: '',
    inventory_id: '',
    status: s.defaultStatus,
    service_type: s.defaultServiceType,
    visit_date: new Date().toISOString().split('T')[0],
    symptom: '',
    action_detail: '',
    memo: '',
    spare_stock: '',
    spare_stock_at: '',
    meter_bw: 0,
    meter_col: 0,
    manager_id: '',
  }
}

export default function ServiceForm({
  isOpen,
  onClose,
  onSuccess,
  editData,
  logKind = 'service',
}: Props) {
  const { settings } = useAppSettings()
  const [loading, setLoading] = useState(false)
  const [clients, setClients] = useState<any[]>([])
  const [machines, setMachines] = useState<any[]>([])
  const [officeMachines, setOfficeMachines] = useState<any[]>([])
  const [consumables, setConsumables] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [formData, setFormData] = useState(() => buildInitialServiceForm(logKind))
  const [usedParts, setUsedParts] = useState<UsedPartRow[]>([])
  const [pendingImages, setPendingImages] = useState<LocalFile[]>([])
  const [clientQuery, setClientQuery] = useState('')
  const [clientMenuOpen, setClientMenuOpen] = useState(false)
  const [skipClientRegister, setSkipClientRegister] = useState(false)
  const [machineQuery, setMachineQuery] = useState('')
  const [machineMenuOpen, setMachineMenuOpen] = useState(false)
  const sessionCreatedRef = useRef<string[]>([])
  const savedRef = useRef(false)
  const clientBlurTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const machineBlurTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const supabase = createClient()
  const isVisitStyle = logKind === 'sales_trip' || logKind === 'short_rental'
  const allowSkipClient = isVisitStyle
  const formTitle = KIND_FORM_TITLE[logKind] || KIND_FORM_TITLE.service
  const serviceTypes = settings.service.serviceTypes.length > 0
    ? settings.service.serviceTypes
    : ['A/S', '정기점검', '설치', '철수', '배송']

  const creditById = useMemo(() => {
    const map: Record<string, number> = {}
    if (editData?.status !== '완료' || !editData?.parts_usage) return map
    for (const p of editData.parts_usage as any[]) {
      const id = p.consumable?.id
      if (!id) continue
      if (p.stock_status === 'pending' || p.stock_status === 'none') continue
      map[id] = (map[id] || 0) + (Number(p.quantity) || 0)
    }
    return map
  }, [editData])

  const machineOptions = useMemo((): MachineOpt[] => {
    const list: MachineOpt[] = []
    for (const m of officeMachines) {
      list.push({
        id: m.id,
        model_name: m.model_name,
        serial_number: m.serial_number,
        department: m.department,
        source: 'office',
      })
    }
    for (const m of machines) {
      if (list.some((x) => x.id === m.id)) continue
      list.push({
        id: m.id,
        model_name: m.model_name,
        serial_number: m.serial_number,
        department: m.department,
        source: 'client',
      })
    }
    return list
  }, [officeMachines, machines])

  const selectedMachine = useMemo(
    () => machineOptions.find((m) => m.id === formData.inventory_id) || null,
    [machineOptions, formData.inventory_id]
  )

  const machineModel = useMemo(() => {
    const known = collectKnownMachineModels({
      inventoryModels: [
        ...officeMachines.map((m) => m.model_name),
        ...machines.map((m) => m.model_name),
        ...consumables.flatMap((c) => c.compatible_models || []),
        ...consumables.map((c) => c.product_group),
      ],
      consumables,
    })
    const raw =
      formData.machine_model ||
      selectedMachine?.model_name ||
      editData?.machine_model ||
      editData?.inventory?.model_name ||
      machineQuery.replace(/\s*\([^)]*\)\s*$/, '').trim() ||
      ''
    return resolveMachineModel(raw, known)
  }, [
    formData.machine_model,
    selectedMachine?.model_name,
    editData?.machine_model,
    editData?.inventory?.model_name,
    machineQuery,
    officeMachines,
    machines,
    consumables,
  ])

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === formData.client_id) || null,
    [clients, formData.client_id]
  )

  const filteredClients = useMemo(() => {
    const q = clientQuery.trim().toLowerCase()
    const list = !q
      ? clients
      : clients.filter((c) => String(c.name || '').toLowerCase().includes(q))
    return list.slice(0, 80)
  }, [clients, clientQuery])

  const filteredMachines = useMemo(() => {
    const q = machineQuery.trim().toLowerCase()
    const list = !q
      ? machineOptions
      : machineOptions.filter((m) => {
          const hay = `${m.model_name} ${m.serial_number || ''} ${m.department || ''}`.toLowerCase()
          return hay.includes(q)
        })
    return list.slice(0, 80)
  }, [machineOptions, machineQuery])

  const selectClient = (client: { id: string; name: string }) => {
    setSkipClientRegister(false)
    const sameClient = formData.client_id === client.id
    setFormData((prev) => ({
      ...prev,
      client_id: client.id,
      client_name: client.name,
      inventory_id: sameClient ? prev.inventory_id : isVisitStyle ? prev.inventory_id : '',
      machine_model: sameClient ? prev.machine_model : isVisitStyle ? prev.machine_model : '',
    }))
    setClientQuery(client.name)
    setClientMenuOpen(false)
    if (!sameClient && !isVisitStyle) setMachineQuery('')
  }

  const clearClient = () => {
    setFormData((prev) => ({
      ...prev,
      client_id: '',
      client_name: skipClientRegister ? clientQuery : '',
      inventory_id: isVisitStyle ? prev.inventory_id : '',
      machine_model: isVisitStyle ? prev.machine_model : '',
    }))
    setClientQuery('')
    setClientMenuOpen(!skipClientRegister)
  }

  const selectMachine = (m: MachineOpt) => {
    setFormData((prev) => ({
      ...prev,
      inventory_id: m.id,
      machine_model: m.model_name || '',
    }))
    setMachineQuery(
      m.serial_number ? `${m.model_name} (${m.serial_number})` : m.model_name
    )
    setMachineMenuOpen(false)
  }

  const clearMachine = () => {
    setFormData((prev) => ({ ...prev, inventory_id: '', machine_model: '' }))
    setMachineQuery('')
    setMachineMenuOpen(true)
  }

  useEffect(() => {
    if (!isOpen) return
    savedRef.current = false
    sessionCreatedRef.current = []

    const loadData = async () => {
      const { data: clientData } = await supabase
        .from('clients')
        .select('id, name')
        .eq('is_deleted', false)
        .order('name')
      if (clientData) setClients(clientData)

      const consumableData = await getConsumablesAction()
      setConsumables(consumableData)

      const employeeData = await getEmployeesAction()
      setEmployees(employeeData)

      if (isVisitStyle) {
        const office = await getOfficeMachinesAction()
        setOfficeMachines(office)
      } else {
        setOfficeMachines([])
      }

      setPendingImages([])

      if (editData) {
        const hasRegistered = Boolean(editData.client_id)
        const name = editData.client?.name || editData.client_name || ''
        const modelLabel =
          editData.machine_model ||
          (editData.inventory
            ? `${editData.inventory.model_name}${editData.inventory.serial_number ? ` (${editData.inventory.serial_number})` : ''}`
            : '')
        setSkipClientRegister(allowSkipClient && !hasRegistered)
        setFormData({
          log_kind: normalizeEditKind(editData.log_kind, logKind),
          client_id: editData.client_id || '',
          client_name: name,
          machine_model: editData.machine_model || editData.inventory?.model_name || '',
          inventory_id: editData.inventory_id || '',
          status: editData.status || settings.service.defaultStatus,
          service_type: editData.service_type || settings.service.defaultServiceType,
          visit_date: editData.visit_date || new Date().toISOString().split('T')[0],
          symptom: editData.symptom || '',
          action_detail: editData.action_detail || '',
          memo: editData.memo || '',
          spare_stock: editData.spare_stock || '',
          spare_stock_at: editData.spare_stock_at || '',
          meter_bw: editData.meter_bw || 0,
          meter_col: editData.meter_col || 0,
          manager_id: editData.manager_id || '',
        })
        setClientQuery(name)
        setMachineQuery(modelLabel)
        setClientMenuOpen(false)
        setMachineMenuOpen(false)

        if (editData.parts_usage) {
          const wasDone = editData.status === '완료'
          const parts = editData.parts_usage.map((p: any) => {
            const current = p.consumable?.current_stock || 0
            const prevQty = Number(p.quantity) || 0
            const credited = wasDone && p.stock_status !== 'pending' && p.stock_status !== 'none'
            return {
              consumable_id: p.consumable?.id,
              quantity: prevQty,
              max_stock: credited ? current + prevQty : current,
            }
          }).filter((p: UsedPartRow) => p.consumable_id)
          const merged = new Map<string, UsedPartRow>()
          for (const p of parts) {
            const prev = merged.get(p.consumable_id)
            if (prev) {
              merged.set(p.consumable_id, {
                consumable_id: p.consumable_id,
                quantity: prev.quantity + p.quantity,
                max_stock: Math.max(prev.max_stock, p.max_stock),
              })
            } else {
              merged.set(p.consumable_id, p)
            }
          }
          setUsedParts(Array.from(merged.values()))
        } else {
          setUsedParts([])
        }

        if (editData.client_id) {
          getClientMachinesAction(editData.client_id).then(setMachines)
        }
      } else {
        setSkipClientRegister(false)
        setFormData(buildInitialServiceForm(logKind))
        setUsedParts([])
        setClientQuery('')
        setMachineQuery('')
        setClientMenuOpen(false)
        setMachineMenuOpen(false)
      }
    }
    loadData()
  }, [isOpen, editData, logKind, allowSkipClient, isVisitStyle, settings.service.defaultServiceType, settings.service.defaultStatus])

  useEffect(() => {
    if (!formData.client_id || !clients.length) return
    if (clientQuery.trim()) return
    const found = clients.find((c) => c.id === formData.client_id)
    if (found?.name) setClientQuery(found.name)
  }, [clients, formData.client_id, clientQuery])

  useEffect(() => {
    if (formData.client_id) {
      getClientMachinesAction(formData.client_id).then(setMachines)
    } else {
      setMachines([])
    }
  }, [formData.client_id])

  const validatePartsForSubmit = (): boolean => {
    const filled = usedParts.filter((p) => p.consumable_id)
    for (const part of filled) {
      const qty = Number(part.quantity)
      if (!Number.isInteger(qty) || qty <= 0) {
        alert('소모품 수량은 1 이상의 정수여야 합니다.')
        return false
      }
    }

    if (formData.status !== '완료') return true

    const shortages: string[] = []
    const needed = new Map<string, number>()
    for (const part of filled) {
      needed.set(part.consumable_id, (needed.get(part.consumable_id) || 0) + Number(part.quantity))
    }
    for (const [id, qty] of needed) {
      const item = consumables.find((c) => c.id === id)
      const name = item?.model_name || id
      let available = Number(item?.current_stock) || 0
      if (editData?.status === '완료' && editData?.parts_usage) {
        available += (editData.parts_usage as any[])
          .filter((p) => p.consumable?.id === id && p.stock_status !== 'pending' && p.stock_status !== 'none')
          .reduce((sum, p) => sum + (Number(p.quantity) || 0), 0)
      }
      if (qty > available) {
        shortages.push(`${name}: 재고 ${available} → 초과 ${qty - available}개는 미입고`)
      }
    }

    if (shortages.length > 0) {
      return confirm(
        `재고가 부족한 항목이 있습니다.\n${shortages.join('\n')}\n\n가용분은 즉시 차감하고, 부족분은 미입고(가출고)로 저장합니다.\n계속할까요?`
      )
    }
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const nameOnly = skipClientRegister && allowSkipClient
    if (nameOnly) {
      if (!clientQuery.trim()) return alert('거래처명을 입력해주세요.')
    } else if (!formData.client_id) {
      return alert('거래처를 선택해주세요.')
    }
    if (!formData.manager_id) return alert('담당자를 선택해주세요.')
    if (!validatePartsForSubmit()) return

    setLoading(true)

    const payloadParts = usedParts
      .filter((p) => p.consumable_id)
      .map((p) => ({ consumable_id: p.consumable_id, quantity: Number(p.quantity) }))

    const freeMachine =
      !formData.inventory_id && machineQuery.trim()
        ? machineQuery.replace(/\s*\([^)]*\)\s*$/, '').trim()
        : formData.machine_model

    const resolvedModel =
      resolveMachineModel(freeMachine || formData.machine_model || '', [
        ...officeMachines.map((m) => String(m.model_name || '')),
        ...machines.map((m) => String(m.model_name || '')),
      ]) || canonicalizeMachineModel(freeMachine || formData.machine_model || '')

    const payload = {
      ...formData,
      log_kind: logKind,
      client_id: nameOnly ? '' : formData.client_id,
      client_name: nameOnly ? clientQuery.trim() : formData.client_name || clientQuery.trim(),
      inventory_id: formData.inventory_id || '',
      machine_model: resolvedModel || '',
    }

    let result: any
    if (editData) {
      result = await updateServiceLogAction(editData.id, payload, payloadParts)
    } else {
      result = await createServiceLogAction(payload, payloadParts)
    }

    if (!result.success) {
      alert(result.message || '저장에 실패했습니다.')
      setLoading(false)
      return
    }

    savedRef.current = true
    sessionCreatedRef.current = []

    const logId = editData?.id || result.id
    if (logId && pendingImages.length > 0) {
      const up = await uploadPendingServiceImages(logId, pendingImages)
      if (!up.ok) {
        alert(`${result.message}\n다만 이미지: ${up.message}`)
        onSuccess()
        onClose()
        setLoading(false)
        return
      }
    }

    alert(result.message || (editData ? '수정되었습니다.' : '저장되었습니다.'))
    onSuccess()
    onClose()
    setLoading(false)
  }

  const handleCancel = async () => {
    if (!savedRef.current && sessionCreatedRef.current.length > 0) {
      const remove = confirm(
        `이번 화면에서 새로 등록한 소모품 ${sessionCreatedRef.current.length}건이 있습니다.\n` +
          `일지를 저장하지 않고 닫습니다. 방금 등록한 소모품도 삭제할까요?\n\n` +
          `「확인」= 소모품도 삭제 · 「취소」= 소모품은 재고에 남김`
      )
      if (remove) await rollbackDraftConsumablesAction([...sessionCreatedRef.current])
    }
    onClose()
  }

  if (!isOpen) return null

  const clientLocked = Boolean(editData) && !allowSkipClient
  const clientInputDisabled = clientLocked

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal} style={{ width: 760, maxWidth: '100%' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '20px' }}>
          {editData ? formTitle.edit : formTitle.create}
        </h2>

        <form onSubmit={handleSubmit}>
          <div className={styles.formGrid}>
            <div style={{ marginBottom: 16, position: 'relative' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: 4,
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  color: 'var(--notion-sub-text)',
                }}
              >
                거래처 *
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  value={clientQuery}
                  placeholder={skipClientRegister ? '거래처명 직접 입력' : '거래처명 검색 후 선택'}
                  autoComplete="off"
                  disabled={clientInputDisabled}
                  readOnly={clientInputDisabled}
                  onChange={(e) => {
                    if (clientInputDisabled) return
                    const v = e.target.value
                    setClientQuery(v)
                    if (skipClientRegister) {
                      setFormData((prev) => ({
                        ...prev,
                        client_id: '',
                        client_name: v,
                      }))
                      setClientMenuOpen(false)
                      return
                    }
                    setClientMenuOpen(true)
                    if (
                      formData.client_id &&
                      selectedClient &&
                      v.trim() !== String(selectedClient.name || '')
                    ) {
                      setFormData((prev) => ({
                        ...prev,
                        client_id: '',
                        client_name: '',
                        inventory_id: isVisitStyle ? prev.inventory_id : '',
                        machine_model: isVisitStyle ? prev.machine_model : '',
                      }))
                    }
                  }}
                  onFocus={() => {
                    if (clientInputDisabled || skipClientRegister) return
                    if (clientBlurTimer.current) clearTimeout(clientBlurTimer.current)
                    setClientMenuOpen(true)
                  }}
                  onBlur={() => {
                    clientBlurTimer.current = setTimeout(() => setClientMenuOpen(false), 150)
                  }}
                  style={{
                    ...inputBoxStyle,
                    flex: 1,
                    ...(clientInputDisabled
                      ? { background: '#f3f4f6', color: '#6b7280' }
                      : null),
                  }}
                />
                {!clientInputDisabled && (formData.client_id || clientQuery) ? (
                  <Button variant="secondary"
                    type="button"
                    onClick={clearClient}>
                    지우기
                  </Button>
                ) : null}
              </div>
              {allowSkipClient && !editData ? (
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    marginTop: 8,
                    fontSize: '0.8rem',
                    color: 'var(--notion-main-text)',
                    cursor: 'pointer',
                    userSelect: 'none',
                    lineHeight: 1.2,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={skipClientRegister}
                    onChange={(e) => {
                      const on = e.target.checked
                      setSkipClientRegister(on)
                      setClientMenuOpen(false)
                      if (on) {
                        setFormData((prev) => ({
                          ...prev,
                          client_id: '',
                          client_name: clientQuery.trim(),
                        }))
                      } else {
                        setFormData((prev) => ({ ...prev, client_name: '' }))
                      }
                    }}
                  />
                  거래처 등록을 없이 입력하기
                </label>
              ) : null}
              {!skipClientRegister && !clientInputDisabled && formData.client_id && selectedClient ? (
                <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: '#059669' }}>
                  선택됨: <strong>{selectedClient.name}</strong>
                </p>
              ) : null}
              {!skipClientRegister && clientMenuOpen && !clientInputDisabled ? (
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: '100%',
                    zIndex: 20,
                    maxHeight: 220,
                    overflowY: 'auto',
                    background: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    boxShadow: '0 10px 28px rgba(0,0,0,0.12)',
                  }}
                >
                  {filteredClients.length === 0 ? (
                    <div style={{ padding: '10px 12px', fontSize: '0.8rem', color: '#9ca3af' }}>
                      검색 결과가 없습니다.
                    </div>
                  ) : (
                    filteredClients.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectClient({ id: c.id, name: c.name })}
                        style={{
                          display: 'block',
                          width: '100%',
                          textAlign: 'left',
                          padding: '9px 12px',
                          border: 'none',
                          borderBottom: '1px solid #f3f4f6',
                          background: formData.client_id === c.id ? '#eff6ff' : '#fff',
                          cursor: 'pointer',
                          fontSize: '0.88rem',
                          color: '#111827',
                        }}
                      >
                        {c.name}
                      </button>
                    ))
                  )}
                </div>
              ) : null}
            </div>

            {isVisitStyle ? (
              <div style={{ marginBottom: 16, position: 'relative' }}>
                <label
                  style={{
                    display: 'block',
                    marginBottom: 4,
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    color: 'var(--notion-sub-text)',
                  }}
                >
                  대상 기기
                </label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    value={machineQuery}
                    placeholder="모델명 직접 입력 또는 창고 재고 선택"
                    autoComplete="off"
                    onChange={(e) => {
                      const v = e.target.value
                      setMachineQuery(v)
                      setMachineMenuOpen(true)
                      if (
                        formData.inventory_id &&
                        selectedMachine &&
                        v.trim() !==
                          `${selectedMachine.model_name}${selectedMachine.serial_number ? ` (${selectedMachine.serial_number})` : ''}`
                      ) {
                        setFormData((prev) => ({
                          ...prev,
                          inventory_id: '',
                          machine_model: v.replace(/\s*\([^)]*\)\s*$/, '').trim(),
                        }))
                      } else if (!formData.inventory_id) {
                        setFormData((prev) => ({
                          ...prev,
                          machine_model: v.replace(/\s*\([^)]*\)\s*$/, '').trim(),
                        }))
                      }
                    }}
                    onFocus={() => {
                      if (machineBlurTimer.current) clearTimeout(machineBlurTimer.current)
                      setMachineMenuOpen(true)
                    }}
                    onBlur={() => {
                      machineBlurTimer.current = setTimeout(() => setMachineMenuOpen(false), 150)
                    }}
                    style={{ ...inputBoxStyle, flex: 1 }}
                  />
                  {formData.inventory_id || machineQuery ? (
                    <Button variant="secondary"
                      type="button"
                      onClick={clearMachine}>
                      지우기
                    </Button>
                  ) : null}
                </div>
                {formData.inventory_id && selectedMachine ? (
                  <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: '#059669' }}>
                    {selectedMachine.source === 'office' ? '창고 재고' : '거래처 기기'}:{' '}
                    <strong>{selectedMachine.model_name}</strong>
                    {selectedMachine.serial_number ? ` (${selectedMachine.serial_number})` : ''}
                  </p>
                ) : machineQuery.trim() ? (
                  <p style={{ margin: '6px 0 0', fontSize: '0.72rem', color: '#9ca3af' }}>
                    직접 입력 모델로 소모품이 연결됩니다.
                  </p>
                ) : (
                  <p style={{ margin: '6px 0 0', fontSize: '0.72rem', color: '#9ca3af' }}>
                    창고 재고를 선택하거나 모델명을 입력하세요.
                  </p>
                )}
                {machineMenuOpen ? (
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      top: '100%',
                      zIndex: 20,
                      maxHeight: 220,
                      overflowY: 'auto',
                      background: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: 8,
                      boxShadow: '0 10px 28px rgba(0,0,0,0.12)',
                    }}
                  >
                    {filteredMachines.length === 0 ? (
                      <div style={{ padding: '10px 12px', fontSize: '0.8rem', color: '#9ca3af' }}>
                        창고·거래처 목록에 같은 기기가 없습니다.
                        <br />
                        입력한 모델명 그대로 저장되며, 소모품 호환에 연결됩니다.
                      </div>
                    ) : (
                      filteredMachines.map((m) => (
                        <button
                          key={`${m.source}-${m.id}`}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => selectMachine(m)}
                          style={{
                            display: 'block',
                            width: '100%',
                            textAlign: 'left',
                            padding: '9px 12px',
                            border: 'none',
                            borderBottom: '1px solid #f3f4f6',
                            background: formData.inventory_id === m.id ? '#eff6ff' : '#fff',
                            cursor: 'pointer',
                            fontSize: '0.88rem',
                            color: '#111827',
                          }}
                        >
                          <span>{m.model_name}</span>
                          {m.serial_number ? (
                            <span style={{ color: '#6b7280' }}> ({m.serial_number})</span>
                          ) : null}
                          <span style={{ float: 'right', fontSize: '0.72rem', color: '#9ca3af' }}>
                            {m.source === 'office' ? '창고' : '거래처'}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
            ) : (
              <InputField
                label="대상 기기"
                as="select"
                value={formData.inventory_id}
                onChange={(e) => {
                  const id = e.target.value
                  const m = machines.find((x) => x.id === id)
                  setFormData({
                    ...formData,
                    inventory_id: id,
                    machine_model: m?.model_name || '',
                  })
                }}
                disabled={!formData.client_id}
              >
                <option value="">(기기 없음/일반 방문)</option>
                {machines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.model_name} ({m.serial_number})
                  </option>
                ))}
              </InputField>
            )}
          </div>

          <div className={styles.formGrid}>
            <InputField
              label="방문일자 *"
              type="date"
              value={formData.visit_date}
              onChange={(e) => setFormData({ ...formData, visit_date: e.target.value })}
            />
            <InputField
              label="구분 *"
              as="select"
              value={formData.service_type}
              onChange={(e) => setFormData({ ...formData, service_type: e.target.value })}
            >
              {serviceTypes.map((t) => (
                <option key={t} value={t}>
                  {t === 'A/S' ? 'A/S (수리)' : t === '배송' ? '단순 배송' : t}
                </option>
              ))}
            </InputField>
          </div>

          <div className={styles.formGrid}>
            <InputField
              label="상태 *"
              as="select"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            >
              <option value="접수">접수 (예정)</option>
              <option value="완료">완료 (처리됨)</option>
              <option value="보류">보류</option>
            </InputField>
            <InputField
              label="담당자 *"
              as="select"
              value={formData.manager_id}
              onChange={(e) => setFormData({ ...formData, manager_id: e.target.value })}
            >
              <option value="">직원 선택</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </InputField>
          </div>

          <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid #eee' }} />

          <InputField
            label="증상 / 요청사항"
            as="textarea"
            value={formData.symptom}
            onChange={(e) => setFormData({ ...formData, symptom: e.target.value })}
            style={{ height: '60px' }}
          />
          <InputField
            label="조치 내용"
            as="textarea"
            value={formData.action_detail}
            onChange={(e) => setFormData({ ...formData, action_detail: e.target.value })}
            style={{ height: '80px' }}
          />

          <div className={styles.formGrid}>
            <InputField
              label="확인 카운터 (흑백)"
              type="number"
              value={formData.meter_bw}
              onChange={(e) => setFormData({ ...formData, meter_bw: Number(e.target.value) })}
            />
            <InputField
              label="확인 카운터 (칼라)"
              type="number"
              value={formData.meter_col}
              onChange={(e) => setFormData({ ...formData, meter_col: Number(e.target.value) })}
            />
          </div>

          <div className={styles.formGrid}>
            <InputField
              label="현재 재고 (현장 여유 토너)"
              value={formData.spare_stock || ''}
              onChange={(e) => setFormData({
                ...formData,
                spare_stock: e.target.value,
                spare_stock_at: e.target.value
                  ? (formData.spare_stock_at || new Date().toISOString().split('T')[0])
                  : '',
              })}
              placeholder="예: K2 / C1 / M0 / Y1"
            />
            <InputField
              label="재고 기록일"
              type="date"
              value={formData.spare_stock_at || ''}
              onChange={(e) => setFormData({ ...formData, spare_stock_at: e.target.value })}
            />
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 8 }}>
              사용 부품/소모품 (자산·재고 연동)
              {machineModel ? (
                <span style={{ marginLeft: 8, fontWeight: 500, color: '#6b7280', fontSize: '0.8rem' }}>
                  · 모델: {machineModel}
                </span>
              ) : null}
            </div>
            <PartsUsagePicker
              consumables={consumables}
              usedParts={usedParts}
              onChange={setUsedParts}
              onConsumablesChange={setConsumables}
              machineModel={machineModel}
              productGroup={machineModel}
              status={formData.status}
              creditById={creditById}
              onSessionCreated={(id) => {
                sessionCreatedRef.current = [...sessionCreatedRef.current, id]
              }}
            />
            {formData.status === '완료' && usedParts.some((p) => p.consumable_id) && settings.service.showStockDeductHint && (
              <p style={{ fontSize: '0.75rem', color: '#b45309', marginTop: 8 }}>
                * 완료 저장 시 가용 재고는 즉시 차감되고, 부족한 수량은 미입고(가출고)로 남습니다.
                자산·재고에서 입고 확정하면 차감됩니다.
              </p>
            )}
            {formData.status !== '완료' && usedParts.some((p) => p.consumable_id) && settings.service.showStockDeductHint && (
              <p style={{ fontSize: '0.75rem', color: '#666', marginTop: 8 }}>
                * 접수/보류에서는 재고가 차감되지 않습니다. 완료로 바꾸면 가용분은 차감·부족분은 미입고 처리됩니다.
              </p>
            )}
          </div>

          <ServiceImages
            logId={editData?.id}
            pendingFiles={pendingImages}
            onPendingChange={setPendingImages}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '24px' }}>
            <Button variant="danger" onClick={handleCancel} type="button">취소</Button>
            <Button variant="primary" type="submit" disabled={loading}>
              {loading ? '저장 중…' : editData ? '수정완료' : '저장하기'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function normalizeEditKind(value: unknown, fallback: ServiceLogKind): ServiceLogKind {
  const v = String(value || fallback).toLowerCase()
  if (v === 'sales' || v === 'trip' || v === 'sales_trip') return 'sales_trip'
  if (v === 'short_rental' || v === 'short-rental' || v === 'shortrental') return 'short_rental'
  if (v === 'service') return 'service'
  return fallback
}
