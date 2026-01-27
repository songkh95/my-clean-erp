'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase'

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

  const initialValues = {
    type: '복합기',
    category: '컬러겸용',
    brand: '',
    model_name: '',
    serial_number: '',
    product_condition: '새제품',
    status: '창고',
    client_id: '',
    purchase_date: '',
    purchase_price: 0,
    initial_count_bw: 0,
    initial_count_col: 0,
    initial_count_bw_a3: 0,
    initial_count_col_a3: 0,
    memo: ''
  }

  const [formData, setFormData] = useState(initialValues)

  useEffect(() => {
    const fetchClients = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user?.id).single()
      
      if (profile?.organization_id) {
        const { data } = await supabase.from('clients').select('id, name').eq('organization_id', profile.organization_id).eq('status', '정상').order('name')
        if (data) setClients(data)
      }
    }
    fetchClients()
  }, [])

  useEffect(() => {
    if (isOpen) {
      if (editData) {
        setFormData({
          type: editData.type || '복합기',
          category: editData.category || '컬러겸용',
          brand: editData.brand || '',
          model_name: editData.model_name || '',
          serial_number: editData.serial_number || '',
          product_condition: editData.product_condition || '새제품',
          status: editData.status || '창고',
          client_id: editData.client_id || '',
          purchase_date: editData.purchase_date || '',
          purchase_price: editData.purchase_price || 0,
          initial_count_bw: editData.initial_count_bw || 0,
          initial_count_col: editData.initial_count_col || 0,
          initial_count_bw_a3: editData.initial_count_bw_a3 || 0,
          initial_count_col_a3: editData.initial_count_col_a3 || 0,
          memo: editData.memo || ''
        })
      } else {
        setFormData(initialValues)
      }
    }
  }, [isOpen, editData])

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value
    setFormData(prev => ({
      ...prev,
      status: newStatus,
      client_id: newStatus === '설치' ? prev.client_id : ''
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    if (formData.status === '설치' && !formData.client_id) {
      alert('상태가 [설치]일 경우 거래처를 반드시 선택해야 합니다.')
      setLoading(false)
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user?.id).single()

      const payload = {
        organization_id: profile?.organization_id,
        ...formData,
        client_id: formData.client_id === '' ? null : formData.client_id,
        purchase_date: formData.purchase_date === '' ? null : formData.purchase_date,
        purchase_price: Number(formData.purchase_price) || 0,
        initial_count_bw: Number(formData.initial_count_bw) || 0,
        initial_count_col: Number(formData.initial_count_col) || 0,
        initial_count_bw_a3: Number(formData.initial_count_bw_a3) || 0,
        initial_count_col_a3: Number(formData.initial_count_col_a3) || 0,
      }

      let error
      if (editData) {
        const { error: updateError } = await supabase.from('inventory').update(payload).eq('id', editData.id)
        error = updateError
      } else {
        const { error: insertError } = await supabase.from('inventory').insert(payload)
        error = insertError
      }

      if (error) throw error
      alert(editData ? '수정되었습니다.' : '등록되었습니다.')
      onSuccess()
      onClose()
    } catch (error: any) {
      console.error(error)
      alert('오류 발생: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  // 공통 스타일
  const labelStyle = { display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: '600', color: '#171717' }
  const subLabelStyle = { display: 'block', marginBottom: '4px', fontSize: '0.85rem', color: '#666666' }
  const inputStyle = { width: '100%', padding: '10px', border: '1px solid #E5E5E5', borderRadius: '6px', fontSize: '0.95rem', color:'#171717', outline:'none' }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
    }}>
      <div style={{ backgroundColor: '#FFFFFF', padding: '30px', borderRadius: '12px', width: '650px', maxWidth: '90%', maxHeight:'90vh', overflowY:'auto', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: '700', marginBottom: '25px', borderBottom: '1px solid #E5E5E5', paddingBottom: '15px', color: '#171717' }}>
          {editData ? '✏️ 장비 정보 수정' : '📦 신규 장비 등록'}
        </h2>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>장비 종류</label>
              <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })} style={inputStyle}>
                <option value="복합기">복합기</option>
                <option value="프린터">프린터</option>
                <option value="PC/노트북">PC/노트북</option>
                <option value="기타">기타</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>세부 구분</label>
              <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} style={inputStyle}>
                <option value="컬러겸용">컬러겸용</option>
                <option value="흑백전용">흑백전용</option>
                <option value="잉크젯">잉크젯</option>
                <option value="기타">기타</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>상태</label>
              <select value={formData.status} onChange={handleStatusChange} style={inputStyle}>
                <option value="창고">창고 (미설치)</option>
                <option value="수리중">수리중</option>
                <option value="폐기">폐기</option>
                <option value="분실">분실</option>
                <option value="설치">설치됨</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: formData.status === '설치' ? 'rgba(0, 112, 243, 0.05)' : '#FAFAFA', borderRadius: '8px', border: formData.status === '설치' ? '1px solid #0070f3' : '1px solid #E5E5E5' }}>
            <label style={{ ...labelStyle, color: formData.status === '설치' ? '#0070f3' : '#999' }}>
              🏢 설치된 거래처 {formData.status !== '설치' && '(설치 상태일 때만 활성)'}
            </label>
            <select
              value={formData.client_id}
              onChange={e => setFormData({...formData, client_id: e.target.value})}
              disabled={formData.status !== '설치'}
              style={{ ...inputStyle, backgroundColor: formData.status === '설치' ? '#FFFFFF' : '#F5F5F5', borderColor: formData.status === '설치' ? '#0070f3' : '#E5E5E5' }}
            >
              <option value="">거래처를 선택하세요</option>
              {clients.map(client => (<option key={client.id} value={client.id}>{client.name}</option>))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>브랜드</label>
              <input value={formData.brand} onChange={e => setFormData({ ...formData, brand: e.target.value })} placeholder="예: 삼성" style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>모델명 *</label>
              <input required value={formData.model_name} onChange={e => setFormData({ ...formData, model_name: e.target.value })} style={inputStyle} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '15px', marginBottom: '25px' }}>
            <div style={{ flex: 2 }}>
              <label style={labelStyle}>Serial Number (S/N) *</label>
              <input required value={formData.serial_number} onChange={e => setFormData({ ...formData, serial_number: e.target.value })} style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>제품 상태</label>
              <select value={formData.product_condition} onChange={e => setFormData({ ...formData, product_condition: e.target.value })} style={inputStyle}>
                <option value="새제품">새제품</option>
                <option value="중고">중고</option>
              </select>
            </div>
          </div>

          <div style={{ backgroundColor: '#FAFAFA', padding: '20px', borderRadius: '8px', marginBottom: '25px', border:'1px solid #E5E5E5' }}>
            <label style={{ display: 'block', marginBottom: '15px', fontSize: '0.95rem', fontWeight: '700', color: '#171717', borderBottom:'1px solid #E5E5E5', paddingBottom:'8px' }}>
              🔢 초기 카운터 (Meter Reading)
            </label>
            <div style={{ display: 'flex', gap: '15px', marginBottom:'15px' }}>
              <div style={{ flex: 1 }}>
                <label style={subLabelStyle}>흑백 A4</label>
                <input type="number" value={formData.initial_count_bw} onChange={e => setFormData({ ...formData, initial_count_bw: Number(e.target.value) })} style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={subLabelStyle}>칼라 A4</label>
                <input type="number" value={formData.initial_count_col} onChange={e => setFormData({ ...formData, initial_count_col: Number(e.target.value) })} style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '15px' }}>
              <div style={{ flex: 1 }}>
                <label style={subLabelStyle}>흑백 A3</label>
                <input type="number" value={formData.initial_count_bw_a3} onChange={e => setFormData({ ...formData, initial_count_bw_a3: Number(e.target.value) })} style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={subLabelStyle}>칼라 A3</label>
                <input type="number" value={formData.initial_count_col_a3} onChange={e => setFormData({ ...formData, initial_count_col_a3: Number(e.target.value) })} style={inputStyle} />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>매입일/제조일</label>
              <input type="date" value={formData.purchase_date} onChange={e => setFormData({ ...formData, purchase_date: e.target.value })} style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>매입가 (원)</label>
              <input type="number" value={formData.purchase_price} onChange={e => setFormData({ ...formData, purchase_price: Number(e.target.value) })} style={inputStyle} />
            </div>
          </div>

          <div style={{ marginBottom: '25px' }}>
            <label style={labelStyle}>비고 (특이사항)</label>
            <textarea
              value={formData.memo}
              onChange={e => setFormData({ ...formData, memo: e.target.value })}
              placeholder="특이사항을 입력하세요."
              style={{ ...inputStyle, height:'80px', resize:'none' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop:'1px solid #E5E5E5', paddingTop:'20px' }}>
            <button type="button" onClick={onClose} style={{ padding: '10px 24px', border: '1px solid #E5E5E5', background: '#FFFFFF', color:'#171717', borderRadius: '6px', cursor: 'pointer', fontWeight:'600' }}>취소</button>
            <button type="submit" disabled={loading} style={{ padding: '10px 24px', background: '#171717', color: '#FFFFFF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight:'600' }}>
              {loading ? '저장 중...' : (editData ? '수정 완료' : '장비 등록')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}