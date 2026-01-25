'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase'
import styles from './ClientForm.module.css'

export default function ClientForm({ onSuccess }: { onSuccess: () => void }) {
  const [isOpen, setIsOpen] = useState(true)
  const supabase = createClient()

  const [formData, setFormData] = useState({
    name: '', business_number: '', representative_name: '', contact_person: '',
    phone: '', office_phone: '', email: '', address: '',
    parent_id: '', status: '정상', popup_memo: '',
    // 🔴 [추가] 요금 및 청구 관련 필드
    billing_date: '말일',
    is_rollover: false,
    basic_fee: 0,
    basic_cnt_bw: 1000,
    basic_cnt_col: 100,
    extra_cost_bw: 10,
    extra_cost_col: 100,
    weight_a3_bw: 1,
    weight_a3_col: 2
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
      alert('🎉 거래처 등록 성공!')
      // 초기화
      setFormData({
        name: '', business_number: '', representative_name: '', contact_person: '',
        phone: '', office_phone: '', email: '', address: '',
        parent_id: '', status: '정상', popup_memo: '',
        billing_date: '말일', is_rollover: false,
        basic_fee: 0, basic_cnt_bw: 1000, basic_cnt_col: 100,
        extra_cost_bw: 10, extra_cost_col: 100, weight_a3_bw: 1, weight_a3_col: 2
      })
      setParentSearch('현재 거래처가 본사')
      onSuccess()
    } else {
      alert('오류 발생: ' + error.message)
    }
  }

  // 스타일 헬퍼
  const SectionTitle = ({ title }: { title: string }) => (
    <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#0070f3', marginTop: '15px', marginBottom: '8px', borderBottom: '1px solid #eee', paddingBottom: '4px' }}>
      {title}
    </div>
  )

  return (
    <div className={styles.container}>
      <div onClick={() => setIsOpen(!isOpen)} className={`${styles.header} ${isOpen ? styles.headerOpen : ''}`}>
        <span>➕ 신규 거래처 등록</span>
        <span>{isOpen ? '▲' : '▼'}</span>
      </div>

      {isOpen && (
        <form onSubmit={handleSubmit} className={styles.form}>
          <SectionTitle title="1. 기본 정보" />
          
          <input placeholder="업체명 (필수)" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required className={styles.input} />
          
          <div className={styles.relativeContainer}>
            <label className={styles.labelSmall}>본사 지정</label>
            <input 
              value={parentSearch} onChange={handleSearch}
              onFocus={() => { if(parentSearch === '현재 거래처가 본사') setParentSearch('') }}
              onBlur={() => setTimeout(() => { if(!formData.parent_id) setParentSearch('현재 거래처가 본사'); setShowDropdown(false) }, 200)}
              className={`${styles.input} ${formData.parent_id ? styles.inputHighlight : ''}`}
            />
            {showDropdown && filteredResults.length > 0 && (
              <div className={styles.dropdownMenu}>
                {filteredResults.map(c => (
                  <div key={c.id} onClick={() => { setFormData({...formData, parent_id: c.id}); setParentSearch(c.name); setShowDropdown(false); }} className={styles.dropdownItem}>{c.name}</div>
                ))}
              </div>
            )}
          </div>

          <div className={styles.row}>
            <input placeholder="사업자번호" value={formData.business_number} onChange={e => setFormData({...formData, business_number: e.target.value})} className={styles.input} />
            <input placeholder="대표자명" value={formData.representative_name} onChange={e => setFormData({...formData, representative_name: e.target.value})} className={styles.input} />
          </div>
          <div className={styles.row}>
            <input placeholder="담당자명" value={formData.contact_person} onChange={e => setFormData({...formData, contact_person: e.target.value})} className={styles.input} />
            <input placeholder="휴대폰" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className={styles.input} />
          </div>
          <div className={styles.row}>
            <input placeholder="사무실" value={formData.office_phone} onChange={e => setFormData({...formData, office_phone: e.target.value})} className={styles.input} />
            <input type="email" placeholder="이메일" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className={styles.input} />
          </div>
          <input placeholder="주소" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className={styles.input} />
          <textarea placeholder="알림메모" value={formData.popup_memo} onChange={e => setFormData({...formData, popup_memo: e.target.value})} className={styles.textarea} style={{height: '50px'}} />

          {/* 🔴 [추가] 요금제 설정 섹션 */}
          <SectionTitle title="2. 정산 및 요금제 설정" />
          
          <div className={styles.row}>
            <div style={{width: '50%'}}>
              <label className={styles.labelSmall}>청구일</label>
              <select value={formData.billing_date} onChange={e => setFormData({...formData, billing_date: e.target.value})} className={styles.input}>
                <option value="말일">말일 (자동계산)</option>
                {Array.from({length: 31}, (_, i) => i + 1).map(d => (
                  <option key={d} value={d}>{d}일</option>
                ))}
              </select>
            </div>
            <div style={{width: '50%', display: 'flex', alignItems: 'center', gap: '8px'}}>
              <input type="checkbox" checked={formData.is_rollover} onChange={e => setFormData({...formData, is_rollover: e.target.checked})} id="rollover" style={{width:'20px', height:'20px'}} />
              <label htmlFor="rollover" style={{fontSize: '0.9rem'}}>남은 매수 이월 사용</label>
            </div>
          </div>

          <div className={styles.row}>
            <div style={{width: '100%'}}>
              <label className={styles.labelSmall}>기본 렌탈료 (월)</label>
              <input type="number" value={formData.basic_fee} onChange={e => setFormData({...formData, basic_fee: Number(e.target.value)})} className={styles.input} />
            </div>
          </div>

          <div className={styles.row}>
            <div style={{width: '50%'}}>
              <label className={styles.labelSmall}>흑백 기본매수 (장)</label>
              <input type="number" value={formData.basic_cnt_bw} onChange={e => setFormData({...formData, basic_cnt_bw: Number(e.target.value)})} className={styles.input} />
            </div>
            <div style={{width: '50%'}}>
              <label className={styles.labelSmall}>칼라 기본매수 (장)</label>
              <input type="number" value={formData.basic_cnt_col} onChange={e => setFormData({...formData, basic_cnt_col: Number(e.target.value)})} className={styles.input} />
            </div>
          </div>

          <div className={styles.row}>
            <div style={{width: '50%'}}>
              <label className={styles.labelSmall}>흑백 추가요금 (장당)</label>
              <input type="number" value={formData.extra_cost_bw} onChange={e => setFormData({...formData, extra_cost_bw: Number(e.target.value)})} className={styles.input} />
            </div>
            <div style={{width: '50%'}}>
              <label className={styles.labelSmall}>칼라 추가요금 (장당)</label>
              <input type="number" value={formData.extra_cost_col} onChange={e => setFormData({...formData, extra_cost_col: Number(e.target.value)})} className={styles.input} />
            </div>
          </div>

          <div className={styles.row}>
            <div style={{width: '50%'}}>
              <label className={styles.labelSmall}>흑백 A3 가중치 (배)</label>
              <input type="number" value={formData.weight_a3_bw} onChange={e => setFormData({...formData, weight_a3_bw: Number(e.target.value)})} className={styles.input} />
            </div>
            <div style={{width: '50%'}}>
              <label className={styles.labelSmall}>칼라 A3 가중치 (배)</label>
              <input type="number" value={formData.weight_a3_col} onChange={e => setFormData({...formData, weight_a3_col: Number(e.target.value)})} className={styles.input} />
            </div>
          </div>
          
          <button type="submit" className={styles.submitBtn}>등록하기</button>
        </form>
      )}
    </div>
  )
}