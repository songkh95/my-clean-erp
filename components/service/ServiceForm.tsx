'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
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
  getConsumablesAction,
  createServiceLogAction,
  updateServiceLogAction,
  getEmployeesAction,
} from '@/app/actions/service'
import { rollbackDraftConsumablesAction } from '@/app/actions/consumable'
import { loadAppSettings } from '@/utils/appSettings'
import { useAppSettings } from '@/hooks/useAppSettings'
import { toMachineModelName } from '@/utils/suggestMatch'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  editData?: any
}

function buildInitialServiceForm() {
  const s = loadAppSettings().service
  return {
    client_id: '',
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

export default function ServiceForm({ isOpen, onClose, onSuccess, editData }: Props) {
  const { settings } = useAppSettings()
  const [loading, setLoading] = useState(false)
  const [clients, setClients] = useState<any[]>([])
  const [machines, setMachines] = useState<any[]>([])
  const [consumables, setConsumables] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [formData, setFormData] = useState(buildInitialServiceForm)
  const [usedParts, setUsedParts] = useState<UsedPartRow[]>([])
  const [pendingImages, setPendingImages] = useState<LocalFile[]>([])
  const sessionCreatedRef = useRef<string[]>([])
  const savedRef = useRef(false)

  const supabase = createClient()
  const serviceTypes = settings.service.serviceTypes.length > 0
    ? settings.service.serviceTypes
    : ['A/S', '정기점검', '설치', '철수', '배송']

  const creditById = useMemo(() => {
    const map: Record<string, number> = {}
    if (editData?.status !== '완료' || !editData?.parts_usage) return map
    for (const p of editData.parts_usage as any[]) {
      const id = p.consumable?.id
      if (!id) continue
      // 이미 차감된 분만 가용 가산 (미입고는 아직 차감 안 됨)
      if (p.stock_status === 'pending' || p.stock_status === 'none') continue
      map[id] = (map[id] || 0) + (Number(p.quantity) || 0)
    }
    return map
  }, [editData])

  const productGroup = useMemo(() => {
    const m = machines.find((x) => x.id === formData.inventory_id)
    const name = m?.model_name || editData?.inventory?.model_name || ''
    return toMachineModelName(String(name)).trim() || null
  }, [machines, formData.inventory_id, editData?.inventory?.model_name])

  const machineModel = productGroup

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

      setPendingImages([])

      if (editData) {
        setFormData({
          client_id: editData.client_id || '',
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
          // 동일 소모품 행 합치기 (deducted+pending 분리 저장 대응)
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
        setFormData(buildInitialServiceForm())
        setUsedParts([])
      }
    }
    loadData()
  }, [isOpen, editData])

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
    if (!formData.client_id) return alert('거래처를 선택해주세요.')
    if (!formData.manager_id) return alert('담당자를 선택해주세요.')
    if (!validatePartsForSubmit()) return

    setLoading(true)

    const payloadParts = usedParts
      .filter((p) => p.consumable_id)
      .map((p) => ({ consumable_id: p.consumable_id, quantity: Number(p.quantity) }))

    let result: any
    if (editData) {
      result = await updateServiceLogAction(editData.id, formData, payloadParts)
    } else {
      result = await createServiceLogAction(formData, payloadParts)
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

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal} style={{ width: 760, maxWidth: '100%' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '20px' }}>
          {editData ? '서비스 일지 수정' : '서비스 일지 작성'}
        </h2>

        <form onSubmit={handleSubmit}>
          <div className={styles.formGrid}>
            <InputField
              label="거래처 *"
              as="select"
              value={formData.client_id}
              onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
              disabled={!!editData}
            >
              <option value="">거래처 선택</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </InputField>

            <InputField
              label="대상 기기"
              as="select"
              value={formData.inventory_id}
              onChange={(e) => setFormData({ ...formData, inventory_id: e.target.value })}
              disabled={!formData.client_id}
            >
              <option value="">(기기 없음/일반 방문)</option>
              {machines.map((m) => (
                <option key={m.id} value={m.id}>{m.model_name} ({m.serial_number})</option>
              ))}
            </InputField>
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
            </div>
            <PartsUsagePicker
              consumables={consumables}
              usedParts={usedParts}
              onChange={setUsedParts}
              onConsumablesChange={setConsumables}
              machineModel={machineModel}
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
            <Button variant="ghost" onClick={handleCancel} type="button">취소</Button>
            <Button variant="primary" type="submit" disabled={loading}>
              {loading ? '저장 중…' : editData ? '수정완료' : '저장하기'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
