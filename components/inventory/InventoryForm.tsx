'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase'
import Button from './../ui/Button'
import InputField from './../ui/Input'
import styles from './InventoryForm.module.css'
import { Inventory, Client } from '@/app/types'
// ✅ Server Actions 임포트
import { createInventoryAction, updateInventoryAction, normalizeInventoryModelNamesAction } from '@/app/actions/inventory'
import { loadAppSettings } from '@/utils/appSettings'
import SuggestInput from '@/components/ui/SuggestInput'
import { toMachineModelName } from '@/utils/suggestMatch'
import { calcContractEndDate } from '@/utils/clientInventoryExcel'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  editData?: Partial<Inventory> | null
}

interface InventoryFormState {
  type: string
  category: string
  brand: string
  model_name: string
  serial_number: string
  product_condition: string
  status: string
  client_id: string
  department: string
  purchase_date: string
  purchase_price: number
  initial_count_bw: number
  initial_count_col: number
  initial_count_bw_a3: number
  initial_count_col_a3: number
  memo: string
  billing_date: string
  plan_basic_fee: number
  plan_basic_cnt_bw: number
  plan_basic_cnt_col: number
  plan_price_bw: number
  plan_price_col: number
  plan_weight_a3_bw: number
  plan_weight_a3_col: number
  contract_type: string
  deposit: number
  sale_price: number
  contract_start_date: string
  contract_years: number
  contract_end_date: string
}

function buildInitialInventoryForm(): InventoryFormState {
  const s = loadAppSettings().inventory
  return {
    type: s.defaultMachineType,
    category: s.defaultCategory,
    brand: '',
    model_name: '',
    serial_number: '',
    product_condition: '새제품',
    status: s.defaultStatus,
    client_id: '',
    department: '',
    purchase_date: new Date().toISOString().split('T')[0],
    purchase_price: 0,
    initial_count_bw: 0,
    initial_count_col: 0,
    initial_count_bw_a3: 0,
    initial_count_col_a3: 0,
    memo: '',
    billing_date: s.defaultBillingDate,
    plan_basic_fee: 0,
    plan_basic_cnt_bw: 1000,
    plan_basic_cnt_col: 100,
    plan_price_bw: 10,
    plan_price_col: 100,
    plan_weight_a3_bw: 1,
    plan_weight_a3_col: 2,
    contract_type: '',
    deposit: 0,
    sale_price: 0,
    contract_start_date: '',
    contract_years: 0,
    contract_end_date: '',
  }
}

