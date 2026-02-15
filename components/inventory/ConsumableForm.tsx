'use client'

import { useState, useEffect } from 'react'
import Button from '../ui/Button'
import InputField from '../ui/Input'
import styles from './InventoryForm.module.css' // 기존 스타일 재활용
import { upsertConsumableAction } from '@/app/actions/consumable'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  editData?: any
  defaultCategory?: string
}

export default function ConsumableForm({ isOpen, onClose, onSuccess, editData, defaultCategory }: Props) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    id: '',
    category: defaultCategory || '토너',
    model_name: '',
    code: '',
    current_stock: 0,
    unit_price: 0
  })

  useEffect(() => {
    if (editData) {
      setFormData(editData)
    } else {
      setFormData(prev => ({ ...prev, category: defaultCategory || '토너' }))
    }
  }, [editData, defaultCategory])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    // ID가 없으면 제거 (Insert 모드)
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
        <h2 className={styles.title}>{editData ? '✏️ 자재 수정' : '📦 자재 등록'}</h2>
        <form onSubmit={handleSubmit}>
          <InputField label="카테고리" as="select" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
            <option value="토너">토너</option>
            <option value="드럼">드럼</option>
            <option value="현상기">현상기</option>
            <option value="폐토너통">폐토너통</option>
            <option value="용지">용지</option>
            <option value="부품">부품</option>
            <option value="롤러">롤러</option>
            <option value="기어">기어</option>
            <option value="Fuser">Fuser</option>
            <option value="기타">기타</option>
          </InputField>

          <InputField label="모델명 (품명) *" required value={formData.model_name} onChange={e => setFormData({...formData, model_name: e.target.value})} placeholder="예: C3520 검정 토너" />
          
          <div className={styles.grid2}>
            <InputField label="관리 코드" value={formData.code || ''} onChange={e => setFormData({...formData, code: e.target.value})} placeholder="선택사항" />
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