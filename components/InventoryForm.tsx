'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase'

export default function InventoryForm({ type, onSuccess }: { type: string, onSuccess: () => void }) {
  const supabase = createClient()
  const [isOpen, setIsOpen] = useState(true)

  const [formData, setFormData] = useState({
    category: '', brand: '', model_name: '', serial_number: '', 
    status: '창고', client_id: '', purchase_price: '', memo: ''
  })

  const [clients, setClients] = useState<any[]>([])
  const [existingBrands, setExistingBrands] = useState<string[]>([]) 
  const [showBrands, setShowBrands] = useState(false)
  const [existingModels, setExistingModels] = useState<string[]>([])
  const [showModels, setShowModels] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      const { data: cData } = await supabase.from('clients').select('id, name')
      if (cData) setClients(cData)

      const { data: bData } = await supabase.from('inventory').select('brand')
      if (bData) {
        const brands = bData.map(d => d.brand).filter(b => b) as string[]
        setExistingBrands(Array.from(new Set(brands)))
      }

      const { data: mData } = await supabase.from('inventory').select('model_name')
      if (mData) {
        setExistingModels(Array.from(new Set(mData.map(d => d.model_name))))
      }
    }
    loadData()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // 🔴 [누락된 기능 추가] 등록 시에도 '설치' 상태면 거래처 필수 체크!
    if (formData.status === '설치' && !formData.client_id) {
      alert("⚠️ 상태가 '설치'일 경우, 설치처를 반드시 선택해야 합니다.")
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user?.id).single()

    const { error } = await supabase.from('inventory').insert({
      ...formData,
      type,
      // 설치처 없으면 null로 변환
      client_id: formData.client_id || null, 
      purchase_price: formData.purchase_price || null,
      organization_id: profile?.organization_id
    })

    if (!error) {
      alert('등록 성공!')
      // 초기화
      setFormData({ category: '', brand: '', model_name: '', serial_number: '', status: '창고', client_id: '', purchase_price: '', memo: '' })
      onSuccess()
    } else {
      alert('등록 실패: ' + error.message)
    }
  }

  // 스타일 (#dddddd 적용)
  const inputStyle: React.CSSProperties = { width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #dddddd', boxSizing: 'border-box', fontSize: '0.9rem', backgroundColor: '#fff' }
  const btnStyle: React.CSSProperties = { width: '100%', padding: '12px', borderRadius: '6px', border: 'none', backgroundColor: '#0070f3', color: '#fff', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' }
  const dropdownStyle: React.CSSProperties = { position: 'absolute', width: '100%', backgroundColor: '#fff', border: '1px solid #dddddd', zIndex: 10, maxHeight: '150px', overflowY: 'auto', borderRadius: '0 0 6px 6px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }

  const FormField = ({ label, children }: { label: string, children: React.ReactNode }) => (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ marginBottom: '5px', fontSize: '0.85rem', fontWeight: 'bold', color: '#555' }}>{label}</div>
      {children}
    </div>
  )

  return (
    <div style={{ border: '1px solid #e0e0e0', borderRadius: '12px', backgroundColor: '#fff', overflow: 'hidden' }}>
      <div onClick={() => setIsOpen(!isOpen)} style={{ padding: '15px 20px', cursor: 'pointer', backgroundColor: '#fcfcfc', display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 'bold' }}>➕ {type} 추가</span>
        <span>{isOpen ? '▲' : '▼'}</span>
      </div>

      {isOpen && (
        <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
          
          <FormField label="분류*">
            <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} style={inputStyle} required>
              <option value="">분류를 선택해주세요</option>
              <option value="A3 레이저 복합기">A3 레이저 복합기</option>
              <option value="A4 레이저 복합기">A4 레이저 복합기</option>
              <option value="A3 레이저 프린터">A3 레이저 프린터</option>
              <option value="A4 레이저 프린터">A4 레이저 프린터</option>
              <option value="A3 잉크젯 복합기">A3 잉크젯 복합기</option>
              <option value="A4 잉크젯 복합기">A4 잉크젯 복합기</option>
              <option value="A3 잉크젯 프린터">A3 잉크젯 프린터</option>
              <option value="A4 잉크젯 프린터">A4 잉크젯 프린터</option>
              <option value="기타">기타</option>
            </select>
          </FormField>

          <FormField label="브랜드*">
            <div style={{ position: 'relative' }}>
              <input 
                placeholder="예: 삼성, 신도리코" 
                value={formData.brand} 
                onChange={e => { setFormData({...formData, brand: e.target.value}); setShowBrands(true); }}
                onFocus={() => setShowBrands(true)}
                onBlur={() => setTimeout(() => setShowBrands(false), 200)}
                style={inputStyle} 
                required
              />
              {showBrands && formData.brand && (
                <div style={dropdownStyle}>
                  {existingBrands.filter(b => b.includes(formData.brand)).map(b => (
                    <div key={b} onClick={() => setFormData({...formData, brand: b})} style={{ padding: '10px', cursor: 'pointer', borderBottom: '1px solid #eee', fontSize: '0.9rem' }}>{b}</div>
                  ))}
                </div>
              )}
            </div>
          </FormField>

          <FormField label="모델명*">
            <div style={{ position: 'relative' }}>
              <input 
                placeholder="모델명 입력" 
                value={formData.model_name} 
                onChange={e => { setFormData({...formData, model_name: e.target.value}); setShowModels(true); }}
                onFocus={() => setShowModels(true)}
                onBlur={() => setTimeout(() => setShowModels(false), 200)}
                style={inputStyle}
                required
              />
              {showModels && formData.model_name && (
                <div style={dropdownStyle}>
                  {existingModels.filter(m => m.includes(formData.model_name)).map(m => (
                    <div key={m} onClick={() => setFormData({...formData, model_name: m})} style={{ padding: '10px', cursor: 'pointer', borderBottom: '1px solid #eee', fontSize: '0.9rem' }}>{m}</div>
                  ))}
                </div>
              )}
            </div>
          </FormField>

          <FormField label="S/N (시리얼 번호)*">
            <input placeholder="S/N 입력" value={formData.serial_number} onChange={e => setFormData({...formData, serial_number: e.target.value})} required style={inputStyle} />
          </FormField>
          
          <FormField label="설치처">
            <select 
              value={formData.client_id} 
              onChange={e => {
                setFormData({...formData, client_id: e.target.value, status: e.target.value ? '설치' : '창고'})
              }} 
              style={inputStyle}
            >
              <option value="">설치처 선택 (미선택 시 창고)</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </FormField>

          <FormField label="상태">
            <select 
              value={formData.status} 
              onChange={e => {
                // 상태 변경 시 설치처 연동 로직
                const newStatus = e.target.value
                if (newStatus !== '설치') {
                   setFormData({...formData, status: newStatus, client_id: ''})
                } else {
                   setFormData({...formData, status: newStatus})
                }
              }} 
              style={inputStyle}
            >
              <option value="창고">창고</option>
              <option value="설치">설치</option>
              <option value="수리중">수리중</option>
              <option value="폐기">폐기</option>
            </select>
          </FormField>

          <FormField label="매입가">
            <input type="number" placeholder="숫자만 입력" value={formData.purchase_price} onChange={e => setFormData({...formData, purchase_price: e.target.value})} style={inputStyle} />
          </FormField>

          <FormField label="메모">
            <textarea placeholder="특이사항 입력" value={formData.memo} onChange={e => setFormData({...formData, memo: e.target.value})} style={{ ...inputStyle, height: '60px' }} />
          </FormField>

          <button type="submit" style={btnStyle}>아이템 등록하기</button>
        </form>
      )}
    </div>
  )
}