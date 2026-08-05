'use client'

import { useState, useEffect } from 'react'
import Button from '../ui/Button'
import InputField from '../ui/Input'
import SuggestInput from '../ui/SuggestInput'
import styles from './InventoryForm.module.css'
import { upsertConsumableAction, getConsumablesAction } from '@/app/actions/consumable'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  editData?: any
  defaultCategory?: string
  categoryOptions?: string[]
}

export default function ConsumableForm({ isOpen, onClose, onSuccess, editData, defaultCategory, categoryOptions }: Props) {
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
    unit_price: 0
  })
  const [nameSuggestions, setNameSuggestions] = useState<Array<{ value: string; hint?: string }>>([])
  const [codeSuggestions, setCodeSuggestions] = useState<Array<{ value: string; hint?: string }>>([])

  useEffect(() => {
    if (!isOpen) return
    if (editData) {
      setFormData(editData)
    } else {
      setFormData({
        id: '',
        category: defaultCategory || categories[0] || '토너',
        model_name: '',
        code: '',
        current_stock: 0,
        unit_price: 0,
      })
    }

    getConsumablesAction().then((res) => {
      if (!res.success || !res.data) return
      setNameSuggestions(
        res.data.map((c: any) => ({
          value: c.model_name,
          hint: [c.category, c.code].filter(Boolean).join(' · ') || undefined,
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
  }, [editData, defaultCategory, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    const payload = { ...formData }
    if (!payload.id) delete (payload as any).id

    const res = await upsertConsumableAction(payload)
    
    if (res.success) {
      alert(res.message)
      onSuccess()
      onClose()
    } else {
      alert('오류: ' + res.message)
    }
    setLoading(false)
  }

  if (!isOpen) return null

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} style={{width:'450px'}}>
        <h2 className={styles.title}>{editData ? '자재 수정' : '자재 등록'}</h2>
        <form onSubmit={handleSubmit}>
          <InputField label="카테고리" as="select" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </InputField>

          <SuggestInput
            label="모델명 (품명) *"
            required
            value={formData.model_name}
            suggestions={nameSuggestions}
            onChange={(v) => setFormData({ ...formData, model_name: v })}
            placeholder="기존 품명과 비슷한 항목이 아래에 표시됩니다"
          />
          
          <div className={styles.grid2}>
            <SuggestInput
              label="관리 코드"
              value={formData.code || ''}
              suggestions={codeSuggestions}
              onChange={(v) => setFormData({ ...formData, code: v })}
              placeholder="선택사항"
            />
            <InputField label="현재 재고" type="number" value={formData.current_stock} onChange={e => setFormData({...formData, current_stock: Number(e.target.value)})} />
          </div>

          <InputField label="매입 단가 (원)" type="number" value={formData.unit_price} onChange={e => setFormData({...formData, unit_price: Number(e.target.value)})} />

          <div className={styles.footer}>
            <Button variant="ghost" onClick={onClose} type="button">취소</Button>
            <Button variant="primary" type="submit" disabled={loading}>저장하기</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
