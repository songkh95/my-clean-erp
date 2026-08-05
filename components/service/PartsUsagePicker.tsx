'use client'

import { useMemo, useState } from 'react'
import ConsumableForm, { type ConsumableFormPreset } from '@/components/inventory/ConsumableForm'
import { linkConsumableCompatibleModelAction } from '@/app/actions/consumable'
import {
  findTonerDrumAny,
  findTonerDrumConsumable,
  partsConsumables,
  type TonerDrumColor,
  type TonerDrumKind,
} from '@/utils/consumableMatch'
import styles from './PartsUsagePicker.module.css'

export type UsedPartRow = {
  consumable_id: string
  quantity: number
  max_stock: number
}

type ConsumableRow = {
  id: string
  category?: string | null
  model_name?: string | null
  current_stock?: number | null
  color?: string | null
  is_regenerated?: boolean | null
  compatible_models?: string[] | null
  product_group?: string | null
}

interface Props {
  consumables: ConsumableRow[]
  usedParts: UsedPartRow[]
  onChange: (next: UsedPartRow[]) => void
  onConsumablesChange?: (next: ConsumableRow[]) => void
  machineModel?: string | null
  productGroup?: string | null
  status?: string
  creditById?: Record<string, number>
  disabled?: boolean
  /** 이번 세션에서 재고 팝업으로 신규 등록한 품목 (취소 시 삭제 후보) */
  onSessionCreated?: (consumableId: string) => void
  onSessionLinked?: (pair: { consumable_id: string; machine_model: string }) => void
}

const COLORS: TonerDrumColor[] = ['K', 'C', 'M', 'Y']
const KINDS: TonerDrumKind[] = ['토너', '드럼']

function creditFor(creditById: Record<string, number> | undefined, id: string) {
  return creditById?.[id] || 0
}