export default function InventoryForm({ isOpen, onClose, onSuccess, editData }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [clients, setClients] = useState<Client[]>([])
  const [snError, setSnError] = useState<string | null>(null)
  const [brandSuggestions, setBrandSuggestions] = useState<string[]>([])
  const [modelSuggestions, setModelSuggestions] = useState<Array<{ value: string; hint?: string }>>([])
  const [snSuggestions, setSnSuggestions] = useState<Array<{ value: string; hint?: string }>>([])

  const [formData, setFormData] = useState<InventoryFormState>(buildInitialInventoryForm)

  // 거래처 목록 + 기존 자산 자동완성 후보
  useEffect(() => {
    if (!isOpen) return

    const fetchClients = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
      
      if (profile?.organization_id) {
        const { data } = await supabase
          .from('clients')
          .select('id, name, organization_id')
          .eq('organization_id', profile.organization_id)
          .eq('is_deleted', false)
          .order('name')
        if (data) setClients(data as Client[])

        const { data: inv } = await supabase
          .from('inventory')
          .select('brand, model_name, serial_number, type')
          .eq('organization_id', profile.organization_id)

        const brands = Array.from(new Set((inv || []).map((i) => (i.brand || '').trim()).filter(Boolean)))
        setBrandSuggestions(brands)
        setModelSuggestions(
          (inv || [])
            .filter((i) => i.model_name)
            .map((i) => ({
              value: toMachineModelName(i.model_name),
              hint: [i.brand, i.type].filter(Boolean).join(' · ') || undefined,
            }))
        )
        setSnSuggestions(
          (inv || [])
            .filter((i) => i.serial_number)
            .map((i) => ({
              value: i.serial_number,
              hint: toMachineModelName(i.model_name || '') || undefined,
            }))
        )
      }
    }
    fetchClients()
    // 기존 모델명 대문자 일괄 정리 (한 번 실행, 변경 없으면 무해)
    normalizeInventoryModelNamesAction().catch(() => {})
  }, [isOpen])

  // 수정 모드일 때 데이터 세팅
  useEffect(() => {
    if (isOpen) {
      setSnError(null)
      const initialData = buildInitialInventoryForm()
      if (editData) {
        const { client, created_at, ...restData } = editData as any;

        setFormData({
          ...initialData,
          ...restData,
          client_id: editData.client_id || '',
          model_name: toMachineModelName(String(editData.model_name || restData.model_name || '')),
          // 매입일이 없으면 빈 값으로 두거나 오늘 날짜로 채움
          purchase_date: editData.purchase_date || '',
          billing_date: editData.billing_date || initialData.billing_date,
          purchase_price: editData.purchase_price ?? 0,
          plan_basic_fee: editData.plan_basic_fee ?? 0,
          plan_basic_cnt_bw: editData.plan_basic_cnt_bw ?? 0,
          plan_basic_cnt_col: editData.plan_basic_cnt_col ?? 0,
          plan_price_bw: editData.plan_price_bw ?? 0,
          plan_price_col: editData.plan_price_col ?? 0,
          plan_weight_a3_bw: editData.plan_weight_a3_bw ?? 1,
          plan_weight_a3_col: editData.plan_weight_a3_col ?? 1,
          contract_type: editData.contract_type || '',
          deposit: editData.deposit ?? 0,
          sale_price: editData.sale_price ?? 0,
          contract_start_date: editData.contract_start_date || '',
          contract_years: editData.contract_years ?? 0,
          contract_end_date: editData.contract_end_date || '',
        })
      } else {
        setFormData(initialData)
      }
    }
  }, [isOpen, editData])

  // S/N 중복 체크
  const checkSnDuplicate = async (sn: string) => {
    if (!sn.trim()) {
      setSnError(null)
      return false
    }

    let query = supabase.from('inventory').select('id').eq('serial_number', sn)
    
    if (editData?.id) {
      query = query.neq('id', editData.id)
    }

    const { data } = await query.maybeSingle()

    if (data) {
      setSnError('⚠️ 이미 등록된 S/N입니다.')
      return true
    } else {
      setSnError(null)
      return false
    }
  }

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
    
    if (!formData.brand.trim()) return alert('브랜드를 입력해주세요.')
    if (!formData.model_name.trim()) return alert('모델명을 입력해주세요.')
    if (!formData.serial_number.trim()) return alert('Serial Number(S/N)를 입력해주세요.')
    
    const isDuplicate = await checkSnDuplicate(formData.serial_number)
    if (isDuplicate) return alert('중복된 S/N입니다. 다른 번호를 입력해주세요.')

    if (formData.status === '설치' && !formData.client_id) return alert('설치 상태일 경우 거래처를 선택해야 합니다.')
    
    if (editData && editData.id) {
      if ((editData.status === '교체전(철수)' || editData.status === '설치') && formData.status === '창고') {
        alert("거래처에 등록된 기계는 직접 '창고'로 변경할 수 없습니다. [거래처 관리]에서 '철수' 기능을 이용하시거나 정산을 완료해주세요.");
        return;
      }
    }

    setLoading(true)
    try {
      // Payload 구성
      const payload = { 
        ...formData, 
        model_name: toMachineModelName(formData.model_name),
        client_id: formData.client_id || null,
        // 빈 문자열일 경우 null로 처리하여 DB 에러 방지
        purchase_date: formData.purchase_date === '' ? null : formData.purchase_date,
        purchase_price: Number(formData.purchase_price) || 0,
        plan_basic_fee: Number(formData.plan_basic_fee),
        plan_basic_cnt_bw: Number(formData.plan_basic_cnt_bw),
        plan_basic_cnt_col: Number(formData.plan_basic_cnt_col),
        plan_price_bw: Number(formData.plan_price_bw),
        plan_price_col: Number(formData.plan_price_col),
        plan_weight_a3_bw: Number(formData.plan_weight_a3_bw),
        plan_weight_a3_col: Number(formData.plan_weight_a3_col),
        contract_type: formData.contract_type || null,
        deposit: Number(formData.deposit) || 0,
        sale_price: Number(formData.sale_price) || 0,
        contract_years: formData.contract_years > 0 ? Number(formData.contract_years) : null,
        contract_start_date: formData.contract_start_date === '' ? null : formData.contract_start_date,
        contract_end_date: formData.contract_end_date === '' ? null : formData.contract_end_date,
      }

      if (!payload.model_name) {
        setLoading(false)
        return alert('모델명은 영어 대문자·숫자만 입력할 수 있습니다.')
      }

      // ✅ Server Action 호출
      let result;
      if (editData?.id) {
        result = await updateInventoryAction(editData.id, payload)
      } else {
        result = await createInventoryAction(payload)
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
      alert('오류: ' + message) 
    } finally { 
      setLoading(false) 
    }
  }

  if (!isOpen) return null

  const isEditMode = !!editData?.id;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <h2 className={styles.title}>{isEditMode ? '✏️ 장비 수정' : '📦 신규 등록'}</h2>
        <form onSubmit={handleSubmit}>
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
            <InputField label="🏢 설치 거래처 (현재 위치)" as="select" disabled={formData.status !== '설치'} value={formData.client_id} onChange={e => setFormData({ ...formData, client_id: e.target.value })} style={{ marginBottom: 16 }}>
              <option value="">거래처 선택</option>
              {clients.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </InputField>

            {formData.status === '설치' && (
              <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px dashed #0070f3' }}>
                <div className={styles.sectionTitle} style={{ color: '#0070f3' }}>📅 계약 · 요금제 설정</div>

                <div className={styles.grid2} style={{ marginBottom: 0 }}>
                  <InputField
                    label="계약구분"
                    as="select"
                    value={formData.contract_type}
                    onChange={e => setFormData({ ...formData, contract_type: e.target.value })}
                  >
                    <option value="">선택</option>
                    <option value="임대">임대</option>
                    <option value="판매">판매</option>
                    <option value="유지보수">유지보수</option>
                  </InputField>
                  <InputField
                    label="보증금"
                    type="number"
                    value={formData.deposit}
                    onChange={e => setFormData({ ...formData, deposit: Number(e.target.value) })}
                  />
                </div>
                <div className={styles.grid2} style={{ marginBottom: 0 }}>
                  <InputField
                    label="판매금액"
                    type="number"
                    value={formData.sale_price}
                    onChange={e => setFormData({ ...formData, sale_price: Number(e.target.value) })}
                  />
                  <InputField
                    label="계약년수"
                    type="number"
                    step="0.5"
                    value={formData.contract_years}
                    onChange={e => {
                      const years = Number(e.target.value)
                      const end = calcContractEndDate(formData.contract_start_date, years)
                      setFormData({
                        ...formData,
                        contract_years: years,
                        ...(end ? { contract_end_date: end } : {}),
                      })
                    }}
                  />
                </div>
                <div className={styles.grid2} style={{ marginBottom: 0 }}>
                  <InputField
                    label="계약 시작일"
                    type="date"
                    value={formData.contract_start_date}
                    onChange={e => {
                      const start = e.target.value
                      const end = formData.contract_years > 0
                        ? calcContractEndDate(start, formData.contract_years)
                        : null
                      setFormData({
                        ...formData,
                        contract_start_date: start,
                        ...(end ? { contract_end_date: end } : {}),
                      })
                    }}
                  />
                  <InputField
                    label="계약 종료일"
                    type="date"
                    value={formData.contract_end_date}
                    onChange={e => setFormData({ ...formData, contract_end_date: e.target.value })}
                  />
                </div>
                
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

          {/* 🔴 추가된 부분: 매입일 및 매입가 입력 */}
          <div className={styles.highlightBox}>
            <div className={styles.sectionTitle} style={{ color: '#171717', marginBottom:'10px' }}>💰 자산 매입 정보</div>
            <div className={styles.grid2} style={{ marginBottom: 0 }}>
              <InputField 
                label="매입일 (설치일 아님)" 
                type="date" 
                value={formData.purchase_date} 
                onChange={e => setFormData({ ...formData, purchase_date: e.target.value })} 
              />
              <InputField 
                label="매입가 (원)" 
                type="number" 
                placeholder="0"
                value={formData.purchase_price} 
                onChange={e => setFormData({ ...formData, purchase_price: Number(e.target.value) })} 
              />
            </div>
          </div>

          <div className={styles.grid2}>
            <SuggestInput
              label="브랜드 *"
              required
              value={formData.brand}
              suggestions={brandSuggestions}
              onChange={(v) => setFormData({ ...formData, brand: v })}
              placeholder="예: FUJI XEROX"
            />
            <SuggestInput
              label="모델명 * (영문 대문자)"
              required
              value={formData.model_name}
              suggestions={modelSuggestions}
              transform={toMachineModelName}
              onChange={(v) => setFormData({ ...formData, model_name: v })}
              placeholder="예: APEOS C3060"
              style={{ textTransform: 'uppercase' }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <SuggestInput
              label="S/N *"
              required
              value={formData.serial_number}
              suggestions={snSuggestions}
              onChange={(v) => setFormData({ ...formData, serial_number: v })}
              style={{ marginBottom: snError ? '4px' : '0' }}
            />
            {snError && (
              <div style={{ color: '#d93025', fontSize: '0.8rem', fontWeight: '500', paddingLeft: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                {snError}
              </div>
            )}
          </div>

          <InputField
            label="부서 (호출명)"
            placeholder="예: 총무팀, 1층 데스크"
            value={formData.department}
            onChange={(e) => setFormData({ ...formData, department: e.target.value })}
          />

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