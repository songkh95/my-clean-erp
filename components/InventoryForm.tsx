'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase'
import styles from './InventoryForm.module.css'

// 🔴 [수정 포인트 1] FormField를 메인 함수 밖으로 뺐습니다.
// 이렇게 해야 입력할 때마다 컴포넌트가 파괴되지 않아 포커스가 유지됩니다.
const FormField = ({ label, children }: { label: string, children: React.ReactNode }) => (
  <div className={styles.fieldContainer}>
    <div className={styles.label}>{label}</div>
    {children}
  </div>
)

export default function InventoryForm({ type, onSuccess }: { type: string, onSuccess: () => void }) {
  const supabase = createClient()
  const [isOpen, setIsOpen] = useState(true)

  // 폼 데이터 상태
  const [formData, setFormData] = useState({
    category: '', brand: '', model_name: '', serial_number: '', 
    status: '창고', client_id: '', purchase_price: '', memo: '',
    product_condition: '새제품', // 기본값
    initial_count_bw: 0,
    initial_count_col: 0,
    initial_count_bw_a3: 0,
    initial_count_col_a3: 0
  })

  const [clients, setClients] = useState<any[]>([])
  const [existingBrands, setExistingBrands] = useState<string[]>([]) 
  const [existingModels, setExistingModels] = useState<string[]>([])

  useEffect(() => {
    const loadData = async () => {
      // 거래처 목록 불러오기
      const { data: cData } = await supabase.from('clients').select('id, name')
      if (cData) setClients(cData)

      // 기존 브랜드 목록 불러오기 (자동완성용)
      const { data: bData } = await supabase.from('inventory').select('brand')
      if (bData) {
        const brands = bData.map(d => d.brand).filter(b => b) as string[]
        setExistingBrands(Array.from(new Set(brands)))
      }

      // 기존 모델명 목록 불러오기 (자동완성용)
      const { data: mData } = await supabase.from('inventory').select('model_name')
      if (mData) {
        setExistingModels(Array.from(new Set(mData.map(d => d.model_name))))
      }
    }
    loadData()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (formData.status === '설치' && !formData.client_id) {
      alert("⚠️ 상태가 '설치'일 경우, 설치처를 반드시 선택해야 합니다.")
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user?.id).single()

    // 새제품일 경우 초기 카운터 강제 0 처리
    const finalData = {
      ...formData,
      initial_count_bw: formData.product_condition === '새제품' ? 0 : formData.initial_count_bw,
      initial_count_col: formData.product_condition === '새제품' ? 0 : formData.initial_count_col,
      initial_count_bw_a3: formData.product_condition === '새제품' ? 0 : formData.initial_count_bw_a3,
      initial_count_col_a3: formData.product_condition === '새제품' ? 0 : formData.initial_count_col_a3,
    }

    const { error } = await supabase.from('inventory').insert({
      ...finalData,
      type,
      client_id: formData.client_id || null, 
      purchase_price: formData.purchase_price || null,
      organization_id: profile?.organization_id
    })

    if (!error) {
      alert('등록 성공!')
      // 초기화
      setFormData({ 
        category: '', brand: '', model_name: '', serial_number: '', status: '창고', client_id: '', purchase_price: '', memo: '',
        product_condition: '새제품',
        initial_count_bw: 0, initial_count_col: 0, initial_count_bw_a3: 0, initial_count_col_a3: 0
      })
      onSuccess()
    } else {
      alert('등록 실패: ' + error.message)
    }
  }

  // 🔴 [수정 포인트 2] FormField 정의가 여기서 삭제되고 맨 위로 이동했습니다.

  return (
    <div className={styles.container}>
      <div onClick={() => setIsOpen(!isOpen)} className={styles.header}>
        <span>➕ {type} 추가</span>
        <span>{isOpen ? '▲' : '▼'}</span>
      </div>

      {isOpen && (
        <form onSubmit={handleSubmit} className={styles.formContainer}>
          
          {/* 분류 선택 */}
          <FormField label="분류*">
            <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className={styles.input} required>
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

          {/* 브랜드 입력 (자동완성 리스트 포함) */}
          <FormField label="브랜드*">
            <input 
              list="brands" 
              value={formData.brand} 
              onChange={e => setFormData({...formData, brand: e.target.value})} 
              className={styles.input} 
              placeholder="예: 신도리코, 삼성" 
              required
            />
            <datalist id="brands">
              {existingBrands.map((b, i) => <option key={i} value={b} />)}
            </datalist>
          </FormField>

          {/* 모델명 입력 (자동완성 리스트 포함) */}
          <FormField label="모델명*">
             <input 
              list="models"
              value={formData.model_name} 
              onChange={e => setFormData({...formData, model_name: e.target.value})} 
              className={styles.input} 
              required
            />
            <datalist id="models">
              {existingModels.map((m, i) => <option key={i} value={m} />)}
            </datalist>
          </FormField>

          {/* S/N 입력 */}
          <FormField label="Serial No.*">
            <input 
              value={formData.serial_number} 
              onChange={e => setFormData({...formData, serial_number: e.target.value})} 
              className={styles.input} 
              required
            />
          </FormField>

          {/* 제품 상태 (새제품/중고) */}
          <FormField label="제품 상태*">
            <div style={{display:'flex', gap:'20px', padding:'5px 0'}}>
              <label style={{cursor:'pointer', display:'flex', alignItems:'center'}}>
                <input 
                  type="radio" 
                  name="condition" 
                  checked={formData.product_condition === '새제품'}
                  onChange={() => setFormData({...formData, product_condition: '새제품'})}
                  style={{marginRight:'5px'}}
                /> 새제품 (초기값 0)
              </label>
              <label style={{cursor:'pointer', display:'flex', alignItems:'center'}}>
                <input 
                  type="radio" 
                  name="condition" 
                  checked={formData.product_condition === '중고'}
                  onChange={() => setFormData({...formData, product_condition: '중고'})}
                  style={{marginRight:'5px'}}
                /> 중고 (초기값 입력)
              </label>
            </div>
          </FormField>

          {/* 초기 카운터 (중고일 때만 보임) */}
          {formData.product_condition === '중고' && (
            <div style={{backgroundColor:'#f9f9f9', padding:'10px', borderRadius:'8px', marginBottom:'15px', border:'1px solid #eee'}}>
              <div style={{fontSize:'0.9rem', fontWeight:'bold', marginBottom:'10px', color:'#555'}}>🔢 초기 카운터 설정 (중고)</div>
              <div style={{display:'flex', gap:'10px', marginBottom:'10px'}}>
                <div style={{flex:1}}>
                   <span style={{fontSize:'0.8rem', color:'#666'}}>흑백</span>
                   <input type="number" value={formData.initial_count_bw} onChange={e => setFormData({...formData, initial_count_bw: Number(e.target.value)})} className={styles.input} />
                </div>
                <div style={{flex:1}}>
                   <span style={{fontSize:'0.8rem', color:'#666'}}>칼라</span>
                   <input type="number" value={formData.initial_count_col} onChange={e => setFormData({...formData, initial_count_col: Number(e.target.value)})} className={styles.input} />
                </div>
              </div>
              <div style={{display:'flex', gap:'10px'}}>
                <div style={{flex:1}}>
                   <span style={{fontSize:'0.8rem', color:'#666'}}>흑백(A3)</span>
                   <input type="number" value={formData.initial_count_bw_a3} onChange={e => setFormData({...formData, initial_count_bw_a3: Number(e.target.value)})} className={styles.input} />
                </div>
                <div style={{flex:1}}>
                   <span style={{fontSize:'0.8rem', color:'#666'}}>칼라(A3)</span>
                   <input type="number" value={formData.initial_count_col_a3} onChange={e => setFormData({...formData, initial_count_col_a3: Number(e.target.value)})} className={styles.input} />
                </div>
              </div>
            </div>
          )}

          {/* 설치 상태 (창고/설치/수리중/폐기) */}
          <FormField label="현재 위치(상태)">
            <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className={styles.input}>
              <option value="창고">창고 (보관중)</option>
              <option value="설치">설치 (거래처)</option>
              <option value="수리중">수리중</option>
              <option value="폐기">폐기</option>
            </select>
          </FormField>

          {/* 설치처 (상태가 '설치'일 때만 보임) */}
          {formData.status === '설치' && (
            <FormField label="설치된 거래처*">
              <select value={formData.client_id} onChange={e => setFormData({...formData, client_id: e.target.value})} className={styles.input} required>
                <option value="">거래처를 선택하세요</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </FormField>
          )}

          {/* 매입가 & 메모 */}
          <FormField label="매입가">
            <input type="number" value={formData.purchase_price} onChange={e => setFormData({...formData, purchase_price: e.target.value})} className={styles.input} placeholder="숫자만 입력" />
          </FormField>

          <FormField label="메모">
            <input value={formData.memo} onChange={e => setFormData({...formData, memo: e.target.value})} className={styles.input} placeholder="특이사항" />
          </FormField>

          <button type="submit" className={styles.submitBtn}>등록완료</button>
        </form>
      )}
    </div>
  )
}