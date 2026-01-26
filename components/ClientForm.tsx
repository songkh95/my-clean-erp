'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  editData?: any
}

export default function ClientForm({ isOpen, onClose, onSuccess, editData }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [potentialParents, setPotentialParents] = useState<any[]>([]) // 본사 후보 목록

  const [formData, setFormData] = useState({
    name: '',
    contact_person: '',
    contact_number: '',
    email: '',       // 🔴 추가: 이메일
    address: '',
    billing_date: '말일',
    memo: '',        // 🔴 추가: 메모
    parent_id: ''    // 🔴 추가: 본사 ID (지사일 경우 선택)
  })

  useEffect(() => {
    fetchPotentialParents() // 본사로 선택할 수 있는 거래처 목록 가져오기

    if (editData) {
      setFormData({
        name: editData.name || '',
        contact_person: editData.contact_person || '',
        contact_number: editData.contact_number || '',
        email: editData.email || '',
        address: editData.address || '',
        billing_date: editData.billing_date || '말일',
        memo: editData.memo || '',
        parent_id: editData.parent_id || ''
      })
    } else {
      setFormData({
        name: '',
        contact_person: '',
        contact_number: '',
        email: '',
        address: '',
        billing_date: '말일',
        memo: '',
        parent_id: ''
      })
    }
  }, [editData, isOpen])

  // 본사 후보 목록 가져오기 (자기 자신 제외)
  const fetchPotentialParents = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user?.id).single()
    
    let query = supabase
      .from('clients')
      .select('id, name')
      .eq('organization_id', profile?.organization_id)
      .eq('status', '정상') // 정상 거래처만
    
    // 수정 모드라면, 자기 자신은 본사로 선택 못하게 제외
    if (editData) {
      query = query.neq('id', editData.id)
    }

    const { data } = await query
    if (data) setPotentialParents(data)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user?.id).single()

      // 빈 문자열인 parent_id를 null로 변환 (DB 저장용)
      const payload = {
        ...formData,
        parent_id: formData.parent_id === '' ? null : formData.parent_id
      }

      if (editData) {
        // [수정]
        const { error } = await supabase
          .from('clients')
          .update(payload)
          .eq('id', editData.id)

        if (error) throw error
        alert('수정되었습니다.')

      } else {
        // [신규]
        const { error } = await supabase
          .from('clients')
          .insert({
            ...payload,
            organization_id: profile?.organization_id,
            status: '정상'
          })

        if (error) throw error
        alert('등록되었습니다.')
      }

      onSuccess()
      onClose()

    } catch (error: any) {
      alert('오류 발생: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
    }}>
      <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '12px', width: '500px', maxWidth: '90%', maxHeight:'90vh', overflowY:'auto' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '20px', borderBottom: '2px solid #333', paddingBottom: '10px' }}>
          {editData ? '🏢 거래처 정보 수정' : '🏢 신규 거래처 등록'}
        </h2>

        <form onSubmit={handleSubmit}>
          {/* 본사 선택 (지사 등록 시) */}
          <div style={{ marginBottom: '15px', backgroundColor:'#f9f9f9', padding:'10px', borderRadius:'6px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem', color:'#555' }}>소속 본사 (지사일 경우 선택)</label>
            <select 
              value={formData.parent_id}
              onChange={e => setFormData({ ...formData, parent_id: e.target.value })}
              style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
            >
              <option value="">(없음 - 독립 거래처)</option>
              {potentialParents.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>거래처명 *</label>
            <input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
          </div>

          <div style={{ display:'flex', gap:'10px', marginBottom: '15px' }}>
            <div style={{flex:1}}>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>담당자</label>
              <input value={formData.contact_person} onChange={e => setFormData({ ...formData, contact_person: e.target.value })} style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
            </div>
            <div style={{flex:1}}>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>연락처</label>
              <input value={formData.contact_number} onChange={e => setFormData({ ...formData, contact_number: e.target.value })} placeholder="010-0000-0000" style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
            </div>
          </div>

          <div style={{ marginBottom: '15px' }}>
             <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>이메일 (계산서용)</label>
             <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="example@company.com" style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>주소</label>
            <input value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>정기 청구일</label>
            <select value={formData.billing_date} onChange={e => setFormData({ ...formData, billing_date: e.target.value })} style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}>
              <option value="말일">매월 말일</option>
              {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (<option key={day} value={String(day)}>매월 {day}일</option>))}
            </select>
          </div>

          <div style={{ marginBottom: '20px' }}>
             <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>메모</label>
             <textarea value={formData.memo} onChange={e => setFormData({ ...formData, memo: e.target.value })} placeholder="특이사항 입력" style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', height:'80px', resize:'none' }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" onClick={onClose} style={{ padding: '10px 20px', border: '1px solid #ccc', background: 'white', borderRadius: '6px', cursor: 'pointer' }}>취소</button>
            <button type="submit" disabled={loading} style={{ padding: '10px 20px', background: '#333', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
              {loading ? '저장 중...' : '저장하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}