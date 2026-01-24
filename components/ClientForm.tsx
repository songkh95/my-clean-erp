'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase'

export default function ClientForm({ onSuccess }: { onSuccess: () => void }) {
  const [isOpen, setIsOpen] = useState(true)
  const supabase = createClient()

  // [누락방지 11종 필드]
  const [formData, setFormData] = useState({
    name: '', business_number: '', representative_name: '', contact_person: '',
    phone: '', office_phone: '', email: '', address: '',
    parent_id: '', status: '정상', popup_memo: ''
  })

  const [parentSearch, setParentSearch] = useState('현재 거래처가 본사')
  const [allClients, setAllClients] = useState<any[]>([])
  const [filteredResults, setFilteredResults] = useState<any[]>([])
  const [showDropdown, setShowDropdown] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('clients').select('id, name')
      if (data) setAllClients(data)
    }
    load()
  }, [])

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setParentSearch(val)
    if (!val) { setFormData(p => ({...p, parent_id: ''})); setFilteredResults([]); return; }
    const res = allClients.filter(c => c.name.includes(val))
    setFilteredResults(res); setShowDropdown(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user?.id).single()

    const { error } = await supabase.from('clients').insert({
      ...formData,
      parent_id: formData.parent_id || null,
      organization_id: profile?.organization_id
    })

    if (!error) {
      alert('🎉 등록 성공!')
      setFormData({ name: '', business_number: '', representative_name: '', contact_person: '', phone: '', office_phone: '', email: '', address: '', parent_id: '', status: '정상', popup_memo: '' })
      setParentSearch('현재 거래처가 본사')
      onSuccess()
    }
  }

  const inputStyle = { width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ddd', boxSizing: 'border-box' as const, fontSize: '0.9rem', backgroundColor: '#fff' }

  return (
    <div style={{ border: '1px solid #e0e0e0', borderRadius: '12px', backgroundColor: '#fff', overflow: 'hidden' }}>
      <div onClick={() => setIsOpen(!isOpen)} style={{ padding: '15px 20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', backgroundColor: '#fcfcfc', borderBottom: isOpen ? '1px solid #eee' : 'none' }}>
        <span style={{ fontWeight: 'bold' }}>➕ 신규 거래처 등록</span>
        <span>{isOpen ? '▲' : '▼'}</span>
      </div>

      {isOpen && (
        <form onSubmit={handleSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input placeholder="업체명 (필수)" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required style={inputStyle} />
          
          <div style={{ position: 'relative' }}>
            <label style={{ fontSize: '0.75rem', color: '#888' }}>본사 지정 (미입력 시 본사)</label>
            <input 
              value={parentSearch} onChange={handleSearch}
              onFocus={() => { if(parentSearch === '현재 거래처가 본사') setParentSearch('') }}
              onBlur={() => setTimeout(() => { if(!formData.parent_id) setParentSearch('현재 거래처가 본사'); setShowDropdown(false) }, 200)}
              style={{ ...inputStyle, backgroundColor: formData.parent_id ? '#f0f7ff' : '#fff' }}
            />
            {showDropdown && filteredResults.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '4px', maxHeight: '150px', overflowY: 'auto', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
                {filteredResults.map(c => (
                  <div key={c.id} onClick={() => { setFormData({...formData, parent_id: c.id}); setParentSearch(c.name); setShowDropdown(false); }} style={{ padding: '10px', cursor: 'pointer', borderBottom: '1px solid #eee' }}>{c.name}</div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <input placeholder="사업자번호" value={formData.business_number} onChange={e => setFormData({...formData, business_number: e.target.value})} style={inputStyle} />
            <input placeholder="대표자명" value={formData.representative_name} onChange={e => setFormData({...formData, representative_name: e.target.value})} style={inputStyle} />
          </div>
          
          <div style={{ display: 'flex', gap: '10px' }}>
            <input placeholder="담당자명" value={formData.contact_person} onChange={e => setFormData({...formData, contact_person: e.target.value})} style={inputStyle} />
            <input placeholder="휴대폰 번호" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} style={inputStyle} />
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <input placeholder="사무실 번호" value={formData.office_phone} onChange={e => setFormData({...formData, office_phone: e.target.value})} style={inputStyle} />
            <input type="email" placeholder="이메일 주소" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} style={inputStyle} />
          </div>

          <input placeholder="주소" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} style={inputStyle} />
          
          <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} style={inputStyle}>
            <option value="정상">정상</option><option value="중지">중지</option><option value="해지">해지</option>
          </select>

          <textarea placeholder="알림메모" value={formData.popup_memo} onChange={e => setFormData({...formData, popup_memo: e.target.value})} style={{ ...inputStyle, height: '60px', resize: 'none' }} />
          
          <button type="submit" style={{ padding: '12px', borderRadius: '6px', border: 'none', backgroundColor: '#0070f3', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>등록하기</button>
        </form>
      )}
    </div>
  )
}