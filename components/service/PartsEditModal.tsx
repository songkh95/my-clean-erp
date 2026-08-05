'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Button from '@/components/ui/Button'
import PartsUsagePicker, { type UsedPartRow } from '@/components/service/PartsUsagePicker'
import {
  getConsumablesAction,
  updateServicePartsAction,
} from '@/app/actions/service'
import {
  rollbackDraftConsumablesAction,
} from '@/app/actions/consumable'
import { ServiceLog } from '@/app/types'
import styles from '@/app/service/service.module.css'
import { toMachineModelName } from '@/utils/suggestMatch'

interface Props {
  isOpen: boolean
  log: ServiceLog | null
  locked?: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function PartsEditModal({ isOpen, log, locked = false, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false)
  const [consumables, setConsumables] = useState<any[]>([])
  const [usedParts, setUsedParts] = useState<UsedPartRow[]>([])
  const sessionCreatedRef = useRef<string[]>([])
  const sessionLinkedRef = useRef<{ consumable_id: string; machine_model: string }[]>([])
  const savedRef = useRef(false)

  const creditById = useMemo(() => {
    const map: Record<string, number> = {}
    if (log?.status !== '완료' || !log.parts_usage) return map
    for (const p of log.parts_usage) {
      const id = p.consumable?.id || p.consumable_id
      if (!id) continue
      if (p.stock_status === 'pending' || p.stock_status === 'none') continue
      map[id] = (map[id] || 0) + (Number(p.quantity) || 0)
    }
    return map
  }, [log])

  const machineModel = useMemo(() => {
    const name = log?.inventory?.model_name || ''
    return toMachineModelName(String(name)).trim() || null
  }, [log?.inventory?.model_name])

  useEffect(() => {
    if (!isOpen || !log) return
    savedRef.current = false
    sessionCreatedRef.current = []
    sessionLinkedRef.current = []

    const load = async () => {
      const list = await getConsumablesAction()
      setConsumables(list)

      const wasDone = log.status === '완료'
      const parts = (log.parts_usage || []).map((p: any) => {
        const current = Number(p.consumable?.current_stock) || 0
        const prevQty = Number(p.quantity) || 0
        const credited = wasDone && p.stock_status !== 'pending' && p.stock_status !== 'none'
        return {
          consumable_id: p.consumable?.id || p.consumable_id,
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
    }
    load()
  }, [isOpen, log])

  const handleCancel = async () => {
    if (!savedRef.current) {
      const created = [...sessionCreatedRef.current]
      const linked = [...sessionLinkedRef.current]
      if (created.length > 0) {
        const remove = confirm(
          `이번 화면에서 새로 등록한 소모품 ${created.length}건이 있습니다.\n` +
            `일지에 저장하지 않고 닫습니다. 방금 등록한 소모품도 삭제할까요?\n\n` +
            `「확인」= 소모품도 삭제 · 「취소」= 소모품은 재고에 남김`
        )
        if (remove) await rollbackDraftConsumablesAction(created)
      }
    }
    onClose()
  }

  const handleSave = async () => {
    if (!log || locked) return
    setLoading(true)
    const payload = usedParts
      .filter((p) => p.consumable_id && p.quantity > 0)
      .map((p) => ({ consumable_id: p.consumable_id, quantity: Number(p.quantity) }))

    const res = await updateServicePartsAction(log.id, payload)
    setLoading(false)
    if (!res.success) {
      alert(res.message || '저장 실패')
      return
    }
    savedRef.current = true
    sessionCreatedRef.current = []
    sessionLinkedRef.current = []
    alert(res.message)
    onSuccess()
    onClose()
  }

  if (!isOpen || !log) return null

  return (
    <div className={styles.modalOverlay} onClick={handleCancel}>
      <div
        className={styles.modal}
        style={{ width: 720, maxWidth: '94vw' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 6 }}>
          교체 / 배송 · 소모품
        </h2>
        <p style={{ margin: '0 0 14px', fontSize: '0.78rem', color: '#6b7280' }}>
          {log.client?.name || '거래처'}
          {log.inventory ? ` · ${log.inventory.model_name} (${log.inventory.serial_number})` : ''}
          {' · '}상태: {log.status}
          {' — 「부품 저장」을 눌러야 일지에 반영됩니다.'}
        </p>

        <PartsUsagePicker
          consumables={consumables}
          usedParts={usedParts}
          onChange={setUsedParts}
          onConsumablesChange={setConsumables}
          machineModel={machineModel}
          status={log.status}
          creditById={creditById}
          disabled={locked}
          onSessionCreated={(id) => {
            sessionCreatedRef.current = [...sessionCreatedRef.current, id]
          }}
          onSessionLinked={(pair) => {
            sessionLinkedRef.current = [...sessionLinkedRef.current, pair]
          }}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <Button variant="ghost" type="button" onClick={handleCancel}>취소</Button>
          <Button variant="primary" type="button" disabled={locked || loading} onClick={handleSave}>
            {loading ? '저장 중…' : '부품 저장'}
          </Button>
        </div>
      </div>
    </div>
  )
}