export default function PartsUsagePicker({
  consumables,
  usedParts,
  onChange,
  onConsumablesChange,
  machineModel = null,
  productGroup = null,
  status = '접수',
  creditById,
  disabled = false,
  onSessionCreated,
  onSessionLinked,
}: Props) {
  const selectedMachine = machineModel || productGroup
  const [regen, setRegen] = useState<Record<string, boolean>>({})
  const [partId, setPartId] = useState('')
  const [partQty, setPartQty] = useState(1)
  const [registerOpen, setRegisterOpen] = useState(false)
  const [registerPreset, setRegisterPreset] = useState<ConsumableFormPreset | null>(null)
  const [pendingAdd, setPendingAdd] = useState<{
    kind?: TonerDrumKind
    color?: TonerDrumColor
    regenerated?: boolean
    asPart?: boolean
  } | null>(null)

  const partOptions = useMemo(
    () => partsConsumables(consumables, selectedMachine),
    [consumables, selectedMachine]
  )

  const regenKey = (kind: TonerDrumKind, color: TonerDrumColor) => `${kind}-${color}`

  const availableOf = (c: ConsumableRow | undefined) => {
    if (!c) return 0
    return (Number(c.current_stock) || 0) + creditFor(creditById, c.id)
  }

  const upsertQty = (consumable: ConsumableRow, addQty: number) => {
    const avail = availableOf(consumable)
    const idx = usedParts.findIndex((p) => p.consumable_id === consumable.id)
    if (idx >= 0) {
      const next = [...usedParts]
      const qty = next[idx].quantity + addQty
      next[idx] = {
        ...next[idx],
        quantity: Math.max(1, qty),
        max_stock: avail,
      }
      onChange(next)
      return
    }
    onChange([
      ...usedParts,
      {
        consumable_id: consumable.id,
        quantity: Math.max(1, addQty),
        max_stock: avail,
      },
    ])
  }

  const openRegister = (preset: ConsumableFormPreset, pending: typeof pendingAdd) => {
    setPendingAdd(pending)
    setRegisterPreset(preset)
    setRegisterOpen(true)
  }

  const handleColorClick = async (kind: TonerDrumKind, color: TonerDrumColor) => {
    if (disabled) return
    if (!selectedMachine) {
      alert('기기를 먼저 선택해 주세요. 호환 등록된 소모품 재고가 차감됩니다.')
      return
    }
    const regenerated = Boolean(regen[regenKey(kind, color)])
    const item = findTonerDrumConsumable(consumables, kind, color, regenerated, selectedMachine)

    if (item) {
      upsertQty(item, 1)
      return
    }

    // 동일 색상 품목은 있으나 이 기기 호환만 없음 → 연결할지, 새 품목 등록할지
    const anySame = findTonerDrumAny(consumables, kind, color, regenerated)
    if (anySame) {
      const linkExisting = confirm(
        `기존 「${anySame.model_name}」(재고 ${anySame.current_stock ?? 0})에\n` +
          `기기 ${selectedMachine} 호환을 추가할까요?\n\n` +
          `「확인」= 기존 품목에 호환 연결\n` +
          `「취소」= 품명이 다른 새 소모품으로 등록`
      )
      if (linkExisting) {
        const link = await linkConsumableCompatibleModelAction(anySame.id, selectedMachine)
        if (!link.success) {
          alert(link.message || '호환 연결 실패')
          return
        }
        const updated = {
          ...anySame,
          compatible_models: Array.from(
            new Set([...(anySame.compatible_models || []), selectedMachine])
          ),
        }
        onConsumablesChange?.([...consumables.filter((c) => c.id !== updated.id), updated])
        onSessionLinked?.({ consumable_id: updated.id, machine_model: selectedMachine })
        upsertQty(updated, 1)
        return
      }
      // 취소 → 아래 새 등록 팝업
    }

    // 새 소모품 등록 팝업 (품명이 다르면 색상이 같아도 별도 등록)
    openRegister(
      {
        category: kind,
        color,
        is_regenerated: regenerated,
        compatible_models: [selectedMachine],
        current_stock: 1,
      },
      { kind, color, regenerated }
    )
  }

  const handleRegistered = (saved?: any, linked?: boolean) => {
    if (!saved?.id) {
      setPendingAdd(null)
      return
    }
    const row: ConsumableRow = {
      ...saved,
      compatible_models: saved.compatible_models || registerPreset?.compatible_models || [],
    }
    const merged = [...consumables.filter((c) => c.id !== row.id), row]
    onConsumablesChange?.(merged)

    if (!linked) onSessionCreated?.(row.id)
    else if (selectedMachine) {
      onSessionLinked?.({ consumable_id: row.id, machine_model: selectedMachine })
    }

    if (pendingAdd?.asPart) {
      upsertQty(row, Math.max(1, partQty))
    } else if (pendingAdd?.kind && pendingAdd.color) {
      const target = findTonerDrumConsumable(
        merged,
        pendingAdd.kind,
        pendingAdd.color,
        Boolean(pendingAdd.regenerated),
        selectedMachine
      )
      upsertQty(target || row, 1)
    } else {
      upsertQty(row, 1)
    }
    setPendingAdd(null)
  }

  const addPart = () => {
    if (disabled || !partId) return
    const item = consumables.find((c) => c.id === partId)
    if (!item) return
    upsertQty(item, Math.max(1, partQty))
    setPartQty(1)
  }

  const registerPart = () => {
    if (disabled) return
    if (!selectedMachine) {
      alert('기기를 먼저 선택해 주세요.')
      return
    }
    openRegister(
      {
        category: '부품',
        compatible_models: [selectedMachine],
        current_stock: 1,
      },
      { asPart: true }
    )
  }

  const updateQty = (index: number, quantity: number) => {
    const next = [...usedParts]
    next[index] = { ...next[index], quantity: Math.max(0, quantity) }
    onChange(next.filter((p) => p.quantity > 0))
  }

  const removeRow = (index: number) => {
    onChange(usedParts.filter((_, i) => i !== index))
  }

  const nameOf = (id: string) => {
    const c = consumables.find((x) => x.id === id)
    if (!c) return id
    const meta = [c.category, c.color].filter(Boolean).join(' ')
    return meta ? `${c.model_name} (${meta})` : c.model_name || id
  }

  return (
    <div className={styles.wrap}>
      {selectedMachine ? (
        <p className={styles.hint} style={{ marginTop: 0 }}>
          기기 <strong>{selectedMachine}</strong> 호환 · 종류·색상 일치 품목만 차감됩니다.
          없으면 기존 동일 색상에 호환을 연결할지, 새 품목을 등록할지 선택할 수 있습니다.
        </p>
      ) : (
        <p className={styles.hint} style={{ marginTop: 0, color: '#b45309' }}>
          기기를 선택하면 호환 등록된 소모품 재고가 연동됩니다.
        </p>
      )}

      {KINDS.map((kind) => (
        <div key={kind} className={styles.section}>
          <div className={styles.sectionTitle}>{kind}</div>
          <div className={styles.grid}>
            {COLORS.map((color) => {
              const key = regenKey(kind, color)
              const regenerated = Boolean(regen[key])
              const item = findTonerDrumConsumable(
                consumables,
                kind,
                color,
                regenerated,
                selectedMachine
              )
              const stock = availableOf(item)
              return (
                <div key={key} className={styles.chip}>
                  <button
                    type="button"
                    className={styles.colorBtn}
                    disabled={disabled || !selectedMachine}
                    onClick={() => handleColorClick(kind, color)}
                    title={
                      item
                        ? `${item.model_name} (재고 ${stock})`
                        : selectedMachine
                          ? '호환 연결 또는 재고 등록'
                          : '기기 선택 필요'
                    }
                  >
                    <span className={styles.colorLabel}>{color}</span>
                    <span className={styles.stockLabel}>
                      {item ? `재고 ${stock}` : selectedMachine ? '등록/연결' : '기기선택'}
                    </span>
                  </button>
                  <label className={styles.regen}>
                    <input
                      type="checkbox"
                      checked={regenerated}
                      disabled={disabled || !selectedMachine}
                      onChange={(e) =>
                        setRegen((prev) => ({ ...prev, [key]: e.target.checked }))
                      }
                    />
                    재생
                  </label>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      <div className={styles.section}>
        <div className={styles.sectionTitle}>부품 추가</div>
        <div className={styles.partRow}>
          <select
            className={styles.select}
            value={partId}
            disabled={disabled || !selectedMachine}
            onChange={(e) => setPartId(e.target.value)}
          >
            <option value="">
              {selectedMachine ? '부품 선택 (호환 기기)' : '기기 선택 후 부품 선택'}
            </option>
            {partOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.model_name} (재고:{c.current_stock ?? 0})
              </option>
            ))}
          </select>
          <input
            className={styles.qty}
            type="number"
            min={1}
            value={partQty}
            disabled={disabled || !selectedMachine}
            onChange={(e) => setPartQty(Math.max(1, Number(e.target.value) || 1))}
          />
          <button
            type="button"
            className={styles.addBtn}
            disabled={disabled || !partId}
            onClick={addPart}
          >
            추가
          </button>
          <button
            type="button"
            className={styles.addBtn}
            disabled={disabled || !selectedMachine}
            onClick={registerPart}
            style={{ background: '#fff', color: '#1d4ed8', border: '1px solid #93c5fd' }}
          >
            부품 등록
          </button>
        </div>
        {selectedMachine && partOptions.length === 0 && (
          <p className={styles.hint}>
            호환 부품이 없습니다. 「부품 등록」으로 바로 추가할 수 있습니다.
          </p>
        )}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>선택 목록</div>
        {usedParts.length === 0 ? (
          <p className={styles.hint}>버튼을 눌러 토너/드럼을 추가하거나 부품을 선택하세요.</p>
        ) : (
          usedParts.map((row, idx) => {
            const over = status === '완료' && row.quantity > row.max_stock
            return (
              <div key={`${row.consumable_id}-${idx}`} className={styles.selectedRow}>
                <span className={styles.selectedName}>{nameOf(row.consumable_id)}</span>
                <input
                  className={styles.qty}
                  type="number"
                  min={1}
                  value={row.quantity}
                  disabled={disabled}
                  style={{ borderColor: over ? '#b45309' : undefined }}
                  onChange={(e) => updateQty(idx, Number(e.target.value) || 0)}
                />
                <span className={styles.avail} style={{ color: over ? '#b45309' : undefined }}>
                  {over ? `가용 ${row.max_stock} · 초과분은 미입고` : `가용 ${row.max_stock}`}
                </span>
                <button
                  type="button"
                  className={styles.removeBtn}
                  disabled={disabled}
                  onClick={() => removeRow(idx)}
                >
                  삭제
                </button>
              </div>
            )
          })
        )}
      </div>

      <p className={styles.hint}>
        「부품 저장」/일지 저장 시에만 반영됩니다. 재고가 부족하면 완료 시 미입고(가출고)로 남습니다.
      </p>

      <ConsumableForm
        isOpen={registerOpen}
        preset={registerPreset}
        defaultCategory={registerPreset?.category || '토너'}
        categoryOptions={['토너', '드럼', '현상기', '폐토너통', '용지', '부품', '롤러', '기어', 'Fuser', '기타']}
        onClose={() => {
          setRegisterOpen(false)
          setRegisterPreset(null)
          setPendingAdd(null)
        }}
        onSuccess={(saved) => {
          handleRegistered(saved, Boolean(saved?.__linked))
          setRegisterOpen(false)
          setRegisterPreset(null)
        }}
      />
    </div>
  )
}
