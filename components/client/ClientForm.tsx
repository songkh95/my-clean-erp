'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/utils/supabase'
import Button from './../ui/Button'
import InputField from './../ui/Input'
import { Client } from '@/app/types'
// ✅ Server Actions 임포트
import { createClientAction, updateClientAction } from '@/app/actions/client'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  editData?: Client | null 
}

interface ClientFormState {
  name: string
  business_number: string
  representative_name: string
  contact_person: string
  phone: string
  office_phone: string
  email: string
  address: string
  memo: string
  parent_id: string
  status: string
}

export default function ClientForm({ isOpen, onClose, onSuccess, editData }: Props) {
  // 드롭다운 목록 조회용 Supabase 클라이언트 (읽기 전용)
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [potentialParents, setPotentialParents] = useState<Client[]>([])

  const initialData: ClientFormState = {
    name: '', business_number: '', representative_name: '', contact_person: '',
    phone: '', office_phone: '', email: '', address: '', memo: '', parent_id: '', status: 'active'
  }

  const [formData, setFormData] = useState<ClientFormState>(initialData)

  // 소속 본사 목록 조회 (드롭다운용)
  const fetchPotentialParents = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
    if (profile?.organization_id) {
      let query = supabase.from('clients')
        .select('id, name, organization_id')
        .eq('organization_id', profile.organization_id)
        .eq('is_deleted', false)
      
      // 자기 자신을 부모로 선택할 수 없도록 제외
      if (editData && editData.id) {
        query = query.neq('id', editData.id)
      }
      
      const { data } = await query
      if (data) setPotentialParents(data as Client[])
    }
  }, [editData, supabase]) 

  // 초기 데이터 세팅
  useEffect(() => {
    if (isOpen) {
      fetchPotentialParents()
      if (editData) {
        setFormData({
          name: editData.name || '',
          business_number: editData.business_number || '',
          representative_name: editData.representative_name || '',
          contact_person: editData.contact_person || '',
          phone: editData.phone || '',
          office_phone: editData.office_phone || '', 
          email: editData.email || '',
          address: editData.address || '',
          memo: editData.memo || '',
          parent_id: editData.parent_id || '',
          status: editData.status || 'active'
        })
      } else {
        setFormData(initialData)
      }
    }
  }, [editData, isOpen, fetchPotentialParents])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      // Payload 구성 (빈 문자열 parent_id를 null로 변환)
      const payload = {
        ...formData,
        parent_id: formData.parent_id === '' ? null : formData.parent_id,
      }

      // ✅ Server Action 호출로 변경
      let result;
      if (editData && editData.id) {
        // 수정
        result = await updateClientAction(editData.id, payload)
      } else {
        // 등록
        result = await createClientAction(payload)
      }

      if (result.success) {
        alert(result.message)
        onSuccess()
        onClose()
      } else {
        throw new Error(result.message)
      }
    } catch (error: any) { 
      const message = error.message || String(error)
      alert('저장 오류: ' + message) 
    } finally { 
      setLoading(false) 
    }
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