'use client'

import { useMemo, useState } from 'react'
import ConsumableForm, { type ConsumableFormPreset } from '@/components/inventory/ConsumableForm'
import ConsumableStockPickModal, {
  type StockPickItem,
} from '@/components/service/ConsumableStockPickModal'
import { linkConsumableCompatibleModelAction } from '@/app/actions/consumable'
import {
  findTonerDrumConsumable,
  isPartsCategory,
  listOtherConsumableCandidates,
  listTonerDrumCandidates,
  otherConsumables,
  partsConsumables,
  standardConsumableName,
  TONER_DRUM_COLORS,
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
  code?: string | null
  current_stock?: number | null
  color?: string | null
  is_regenerated?: boolean | null
  compatible_models?: string[] | null
  product_group?: string | null
  is_active?: boolean | null
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
  onSessionCreated?: (consumableId: string) => void
  onSessionLinked?: (pair: { consumable_id: string; machine_model: string }) => void
}

const COLORS: TonerDrumColor[] = TONER_DRUM_COLORS
const KINDS: TonerDrumKind[] = ['토너', '드럼']

function creditFor(creditById: Record<string, number> | undefined, id: string) {
  return creditById?.[id] || 0
}

type MissingChoice = {
  kind?: TonerDrumKind
  color?: TonerDrumColor
  regenerated?: boolean
  asPart?: boolean
  /** 폐토너통·현상기·용지 등 */
  asOther?: boolean
  otherCategory?: string
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
    asOther?: boolean
  } | null>(null)
  const [missingChoice, setMissingChoice] = useState<MissingChoice | null>(null)
  const [pickOpen, setPickOpen] = useState(false)
  const [pickContext, setPickContext] = useState<MissingChoice | null>(null)
  const [otherId, setOtherId] = useState('')
  const [otherQty, setOtherQty] = useState(1)

  const partOptions = useMemo(
    () => partsConsumables(consumables, selectedMachine),
    [consumables, selectedMachine]
  )

  const otherOptions = useMemo(
    () => otherConsumables(consumables, selectedMachine),
    [consumables, selectedMachine]
  )

  const pickItems: StockPickItem[] = useMemo(() => {
    if (!pickContext) return []
    if (pickContext.asPart) {
      return consumables.filter((c) => isPartsCategory(c.category || '')) as StockPickItem[]
    }
    if (pickContext.asOther) {
      return listOtherConsumableCandidates(consumables) as StockPickItem[]
    }
    if (pickContext.kind && pickContext.color) {
      return listTonerDrumCandidates(
        consumables,
        pickContext.kind,
        pickContext.color,
        Boolean(pickContext.regenerated)
      ) as StockPickItem[]
    }
    return []
  }, [consumables, pickContext])

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

  const openMissingFlow = (ctx: MissingChoice) => {
    setMissingChoice(ctx)
  }

  const startPickFromStock = (ctx: MissingChoice) => {
    setMissingChoice(null)
    setPickContext(ctx)
    setPickOpen(true)
  }

  const startNewRegister = (ctx: MissingChoice) => {
    setMissingChoice(null)
    if (!selectedMachine) return
    if (ctx.asPart) {
      openRegister(
        {
          category: '부품',
          compatible_models: [selectedMachine],
          current_stock: 0,
        },
        { asPart: true }
      )
      return
    }
    if (ctx.asOther) {
      openRegister(
        {
          category: ctx.otherCategory || '폐토너통',
          compatible_models: [selectedMachine],
          current_stock: 0,
        },
        { asOther: true }
      )
      return
    }
    if (!ctx.kind || !ctx.color) return
    const stdName = standardConsumableName(ctx.kind, ctx.color, Boolean(ctx.regenerated))
    const autoCode = `${ctx.kind}-${ctx.color}${ctx.regenerated ? '-R' : ''}`
    openRegister(
      {
        category: ctx.kind,
        color: ctx.color,
        is_regenerated: Boolean(ctx.regenerated),
        compatible_models: [selectedMachine],
        model_name: stdName,
        code: autoCode,
        current_stock: 0,
        unit_price: 0,
      },
      { kind: ctx.kind, color: ctx.color, regenerated: ctx.regenerated }
    )
  }

  const handleColorClick = (kind: TonerDrumKind, color: TonerDrumColor) => {
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

    openMissingFlow({ kind, color, regenerated })
  }

  const applyPickedStock = async (selected: StockPickItem[]) => {
    if (!selectedMachine) return
    let nextConsumables = [...consumables]
    let nextUsed = [...usedParts]

    const upsertLocal = (consumable: ConsumableRow, addQty: number) => {
      const avail =
        (Number(consumable.current_stock) || 0) + creditFor(creditById, consumable.id)
      const idx = nextUsed.findIndex((p) => p.consumable_id === consumable.id)
      if (idx >= 0) {
        const qty = nextUsed[idx].quantity + addQty
        nextUsed[idx] = {
          ...nextUsed[idx],
          quantity: Math.max(1, qty),
          max_stock: avail,
        }
        return
      }
      nextUsed.push({
        consumable_id: consumable.id,
        quantity: Math.max(1, addQty),
        max_stock: avail,
      })
    }

    for (const raw of selected) {
      const link = await linkConsumableCompatibleModelAction(raw.id, selectedMachine)
      if (!link.success) {
        alert(link.message || `「${raw.model_name}」호환 연결 실패`)
        continue
      }
      const updated: ConsumableRow = {
        ...raw,
        compatible_models: Array.from(
          new Set([...(raw.compatible_models || []), selectedMachine])
        ),
      }
      nextConsumables = [...nextConsumables.filter((c) => c.id !== updated.id), updated]
      onSessionLinked?.({ consumable_id: updated.id, machine_model: selectedMachine })
      upsertLocal(updated, 1)
    }

    onConsumablesChange?.(nextConsumables)
    onChange(nextUsed)
    setPickOpen(false)
    setPickContext(null)
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
    } else if (pendingAdd?.asOther) {
      upsertQty(row, Math.max(1, otherQty))
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

  const addOther = () => {
    if (disabled || !otherId) return
    const item = consumables.find((c) => c.id === otherId)
    if (!item) return
    upsertQty(item, Math.max(1, otherQty))
    setOtherQty(1)
  }

  const registerPart = () => {
    if (disabled) return
    if (!selectedMachine) {
      alert('기기를 먼저 선택해 주세요.')
      return
    }
    openMissingFlow({ asPart: true })
  }

  const registerOther = () => {
    if (disabled) return
    if (!selectedMachine) {
      alert('기기를 먼저 선택해 주세요.')
      return
    }
    openMissingFlow({ asOther: true, otherCategory: '폐토너통' })
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

  const missingLabel = missingChoice?.asPart
    ? '부품'
    : missingChoice?.asOther
      ? '폐토너통·현상기·용지 등'
      : missingChoice?.kind && missingChoice?.color
        ? `${missingChoice.kind} ${missingChoice.color}${missingChoice.regenerated ? ' 재생' : ''}`
        : '소모품'

  return (
    <div className={styles.wrap}>
      {selectedMachine ? (
        <p className={styles.hint} style={{ marginTop: 0 }}>
          기기 <strong>{selectedMachine}</strong> 호환 품목만 바로 차감됩니다.
          없으면 <strong>기존 재고에서 선택(호환 추가)</strong>하거나 <strong>새로 등록</strong>하세요.
        </p>
      ) : (
        <p className={styles.hint} style={{ marginTop: 0, color: '#b45309' }}>
          일지에 대상 기기(모델)가 있어야 호환 소모품·부품을 등록/선택할 수 있습니다.
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
                          ? '기존 재고 선택 또는 새 등록'
                          : '기기 선택 필요'
                    }
                  >
                    <span className={styles.colorLabel}>{color}</span>
                    <span className={styles.stockLabel}>
                      {item ? `재고 ${stock}` : selectedMachine ? '선택·등록' : '기기선택'}
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
            부품 선택·등록
          </button>
        </div>
        {selectedMachine && partOptions.length === 0 && (
          <p className={styles.hint}>
            이 기기 호환 부품이 없습니다. 「부품 선택·등록」에서 기존 재고를 고르거나 새로 등록하세요.
          </p>
        )}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>폐토너통 · 현상기 · 용지 등</div>
        <div className={styles.partRow}>
          <select
            className={styles.select}
            value={otherId}
            disabled={disabled || !selectedMachine}
            onChange={(e) => setOtherId(e.target.value)}
          >
            <option value="">
              {selectedMachine
                ? '호환 소모품 선택 (폐토너통 등)'
                : '기기 선택 후 소모품 선택'}
            </option>
            {otherOptions.map((c) => (
              <option key={c.id} value={c.id}>
                [{c.category}] {c.model_name} (재고:{c.current_stock ?? 0})
              </option>
            ))}
          </select>
          <input
            className={styles.qty}
            type="number"
            min={1}
            value={otherQty}
            disabled={disabled || !selectedMachine}
            onChange={(e) => setOtherQty(Math.max(1, Number(e.target.value) || 1))}
          />
          <button
            type="button"
            className={styles.addBtn}
            disabled={disabled || !otherId}
            onClick={addOther}
          >
            추가
          </button>
          <button
            type="button"
            className={styles.addBtn}
            disabled={disabled || !selectedMachine}
            onClick={registerOther}
            style={{ background: '#fff', color: '#1d4ed8', border: '1px solid #93c5fd' }}
          >
            기존 재고·등록
          </button>
        </div>
        {selectedMachine && otherOptions.length === 0 && (
          <p className={styles.hint}>
            이 기기 호환 폐토너통·현상기·용지가 없습니다. 「기존 재고·등록」에서 재고를 고르거나 새로 등록하세요.
          </p>
        )}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>선택 목록</div>
        {usedParts.length === 0 ? (
          <p className={styles.hint}>토너/드럼·부품·폐토너통 등을 추가하세요.</p>
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

      {missingChoice && selectedMachine ? (
        <div className={styles.modalOverlayLocal}>
          <div className={styles.choiceCard}>
            <h3 className={styles.choiceTitle}>
              이 기기 호환 「{missingLabel}」 재고가 없습니다
            </h3>
            <p className={styles.choiceDesc}>
              기기 <strong>{selectedMachine}</strong> · 기존 재고를 골라 호환을 추가하거나, 새로 등록하세요.
            </p>
            <div className={styles.choiceActions}>
              <button
                type="button"
                className={styles.choicePrimary}
                onClick={() => startPickFromStock(missingChoice)}
              >
                기존 재고에서 선택
              </button>
              <button
                type="button"
                className={styles.choiceSecondary}
                onClick={() => startNewRegister(missingChoice)}
              >
                새로 등록
              </button>
              <button
                type="button"
                className={styles.choiceGhost}
                onClick={() => setMissingChoice(null)}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConsumableStockPickModal
        isOpen={pickOpen}
        title={
          pickContext?.asOther
            ? '기존 재고에서 선택 (폐토너통·현상기·용지 등)'
            : pickContext?.asPart
              ? '기존 재고에서 선택 (부품)'
              : '기존 재고에서 선택'
        }
        machineModel={selectedMachine || ''}
        items={pickItems}
        onClose={() => {
          setPickOpen(false)
          setPickContext(null)
        }}
        onConfirm={applyPickedStock}
      />

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
