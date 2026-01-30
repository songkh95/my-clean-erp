'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase'
import Button from './../ui/Button'
import InputField from './../ui/Input'
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
  
  // S/N 중복 에러 상태 관리
  const [snError, setSnError] = useState<string | null>(null)

  // 폼 데이터 초기값 (요청하신 종류/구분 기본값 반영)
  const initialData = {
    type: 'A3 레이저복합기', 
    category: '컬러',
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
    memo: '',
    // 요금제 관련 필드
    billing_date: '말',
    plan_basic_fee: 0,
    plan_basic_cnt_bw: 1000,
    plan_basic_cnt_col: 100,
    plan_price_bw: 10,
    plan_price_col: 100,
    plan_weight_a3_bw: 1,
    plan_weight_a3_col: 2
  }

  const [formData, setFormData] = useState(initialData)

  // 거래처 목록 불러오기
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

  // 폼 열릴 때 데이터 설정
  useEffect(() => {
    if (isOpen) {
      setSnError(null) // 에러 초기화
      if (editData) {
        setFormData({
          ...initialData,
          ...editData,
          client_id: editData.client_id || '',
          purchase_date: editData.purchase_date || '',
          billing_date: editData.billing_date || '말일',
          plan_basic_fee: editData.plan_basic_fee || 0,
          plan_basic_cnt_bw: editData.plan_basic_cnt_bw || 0,
          plan_basic_cnt_col: editData.plan_basic_cnt_col || 0,
          plan_price_bw: editData.plan_price_bw || 0,
          plan_price_col: editData.plan_price_col || 0,
          plan_weight_a3_bw: editData.plan_weight_a3_bw || 1,
          plan_weight_a3_col: editData.plan_weight_a3_col || 1
        })
      } else {
        setFormData(initialData)
      }
    }
  }, [isOpen, editData])

  // ✨ S/N 중복 체크 함수 (boolean 반환 추가)
  const checkSnDuplicate = async (sn: string) => {
    if (!sn.trim()) {
      setSnError(null)
      return false
    }

    // 수정 모드일 경우 자기 자신은 제외하고 체크
    let query = supabase
      .from('inventory')
      .select('id')
      .eq('serial_number', sn)
    
    if (editData && editData.id) {
      query = query.neq('id', editData.id)
    }

    const { data } = await query.maybeSingle()

    if (data) {
      setSnError('⚠️ 이미 등록된 S/N입니다.')
      return true // 중복임
    } else {
      setSnError(null)
      return false // 중복 아님
    }
  }

  // ✨ 실시간 중복 체크 (useEffect 사용)
  // 사용자가 타이핑할 때마다 검사 (0.3초 디바운스 적용하여 부하 방지)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (formData.serial_number) {
        checkSnDuplicate(formData.serial_number)
      } else {
        setSnError(null)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [formData.serial_number])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // ✨ 필수값 검증 (브랜드, 모델명, S/N)
    if (!formData.brand.trim()) return alert('브랜드를 입력해주세요.')
    if (!formData.model_name.trim()) return alert('모델명을 입력해주세요.')
    if (!formData.serial_number.trim()) return alert('Serial Number(S/N)를 입력해주세요.')
    
    // ✨ 저장 직전 최종 S/N 중복 체크 (타이핑 후 바로 엔터 치는 경우 대비)
    const isDuplicate = await checkSnDuplicate(formData.serial_number)
    if (isDuplicate) return alert('중복된 S/N입니다. 다른 번호를 입력해주세요.')

    if (formData.status === '설치' && !formData.client_id) return alert('설치 상태일 경우 거래처를 선택해야 합니다.')
    
    // 상태 변경 유효성 검사 (수정 모드일 때만)
    if (editData && editData.id) {
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
        plan_basic_fee: Number(formData.plan_basic_fee),
        plan_basic_cnt_bw: Number(formData.plan_basic_cnt_bw),
        plan_basic_cnt_col: Number(formData.plan_basic_cnt_col),
        plan_price_bw: Number(formData.plan_price_bw),
        plan_price_col: Number(formData.plan_price_col),
        plan_weight_a3_bw: Number(formData.plan_weight_a3_bw),
        plan_weight_a3_col: Number(formData.plan_weight_a3_col),
        last_status_updated_at: new Date().toISOString()
      }

      const isEditMode = editData && editData.id;

      const { error } = isEditMode
        ? await supabase.from('inventory').update(payload).eq('id', editData.id) 
        : await supabase.from('inventory').insert(payload)
      
      if (error) throw error
      onSuccess(); onClose()
    } catch (error: any) { alert('오류: ' + error.message) } finally { setLoading(false) }
  }

  if (!isOpen) return null

  const isEditMode = editData && editData.id;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <h2 className={styles.title}>{isEditMode ? '✏️ 장비 수정' : '📦 신규 등록'}</h2>
        <form onSubmit={handleSubmit}>
          {/* ✨ 요청하신 종류 및 구분 옵션 업데이트 */}
          <div className={styles.grid3}>
            <InputField label="종류" as="select" value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}>
              <option value="A3 레이저복합기">A3 레이저복합기</option>
              <option value="A4 레이저복합기">A4 레이저복합기</option>
              <option value="A3 레이저프린터">A3 레이저프린터</option>
              <option value="A4 레이저프린터">A4 레이저프린터</option>
              <option value="A3 잉크젯복합기">A3 잉크젯복합기</option>
              <option value="A4 잉크젯복합기">A4 잉크젯복합기</option>
              <option value="A3 잉크젯프린터">A3 잉크젯프린터</option>
              <option value="A4 잉크젯프린터">A4 잉크젯프린터</option>
            </InputField>
            <InputField label="구분" as="select" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
              <option value="컬러">컬러</option>
              <option value="흑백">흑백</option>
            </InputField>
            <InputField label="상태" as="select" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value, client_id: e.target.value === '설치' ? formData.client_id : '' })}>
              <option value="창고">창고</option><option value="설치">설치됨</option>
              <option value="수리중">수리중</option><option value="폐기">폐기</option>
              <option value="교체전(철수)">교체전(철수)</option>
            </InputField>
          </div>

          <div className={`${styles.highlightBox} ${formData.status === '설치' ? styles.activeBox : ''}`}>
            <InputField label="🏢 설치 거래처" as="select" disabled={formData.status !== '설치'} value={formData.client_id} onChange={e => setFormData({ ...formData, client_id: e.target.value })} style={{ marginBottom: 16 }}>
              <option value="">거래처 선택</option>
              {clients.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </InputField>

            {/* 상태가 '설치'일 때만 요금제 입력란 표시 */}
            {formData.status === '설치' && (
              <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px dashed #0070f3' }}>
                <div className={styles.sectionTitle} style={{ color: '#0070f3' }}>💰 요금제 설정</div>
                
                <InputField 
                  label="매월 청구일" 
                  as="select" 
                  value={formData.billing_date} 
                  onChange={e => setFormData({ ...formData, billing_date: e.target.value })}
                >
                  <option value="말일">매월 말일</option>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                    <option key={day} value={String(day)}>매월 {day}일</option>
                  ))}
                </InputField>

                <InputField label="월 기본료 (원)" type="number" value={formData.plan_basic_fee} onChange={e => setFormData({...formData, plan_basic_fee: Number(e.target.value)})} />

                <div className={styles.grid2} style={{ marginBottom: 0 }}>
                  <InputField label="흑백 무료매수" type="number" value={formData.plan_basic_cnt_bw} onChange={e => setFormData({...formData, plan_basic_cnt_bw: Number(e.target.value)})} />
                  <InputField label="칼라 무료매수" type="number" value={formData.plan_basic_cnt_col} onChange={e => setFormData({...formData, plan_basic_cnt_col: Number(e.target.value)})} />
                </div>
                <div className={styles.grid2} style={{ marginBottom: 0 }}>
                  <InputField label="흑백 초과단가" type="number" value={formData.plan_price_bw} onChange={e => setFormData({...formData, plan_price_bw: Number(e.target.value)})} />
                  <InputField label="칼라 초과단가" type="number" value={formData.plan_price_col} onChange={e => setFormData({...formData, plan_price_col: Number(e.target.value)})} />
                </div>

                <details style={{ marginTop: '12px' }}>
                  <summary style={{ cursor: 'pointer', fontSize: '0.8rem', color: '#666', fontWeight: '500' }}>A3 가중치 설정 (기본 1배) ▼</summary>
                  <div className={styles.grid2} style={{ marginTop: '10px', marginBottom: 0 }}>
                    <InputField label="A3 흑백 배수" type="number" step="0.1" value={formData.plan_weight_a3_bw} onChange={e => setFormData({...formData, plan_weight_a3_bw: Number(e.target.value)})} />
                    <InputField label="A3 칼라 배수" type="number" step="0.1" value={formData.plan_weight_a3_col} onChange={e => setFormData({...formData, plan_weight_a3_col: Number(e.target.value)})} />
                  </div>
                </details>
              </div>
            )}
          </div>

          <div className={styles.grid2}>
            {/* ✨ 필수값 명시 */}
            <InputField 
              label="브랜드 *" 
              required
              value={formData.brand} 
              onChange={e => setFormData({ ...formData, brand: e.target.value })} 
            />
            <InputField 
              label="모델명 *" 
              required
              value={formData.model_name} 
              onChange={e => setFormData({ ...formData, model_name: e.target.value })} 
            />
          </div>

          {/* ✨ S/N 실시간 중복 체크 및 경고 표시 */}
          <div style={{ marginBottom: '16px' }}>
            <InputField 
              label="S/N *" 
              required
              value={formData.serial_number} 
              style={{ marginBottom: snError ? '4px' : '0' }}
              onChange={e => setFormData({ ...formData, serial_number: e.target.value })}
            />
            {snError && (
              <div style={{ color: '#d93025', fontSize: '0.8rem', fontWeight: '500', paddingLeft: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                {snError}
              </div>
            )}
          </div>

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