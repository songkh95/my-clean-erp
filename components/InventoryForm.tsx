'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase'
import Button from './ui/Button'
import InputField from './ui/Input'
import styles from './InventoryForm.module.css'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  editData?: any
}

export default function InventoryForm({ isOpen, onClose, onSuccess, editData }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [clients, setClients] = useState<any[]>([])

  const [formData, setFormData] = useState({
    type: '복합기', category: '컬러겸용', brand: '', model_name: '', serial_number: '',
    product_condition: '새제품', status: '창고', client_id: '', purchase_date: '',
    purchase_price: 0, initial_count_bw: 0, initial_count_col: 0,
    initial_count_bw_a3: 0, initial_count_col_a3: 0, memo: ''
  })

  useEffect(() => {
    const fetchClients = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user?.id).single()
      if (profile?.organization_id) {
        const { data } = await supabase.from('clients').select('id, name').eq('organization_id', profile.organization_id).eq('is_deleted', false).order('name')
        if (data) setClients(data)
      }
    }
    fetchClients()
  }, [])

  useEffect(() => {
    if (isOpen && editData) setFormData({ ...editData, client_id: editData.client_id || '', purchase_date: editData.purchase_date || '' })
  }, [isOpen, editData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (formData.status === '설치' && !formData.client_id) return alert('설치 상태일 경우 거래처를 선택해야 합니다.')
    
    if (editData) {
      if ((editData.status === '교체전(철수)' || editData.status === '설치') && formData.status === '창고') {
        alert("거래처에 등록된 기계는 직접 '창고'로 변경할 수 없습니다. [거래처 관리]에서 '철수' 기능을 이용하시거나 정산을 완료해주세요.");
        return;
      }
    }

    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user?.id).single()
      
      const { client, id, created_at, updated_at, ...pureData } = formData as any;

      const payload = { 
        ...pureData, 
        organization_id: profile?.organization_id, 
        client_id: formData.client_id || null,
        purchase_date: formData.purchase_date || null,
        purchase_price: Number(formData.purchase_price) || 0,
        last_status_updated_at: new Date().toISOString()
      }

      const { error } = editData 
        ? await supabase.from('inventory').update(payload).eq('id', editData.id) 
        : await supabase.from('inventory').insert(payload)
      
      if (error) throw error
      onSuccess(); onClose()
    } catch (error: any) { alert('오류: ' + error.message) } finally { setLoading(false) }
  }

  if (!isOpen) return null

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <h2 className={styles.title}>{editData ? '✏️ 장비 수정' : '📦 신규 등록'}</h2>
        <form onSubmit={handleSubmit}>
          <div className={styles.grid3}>
            <InputField label="종류" as="select" value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}>
              <option value="복합기">복합기</option><option value="프린터">프린터</option>
            </InputField>
            <InputField label="구분" as="select" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
              <option value="컬러겸용">컬러겸용</option><option value="흑백전용">흑백전용</option>
            </InputField>
            <InputField label="상태" as="select" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value, client_id: e.target.value === '설치' ? formData.client_id : '' })}>
              <option value="창고">창고</option><option value="설치">설치됨</option>
              <option value="수리중">수리중</option><option value="폐기">폐기</option>
              <option value="교체전(철수)">교체전(철수)</option>
            </InputField>
          </div>
          <div className={`${styles.highlightBox} ${formData.status === '설치' ? styles.activeBox : ''}`}>
            <InputField label="🏢 설치 거래처" as="select" disabled={formData.status !== '설치'} value={formData.client_id} onChange={e => setFormData({ ...formData, client_id: e.target.value })} style={{ marginBottom: 0 }}>
              <option value="">거래처 선택</option>
              {clients.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </InputField>
          </div>
          <div className={styles.grid2}>
            <InputField label="브랜드" value={formData.brand} onChange={e => setFormData({ ...formData, brand: e.target.value })} />
            <InputField required label="모델명 *" value={formData.model_name} onChange={e => setFormData({ ...formData, model_name: e.target.value })} />
          </div>
          <InputField required label="S/N *" value={formData.serial_number} onChange={e => setFormData({ ...formData, serial_number: e.target.value })} />
          <div className={styles.highlightBox}>
            <div className={styles.sectionTitle}>🔢 초기 카운터</div>
            <div className={styles.grid2}>
              <InputField label="흑백 A4" type="number" value={formData.initial_count_bw} onChange={e => setFormData({ ...formData, initial_count_bw: Number(e.target.value) })} />
              <InputField label="칼라 A4" type="number" value={formData.initial_count_col} onChange={e => setFormData({ ...formData, initial_count_col: Number(e.target.value) })} />
            </div>
            <div className={styles.grid2} style={{marginBottom:0}}>
              <InputField label="흑백 A3" type="number" value={formData.initial_count_bw_a3} onChange={e => setFormData({ ...formData, initial_count_bw_a3: Number(e.target.value) })} />
              <InputField label="칼라 A3" type="number" value={formData.initial_count_col_a3} onChange={e => setFormData({ ...formData, initial_count_col_a3: Number(e.target.value) })} />
            </div>
          </div>
          <InputField label="비고" as="textarea" value={formData.memo} onChange={e => setFormData({ ...formData, memo: e.target.value })} style={{ height: '80px' }} />
          <div className={styles.footer}>
            <Button variant="ghost" onClick={onClose}>취소</Button>
            <Button variant="primary" type="submit" disabled={loading}>저장하기</Button>
          </div>
        </form>
      </div>
    </div>
  )
}