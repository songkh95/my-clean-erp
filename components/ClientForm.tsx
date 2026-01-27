'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase'
import Button from './ui/Button'
import InputField from './ui/Input'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  editData?: any
}

export default function ClientForm({ isOpen, onClose, onSuccess, editData }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [potentialParents, setPotentialParents] = useState<any[]>([])

  const [formData, setFormData] = useState({
    name: '', business_number: '', representative_name: '', contact_person: '',
    phone: '', office_phone: '', email: '', address: '', billing_date: '말일', memo: '', parent_id: '', status: 'active'
  })

  useEffect(() => {
    if (isOpen) {
      fetchPotentialParents()
      if (editData) setFormData({ ...editData, parent_id: editData.parent_id || '' })
      else setFormData({ name: '', business_number: '', representative_name: '', contact_person: '', phone: '', office_phone: '', email: '', address: '', billing_date: '말일', memo: '', parent_id: '', status: 'active' })
    }
  }, [editData, isOpen])

  const fetchPotentialParents = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user?.id).single()
    let query = supabase.from('clients').select('id, name').eq('organization_id', profile?.organization_id).eq('is_deleted', false)
    if (editData) query = query.neq('id', editData.id)
    const { data } = await query
    if (data) setPotentialParents(data)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user?.id).single()
      const { id, created_at, updated_at, ...pureData } = formData as any;
      const payload = { ...pureData, parent_id: pureData.parent_id === '' ? null : pureData.parent_id, organization_id: profile?.organization_id }

      const { error } = editData 
        ? await supabase.from('clients').update(payload).eq('id', editData.id)
        : await supabase.from('clients').insert(payload)

      if (error) throw error
      onSuccess(); onClose()
    } catch (error: any) { alert('저장 오류: ' + error.message) } finally { setLoading(false) }
  }

  if (!isOpen) return null

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
      <div style={{ backgroundColor: 'var(--notion-bg)', padding: '32px', borderRadius: '12px', width: '550px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 15px 50px rgba(0,0,0,0.1)' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '24px' }}>🏢 거래처 정보 설정</h2>
        <form onSubmit={handleSubmit}>
          <div style={{ padding: '16px', backgroundColor: 'var(--notion-soft-bg)', borderRadius: '8px', marginBottom: '20px', border: '1px solid var(--notion-border)' }}>
            <InputField label="소속 본사" as="select" value={formData.parent_id} onChange={e => setFormData({ ...formData, parent_id: e.target.value })} style={{ marginBottom: 0 }}>
              <option value="">(독립 거래처)</option>
              {potentialParents.map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}
            </InputField>
          </div>
          <InputField required label="거래처명 *" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
          <div style={{ display: 'flex', gap: '12px' }}>
            <InputField label="사업자번호" value={formData.business_number} onChange={e => setFormData({ ...formData, business_number: e.target.value })} />
            <InputField label="대표자명" value={formData.representative_name} onChange={e => setFormData({ ...formData, representative_name: e.target.value })} />
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <InputField label="담당자" value={formData.contact_person} onChange={e => setFormData({ ...formData, contact_person: e.target.value })} />
            <InputField label="연락처" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="010-0000-0000" />
          </div>
          <InputField label="이메일" type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
          <InputField label="주소" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
          <InputField label="정기 청구일" as="select" value={formData.billing_date} onChange={e => setFormData({ ...formData, billing_date: e.target.value })}>
            <option value="말일">매월 말일</option>
            {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (<option key={day} value={String(day)}>매월 {day}일</option>))}
          </InputField>
          <InputField label="메모" as="textarea" value={formData.memo} onChange={e => setFormData({ ...formData, memo: e.target.value })} style={{ height: '80px' }} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '24px' }}>
            <Button variant="ghost" type="button" onClick={onClose}>취소</Button>
            <Button variant="primary" type="submit" disabled={loading}>저장하기</Button>
          </div>
        </form>
      </div>
    </div>
  )
}