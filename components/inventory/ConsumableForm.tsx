'use client'

import { useState, useEffect } from 'react'
import Button from '../ui/Button'
import InputField from '../ui/Input'
import SuggestInput from '../ui/SuggestInput'
import styles from './InventoryForm.module.css'
import {
  upsertConsumableAction,
  getConsumablesAction,
  getMachineModelOptionsAction,
} from '@/app/actions/consumable'
import { toMachineModelName } from '@/utils/suggestMatch'
import { standardConsumableName, type TonerDrumColor } from '@/utils/consumableMatch'

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

const COLORS: Array<TonerDrumColor | ''> = ['', 'K', 'C', 'M', 'Y']

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
  const [machineDraft, setMachineDraft] = useState('')
  const [nameSuggestions, setNameSuggestions] = useState<Array<{ value: string; hint?: string }>>([])
  const [codeSuggestions, setCodeSuggestions] = useState<Array<{ value: string; hint?: string }>>([])
  const [machineSuggestions, setMachineSuggestions] = useState<Array<{ value: string; hint?: string }>>([])

  const showColorFields = formData.category === '토너' || formData.category === '드럼'

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
    } else {
      const cat = preset?.category || defaultCategory || categories[0] || '토너'
      const color = (preset?.color || '') as TonerDrumColor | ''
      const regen = Boolean(preset?.is_regenerated)
      const defaultName =
        preset?.model_name ||
        (color && (cat === '토너' || cat === '드럼')
          ? standardConsumableName(cat as '토너' | '드럼', color, regen)
          : '')
      setFormData({
        id: '',
        category: cat,
        model_name: defaultName,
        code: preset?.code || '',
        current_stock: preset?.current_stock ?? 1,
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
    }
    setMachineDraft('')

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
  }

  const removeCompatibleModel = (m: string) => {
    setCompatibleModels((prev) => prev.filter((x) => x !== m))
  }

  const applyColorMeta = (next: Partial<typeof formData>) => {
    const merged = { ...formData, ...next }
    // 품명이 비어 있거나 표준명일 때만 자동 채움
    if (
      (merged.category === '토너' || merged.category === '드럼') &&
      merged.color &&
      (!merged.model_name.trim() ||
        /^토너 [KCMY]( 재생)?$/.test(merged.model_name.trim()) ||
        /^드럼 [KCMY]( 재생)?$/.test(merged.model_name.trim()))
    ) {
      merged.model_name = standardConsumableName(
        merged.category as '토너' | '드럼',
        merged.color as TonerDrumColor,
        merged.is_regenerated
      )
    }
    setFormData(merged)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.model_name.trim()) return alert('모델명(품명)을 입력해주세요.')
    if (compatibleModels.length === 0) {
      return alert('호환 기기를 1개 이상 추가해주세요.\n(여러 모델이 같은 소모품을 쓰면 모두 추가)')
    }
    if (showColorFields && !formData.color) {
      return alert('토너/드럼은 색상(K/C/M/Y)을 선택해주세요.')
    }
    setLoading(true)

    const payload: any = {
      ...formData,
      color: showColorFields && formData.color ? formData.color : null,
      is_regenerated: showColorFields ? formData.is_regenerated : false,
      compatible_models: compatibleModels,
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

  return (
    <div className={styles.overlay} style={{ zIndex: 1200 }}>
      <div className={styles.modal} style={{ width: '480px', maxWidth: '96vw' }}>
        <h2 className={styles.title}>{editData ? '자재 수정' : '자재 등록'}</h2>
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
                label="색상 (K/C/M/Y) *"
                as="select"
                value={formData.color}
                onChange={(e) =>
                  applyColorMeta({ color: e.target.value as TonerDrumColor | '' })
                }
              >
                <option value="">선택</option>
                {COLORS.filter(Boolean).map((c) => (
                  <option key={c} value={c}>{c}</option>
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
            onChange={(v) => setFormData({ ...formData, model_name: v })}
            placeholder="예: TN-221K / 토너 K"
          />

          <div className={styles.grid2}>
            <SuggestInput
              label="관리 코드"
              value={formData.code || ''}
              suggestions={codeSuggestions}
              onChange={(v) => setFormData({ ...formData, code: v })}
              placeholder="선택사항"
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

          <div style={{ marginBottom: 16 }}>
            <label style={{
              display: 'block', marginBottom: 4, fontSize: '0.75rem',
              fontWeight: 500, color: 'var(--notion-sub-text)',
            }}>
              호환 기기 *
            </label>
            <p style={{ margin: '0 0 8px', fontSize: '0.72rem', color: '#6b7280' }}>
              일지에서 이 기기들을 선택하면 이 재고가 차감됩니다. 호환 모델은 여러 개 추가할 수 있습니다.
            </p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <SuggestInput
                  label=""
                  value={machineDraft}
                  suggestions={machineSuggestions.filter((s) => !compatibleModels.includes(s.value))}
                  transform={toMachineModelName}
                  onChange={setMachineDraft}
                  placeholder="예: HL-L64100DW"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addCompatibleModel()
                    }
                  }}
                />
              </div>
              <button
                type="button"
                onClick={() => addCompatibleModel()}
                style={{
                  marginTop: 4,
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  background: '#f9fafb',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  whiteSpace: 'nowrap',
                }}
              >
                추가
              </button>
            </div>
            {compatibleModels.length === 0 ? (
              <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: '#b45309' }}>
                호환 기기가 없습니다. 최소 1개 추가해 주세요.
              </p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
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
          </div>

          <div className={styles.footer}>
            <Button variant="ghost" onClick={onClose} type="button">취소</Button>
            <Button variant="primary" type="submit" disabled={loading}>저장하기</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
