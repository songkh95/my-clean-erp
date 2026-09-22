'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Button from '../ui/Button'
import InputField from '../ui/Input'
import SuggestInput from '../ui/SuggestInput'
import styles from './InventoryForm.module.css'
import {
  upsertConsumableAction,
  getConsumablesAction,
  getMachineModelOptionsAction,
} from '@/app/actions/consumable'
import { listProductGroupsAction, type ProductGroupRow } from '@/app/actions/productGroups'
import { toMachineModelName, toManagementCode, toConsumableModelName } from '@/utils/suggestMatch'
import {
  standardConsumableName,
  TONER_DRUM_COLORS,
  type TonerDrumColor,
} from '@/utils/consumableMatch'
import ProductGroupManager from './ProductGroupManager'

export type ConsumableFormPreset = {
  category?: string
  color?: TonerDrumColor | ''
  is_regenerated?: boolean
  compatible_models?: string[]
  model_name?: string
  code?: string
  current_stock?: number
  unit_price?: number
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: (saved?: any) => void
  editData?: any
  defaultCategory?: string
  categoryOptions?: string[]
  /** 일지 등에서 바로 등록할 때 초기값 */
  preset?: ConsumableFormPreset | null
}

const COLORS: Array<TonerDrumColor | ''> = ['', ...TONER_DRUM_COLORS]
const STANDARD_NAME_RE = /^(토너|드럼) (KCMY|[KCMY])( 재생)?$/

