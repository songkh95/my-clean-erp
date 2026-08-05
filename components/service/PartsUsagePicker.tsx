'use client'

import { useMemo, useState } from 'react'
import {
  ensureTonerDrumConsumableAction,
} from '@/app/actions/service'
import {
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
}

interface Props {
  consumables: ConsumableRow[]
  usedParts: UsedPartRow[]
  onChange: (next: UsedPartRow[]) => void
  onConsumablesChange?: (next: ConsumableRow[]) => void
  /** 완료 상태면 재고 초과 경고 강조 */
  status?: string
  /** 완료 건 수정 시 기존 사용분 가용 가산 */
  creditById?: Record<string, number>
  disabled?: boolean
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
  status = '접수',
  creditById,
  disabled = false,
}: Props) {
  const [regen, setRegen] = useState<Record<string, boolean>>({})
  const [partId, setPartId] = useState('')
  const [partQty, setPartQty] = useState(1)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const partOptions = useMemo(() => partsConsumables(consumables), [consumables])

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

  const handleColorClick = async (kind: TonerDrumKind, color: TonerDrumColor) => {
    if (disabled) return
    const key = regenKey(kind, color)
    const regenerated = Boolean(regen[key])
    setBusyKey(key)

    try {
      let item = findTonerDrumConsumable(consumables, kind, color, regenerated)
      if (!item) {
        const res = await ensureTonerDrumConsumableAction({
          category: kind,
          color,
          is_regenerated: regenerated,
        })
        if (!res.success || !res.data) {
          alert(res.message || '소모품을 준비하지 못했습니다.')
          return
        }
        item = res.data
        const merged = [...consumables.filter((c) => c.id !== item!.id), item]
        onConsumablesChange?.(merged)
        if (res.created) {
          alert(
            `${item.model_name} 품목을 재고 0으로 새로 등록했습니다.\n자산·재고에서 수량을 채워 주세요.`
          )
        }
      }

      const avail = availableOf(item)
      // 재고 0이어도 가출고(미입고)로 추가 가능
      if (status === '완료' && avail <= 0) {
        // 안내만 하고 진행
      }
      upsertQty(item, 1)
    } finally {
      setBusyKey(null)
    }
  }

  const addPart = () => {
    if (disabled || !partId) return
    const item = consumables.find((c) => c.id === partId)
    if (!item) return
    upsertQty(item, Math.max(1, partQty))
    setPartQty(1)
  }

  const updateQty = (index: number, quantity: number) => {
    const next = [...usedParts]
    next[index] = { ...next[index], quantity: Math.max(0, quantity) }
    onChange(next.filter((p) => p.quantity > 0))
  }

  const removeRow = (index: number) => {
    onChange(usedParts.filter((_, i) => i !== index))
  }

  const nameOf = (id: string) =>
    consumables.find((c) => c.id === id)?.model_name || id

  return (
    <div className={styles.wrap}>
      {KINDS.map((kind) => (
        <div key={kind} className={styles.section}>
          <div className={styles.sectionTitle}>{kind}</div>
          <div className={styles.grid}>
            {COLORS.map((color) => {
              const key = regenKey(kind, color)
              const regenerated = Boolean(regen[key])
              const item = findTonerDrumConsumable(consumables, kind, color, regenerated)
              const stock = availableOf(item)
              const busy = busyKey === key
              return (
                <div key={key} className={styles.chip}>
                  <button
                    type="button"
                    className={styles.colorBtn}
                    disabled={disabled || busy}
                    onClick={() => handleColorClick(kind, color)}
                    title={item ? `${item.model_name} (재고 ${stock})` : '클릭 시 품목 준비 후 추가'}
                  >
                    <span className={styles.colorLabel}>{color}</span>
                    <span className={styles.stockLabel}>
                      {item ? `재고 ${stock}` : '미등록'}
                    </span>
                  </button>
                  <label className={styles.regen}>
                    <input
                      type="checkbox"
                      checked={regenerated}
                      disabled={disabled}
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
            disabled={disabled}
            onChange={(e) => setPartId(e.target.value)}
          >
            <option value="">부품 선택 (자산·재고 연동)</option>
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
            disabled={disabled}
            onChange={(e) => setPartQty(Math.max(1, Number(e.target.value) || 1))}
          />
          <button type="button" className={styles.addBtn} disabled={disabled || !partId} onClick={addPart}>
            추가
          </button>
        </div>
        {partOptions.length === 0 && (
          <p className={styles.hint}>등록된 부품이 없습니다. 자산·재고 &gt; 부품에서 먼저 등록하세요.</p>
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
        재고가 부족하거나 0이어도 선택할 수 있습니다. 완료 저장 시 가용분은 즉시 차감되고,
        부족한 수량은 <strong>미입고(가출고)</strong>로 남으며 자산·재고에서 입고 확정 후 차감됩니다.
      </p>
    </div>
  )
}