export default function ConsumableForm({
  isOpen,
  onClose,
  onSuccess,
  editData,
  defaultCategory,
  categoryOptions,
  preset = null,
}: Props) {
  const [loading, setLoading] = useState(false)
  const categories = categoryOptions && categoryOptions.length > 0
    ? categoryOptions
    : ['토너', '드럼', '현상기', '폐토너통', '용지', '부품', '롤러', '기어', 'Fuser', '기타']
  const [formData, setFormData] = useState({
    id: '',
    category: defaultCategory || categories[0] || '토너',
    model_name: '',
    code: '',
    current_stock: 0,
    unit_price: 0,
    color: '' as TonerDrumColor | '',
    is_regenerated: false,
  })
  const [compatibleModels, setCompatibleModels] = useState<string[]>([])
  const [productGroup, setProductGroup] = useState('')
  const [productGroups, setProductGroups] = useState<ProductGroupRow[]>([])
  const [groupManagerOpen, setGroupManagerOpen] = useState(false)
  const [machineDraft, setMachineDraft] = useState('')
  const [nameSuggestions, setNameSuggestions] = useState<Array<{ value: string; hint?: string }>>([])
  const [codeSuggestions, setCodeSuggestions] = useState<Array<{ value: string; hint?: string }>>([])
  const [machineSuggestions, setMachineSuggestions] = useState<Array<{ value: string; hint?: string }>>([])

  const showColorFields = formData.category === '토너' || formData.category === '드럼'

  const reloadProductGroups = async (): Promise<ProductGroupRow[]> => {
    const res = await listProductGroupsAction()
    const rows = res.data || []
    setProductGroups(rows)
    return rows
  }

  /** 제품군 선택 = 호환 기기 목록을 제품군 기기로 통째로 교체 */
  const applyProductGroup = (groupName: string, groups: ProductGroupRow[] = productGroups) => {
    const name = groupName.trim()
    setProductGroup(name)
    if (!name) return
    const found = groups.find((g) => g.name === name)
    const models = Array.from(
      new Set(
        (found?.machine_models || [])
          .map((m) => toMachineModelName(String(m)).trim())
          .filter(Boolean)
      )
    )
    setCompatibleModels(models)
  }

  const clearProductGroupSelection = () => {
    setProductGroup('')
  }

  useEffect(() => {
    if (!isOpen) return

    if (editData) {
      setFormData({
        id: editData.id || '',
        category: editData.category || defaultCategory || categories[0] || '토너',
        model_name: editData.model_name || '',
        code: editData.code || '',
        current_stock: Number(editData.current_stock) || 0,
        unit_price: Number(editData.unit_price) || 0,
        color: (editData.color as TonerDrumColor) || '',
        is_regenerated: Boolean(editData.is_regenerated),
      })
      const models: string[] = Array.isArray(editData.compatible_models)
        ? editData.compatible_models
        : editData.product_group
          ? [editData.product_group]
          : []
      setCompatibleModels(
        Array.from(new Set(models.map((m) => toMachineModelName(String(m)).trim()).filter(Boolean)))
      )
      setProductGroup(String(editData.product_group || '').trim())
    } else {
      const cat = preset?.category || defaultCategory || categories[0] || '토너'
      const color = (preset?.color || '') as TonerDrumColor | ''
      const regen = Boolean(preset?.is_regenerated)
      const defaultName =
        preset?.model_name ||
        (color && (cat === '토너' || cat === '드럼')
          ? standardConsumableName(cat as '토너' | '드럼', color, regen)
          : '')
      const defaultCode =
        preset?.code ||
        (color && (cat === '토너' || cat === '드럼')
          ? `${cat}-${color}${regen ? '-R' : ''}`
          : '')
      setFormData({
        id: '',
        category: cat,
        model_name: defaultName,
        code: defaultCode,
        current_stock: preset?.current_stock ?? 0,
        unit_price: preset?.unit_price ?? 0,
        color,
        is_regenerated: regen,
      })
      setCompatibleModels(
        Array.from(
          new Set(
            (preset?.compatible_models || [])
              .map((m) => toMachineModelName(String(m)).trim())
              .filter(Boolean)
          )
        )
      )
      setProductGroup('')
    }
    setMachineDraft('')

    void reloadProductGroups().then((rows) => {
      // 수정 화면: 제품군이 있으면 호환기기를 제품군 기준으로 다시 맞춤
      const pg = editData ? String(editData.product_group || '').trim() : ''
      if (pg && rows.some((g) => g.name === pg)) {
        applyProductGroup(pg, rows)
      }
    })

    getConsumablesAction().then((res) => {
      if (!res.success || !res.data) return
      setNameSuggestions(
        res.data.map((c: any) => ({
          value: c.model_name,
          hint: [
            (c.compatible_models || []).slice(0, 3).join(', '),
            c.category,
            c.color,
            c.code,
          ].filter(Boolean).join(' · ') || undefined,
        }))
      )
      setCodeSuggestions(
        res.data
          .filter((c: any) => c.code)
          .map((c: any) => ({
            value: c.code,
            hint: c.model_name,
          }))
      )
    })

    getMachineModelOptionsAction().then((models) => {
      setMachineSuggestions(models.map((g) => ({ value: g, hint: '기기 모델' })))
    })
  }, [editData, defaultCategory, isOpen, preset])

  const addCompatibleModel = (raw?: string) => {
    const m = toMachineModelName(raw ?? machineDraft).trim()
    if (!m) return
    setCompatibleModels((prev) => (prev.includes(m) ? prev : [...prev, m]))
    setMachineDraft('')
    // 직접 추가하면 제품군 일괄 지정 상태를 해제 (수동 편집)
    clearProductGroupSelection()
  }

  const removeCompatibleModel = (m: string) => {
    setCompatibleModels((prev) => prev.filter((x) => x !== m))
    clearProductGroupSelection()
  }

  const applyColorMeta = (next: Partial<typeof formData>) => {
    const merged = { ...formData, ...next }
    // 품명이 비어 있거나 표준명일 때만 자동 채움
    if (
      (merged.category === '토너' || merged.category === '드럼') &&
      merged.color &&
      (!merged.model_name.trim() || STANDARD_NAME_RE.test(merged.model_name.trim()))
    ) {
      merged.model_name = toConsumableModelName(
        standardConsumableName(
          merged.category as '토너' | '드럼',
          merged.color as TonerDrumColor,
          merged.is_regenerated
        )
      )
    }
    setFormData(merged)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.model_name.trim()) return alert('모델명(품명)을 입력해주세요.')
    if (compatibleModels.length === 0) {
      if (productGroup) {
        return alert(
          `제품군 「${productGroup}」에 등록된 호환 기기가 없습니다.\n` +
            `「제품군 정리/등록」에서 기기를 넣거나, 아래에서 기기를 직접 추가해 주세요.`
        )
      }
      return alert('호환 기기를 1개 이상 추가하거나 제품군을 선택해 주세요.')
    }
    if (showColorFields && !formData.color) {
      return alert('토너/드럼은 색상(K/C/M/Y/KCMY)을 선택해주세요.')
    }
    setLoading(true)

    const payload: any = {
      ...formData,
      color: showColorFields && formData.color ? formData.color : null,
      is_regenerated: showColorFields ? formData.is_regenerated : false,
      compatible_models: compatibleModels,
      product_group: productGroup || null,
    }
    if (!payload.id) delete payload.id

    const res = await upsertConsumableAction(payload)

    if (res.success) {
      if (res.message) alert(res.message)
      onSuccess({
        ...(res.data || { id: res.id, ...payload, compatible_models: compatibleModels }),
        __linked: Boolean((res as any).linked),
      })
      onClose()
    } else {
      alert('오류: ' + res.message)
    }
    setLoading(false)
  }

  if (!isOpen) return null
  if (typeof document === 'undefined') return null

  return createPortal(
    <div className={styles.overlay} style={{ zIndex: 1200 }}>
      <div className={styles.modal} style={{ width: '520px', maxWidth: '96vw' }}>
        <h2 className={styles.title}>{editData ? '자재 수정' : '자재 등록'}</h2>
        {preset && !editData ? (
          <p style={{ margin: '0 0 12px', fontSize: '0.78rem', color: '#6b7280', lineHeight: 1.45 }}>
            서비스 일지에서 연 등록입니다. 품명·관리코드·호환기기가 미리 채워져 있습니다.
            재고를 0으로 두면 사용분은 <strong>미입고</strong>로 남고, 자산관리에서 입고·확정할 수 있습니다.
          </p>
        ) : null}
        <form onSubmit={handleSubmit}>
          <InputField
            label="소모품 종류 *"
            as="select"
            value={formData.category}
            onChange={(e) => {
              const category = e.target.value
              applyColorMeta({
                category,
                color: category === '토너' || category === '드럼' ? formData.color : '',
                is_regenerated: category === '토너' || category === '드럼' ? formData.is_regenerated : false,
              })
            }}
          >
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </InputField>

          {showColorFields && (
            <div className={styles.grid2}>
              <InputField
                label="색상 (K/C/M/Y · KCMY공용) *"
                as="select"
                value={formData.color}
                onChange={(e) =>
                  applyColorMeta({ color: e.target.value as TonerDrumColor | '' })
                }
              >
                <option value="">선택</option>
                {COLORS.filter(Boolean).map((c) => (
                  <option key={c} value={c}>
                    {c === 'KCMY' ? 'KCMY (공용)' : c}
                  </option>
                ))}
              </InputField>
              <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
                  <input
                    type="checkbox"
                    checked={formData.is_regenerated}
                    onChange={(e) => applyColorMeta({ is_regenerated: e.target.checked })}
                  />
                  재생품
                </label>
              </div>
            </div>
          )}

          <SuggestInput
            label="모델명 (품명) *"
            required
            value={formData.model_name}
            suggestions={nameSuggestions}
            transform={toConsumableModelName}
            onChange={(v) => setFormData({ ...formData, model_name: v })}
            placeholder="예: TN-221K / 토너 K"
            style={{ textTransform: 'uppercase' }}
          />

          <div className={styles.grid2}>
            <SuggestInput
              label="관리 코드"
              value={formData.code || ''}
              suggestions={codeSuggestions}
              transform={toManagementCode}
              onChange={(v) => setFormData({ ...formData, code: v })}
              placeholder="영문 대문자·숫자"
              style={{ textTransform: 'uppercase' }}
            />
            <InputField
              label="현재 재고 *"
              type="number"
              value={formData.current_stock}
              onChange={(e) => setFormData({ ...formData, current_stock: Number(e.target.value) })}
            />
          </div>

          <InputField
            label="매입 단가 (원)"
            type="number"
            value={formData.unit_price}
            onChange={(e) => setFormData({ ...formData, unit_price: Number(e.target.value) })}
          />

          <div
            style={{
              marginBottom: 16,
              padding: 12,
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              background: '#fafafa',
            }}
          >
            <label
              style={{
                display: 'block',
                marginBottom: 6,
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--notion-sub-text)',
              }}
            >
              호환 기기 *
            </label>
            <p style={{ margin: '0 0 10px', fontSize: '0.72rem', color: '#6b7280', lineHeight: 1.45 }}>
              일지에서 이 기기들을 선택하면 이 재고가 차감됩니다.
              제품군을 고르면 <strong>아래 호환 기기가 제품군 목록으로 바뀝니다</strong>.
            </p>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 8,
                marginBottom: 4,
              }}
            >
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#374151' }}>제품군으로 일괄 지정</span>
              <Button variant="secondary" size="sm"
                type="button"
                onClick={() => setGroupManagerOpen(true)}>
                제품군 정리/등록
              </Button>
            </div>
            <select
              value={productGroup}
              onChange={(e) => {
                const v = e.target.value
                if (!v) {
                  setProductGroup('')
                  return
                }
                applyProductGroup(v)
              }}
              style={{
                width: '100%',
                height: 38,
                border: '1px solid #e5e7eb',
                borderRadius: 6,
                padding: '0 10px',
                fontSize: '0.9rem',
                background: '#fff',
                marginBottom: 10,
              }}
            >
              <option value="">선택 안 함 (아래에서 기기 직접 추가)</option>
              {productGroup && !productGroups.some((g) => g.name === productGroup) ? (
                <option value={productGroup}>{productGroup} (기존 값)</option>
              ) : null}
              {productGroups.map((g) => (
                <option key={g.id} value={g.name}>
                  {g.name} ({g.machine_models.length}대)
                </option>
              ))}
            </select>

            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>
              기기 직접 추가
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <SuggestInput
                  label=""
                  value={machineDraft}
                  suggestions={machineSuggestions.filter((s) => !compatibleModels.includes(s.value))}
                  transform={toMachineModelName}
                  onChange={setMachineDraft}
                  placeholder="예: HL-L64100DW"
                  style={{ textTransform: 'uppercase' }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addCompatibleModel()
                    }
                  }}
                />
              </div>
              <Button variant="primary"
                type="button"
                onClick={() => addCompatibleModel()}>
                추가
              </Button>
            </div>

            {compatibleModels.length === 0 ? (
              <p style={{ margin: '8px 0 0', fontSize: '0.72rem', color: '#b45309' }}>
                {productGroup
                  ? `제품군 「${productGroup}」에 기기가 없습니다. 제품군을 수정하거나 기기를 직접 추가하세요.`
                  : '제품군을 선택하거나 기기를 직접 추가해 주세요.'}
              </p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {compatibleModels.map((m) => (
                  <span
                    key={m}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '3px 8px',
                      borderRadius: 4,
                      background: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      color: '#1d4ed8',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                    }}
                  >
                    {m}
                    <button
                      type="button"
                      aria-label={`${m} 제거`}
                      onClick={() => removeCompatibleModel(m)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        color: '#64748b',
                        padding: 0,
                        lineHeight: 1,
                        fontSize: '0.9rem',
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            {productGroup && compatibleModels.length > 0 ? (
              <p style={{ margin: '8px 0 0', fontSize: '0.7rem', color: '#059669' }}>
                제품군 「{productGroup}」 기준 · {compatibleModels.length}대
              </p>
            ) : null}
          </div>

          <div className={styles.footer}>
            <Button variant="danger" onClick={onClose} type="button">취소</Button>
            <Button variant="primary" type="submit" disabled={loading}>저장하기</Button>
          </div>
        </form>
      </div>
      <ProductGroupManager
        isOpen={groupManagerOpen}
        onClose={() => setGroupManagerOpen(false)}
        onChanged={() => {
          void reloadProductGroups().then((rows) => {
            if (productGroup) applyProductGroup(productGroup, rows)
          })
        }}
      />
    </div>,
    document.body
  )
}
