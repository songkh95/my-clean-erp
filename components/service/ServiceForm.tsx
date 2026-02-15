'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase'
import Button from '@/components/ui/Button'
import InputField from '@/components/ui/Input'
import styles from '@/app/service/service.module.css'
import { 
  getClientMachinesAction, 
  getConsumablesAction, 
  createServiceLogAction, 
  updateServiceLogAction, // 추가됨
  getEmployeesAction 
} from '@/app/actions/service'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  editData?: any // 수정할 데이터 (없으면 등록 모드)
}

export default function ServiceForm({ isOpen, onClose, onSuccess, editData }: Props) {
  const [loading, setLoading] = useState(false)
  const [clients, setClients] = useState<any[]>([])
  const [machines, setMachines] = useState<any[]>([])
  const [consumables, setConsumables] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])

  const initialForm = {
    client_id: '',
    inventory_id: '',
    status: '접수',
    service_type: 'A/S',
    visit_date: new Date().toISOString().split('T')[0],
    symptom: '',
    action_detail: '',
    meter_bw: 0,
    meter_col: 0,
    manager_id: ''
  }

  const [formData, setFormData] = useState(initialForm)
  const [usedParts, setUsedParts] = useState<{ consumable_id: string; quantity: number; max_stock: number }[]>([])

  const supabase = createClient()

  // 1. 기초 데이터 및 수정 데이터 로드
  useEffect(() => {
    if (!isOpen) return

    const loadData = async () => {
      const { data: clientData } = await supabase.from('clients').select('id, name').eq('is_deleted', false).order('name')
      if (clientData) setClients(clientData)

      const consumableData = await getConsumablesAction()
      setConsumables(consumableData)

      const employeeData = await getEmployeesAction()
      setEmployees(employeeData)

      // 수정 모드일 경우 데이터 세팅
      if (editData) {
        setFormData({
          client_id: editData.client_id || '',
          inventory_id: editData.inventory_id || '',
          status: editData.status || '접수',
          service_type: editData.service_type || 'A/S',
          visit_date: editData.visit_date || new Date().toISOString().split('T')[0],
          symptom: editData.symptom || '',
          action_detail: editData.action_detail || '',
          meter_bw: editData.meter_bw || 0,
          meter_col: editData.meter_col || 0,
          manager_id: editData.manager_id || ''
        })

        // 사용 부품 데이터 세팅
        if (editData.parts_usage) {
          const parts = editData.parts_usage.map((p: any) => ({
            consumable_id: p.consumable?.id,
            quantity: p.quantity,
            max_stock: p.consumable?.current_stock || 0
          }))
          setUsedParts(parts)
        }
        
        // 기기 목록도 미리 로드해둬야 함
        if (editData.client_id) {
          getClientMachinesAction(editData.client_id).then(setMachines)
        }
      } else {
        setFormData(initialForm)
        setUsedParts([])
      }
    }
    loadData()
  }, [isOpen, editData])

  // 2. 거래처 변경 시 기기 목록 갱신
  useEffect(() => {
    if (formData.client_id) {
      getClientMachinesAction(formData.client_id).then(setMachines)
    } else {
      setMachines([])
    }
  }, [formData.client_id])

  const addPartRow = () => {
    setUsedParts([...usedParts, { consumable_id: '', quantity: 1, max_stock: 0 }])
  }

  const updatePartRow = (index: number, field: string, value: any) => {
    const newParts = [...usedParts]
    if (field === 'consumable_id') {
      const selectedPart = consumables.find(c => c.id === value)
      newParts[index].consumable_id = value
      newParts[index].max_stock = selectedPart ? selectedPart.current_stock : 0
    } else {
      newParts[index].quantity = Number(value)
    }
    setUsedParts(newParts)
  }

  const removePartRow = (index: number) => {
    setUsedParts(usedParts.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.client_id) return alert('거래처를 선택해주세요.')
    if (!formData.manager_id) return alert('담당자를 선택해주세요.')

    setLoading(true)
    let result;

    if (editData) {
      // 수정 액션 호출
      result = await updateServiceLogAction(editData.id, formData, usedParts)
    } else {
      // 등록 액션 호출
      result = await createServiceLogAction(formData, usedParts)
    }
    
    if (result.success) {
      alert(editData ? '수정되었습니다.' : '저장되었습니다.')
      onSuccess()
      onClose()
    } else {
      alert('오류: ' + result.message)
    }
    setLoading(false)
  }

  if (!isOpen) return null

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <h2 style={{fontSize:'1.2rem', fontWeight:'bold', marginBottom:'20px'}}>
          {editData ? '✏️ 서비스 일지 수정' : '🛠️ 서비스 일지 작성'}
        </h2>
        
        <form onSubmit={handleSubmit}>
          <div className={styles.formGrid}>
            <InputField label="거래처 *" as="select" value={formData.client_id} onChange={e => setFormData({...formData, client_id: e.target.value})} disabled={!!editData}>
              <option value="">거래처 선택</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </InputField>

            <InputField label="대상 기기" as="select" value={formData.inventory_id} onChange={e => setFormData({...formData, inventory_id: e.target.value})} disabled={!formData.client_id}>
              <option value="">(기기 없음/일반 방문)</option>
              {machines.map(m => <option key={m.id} value={m.id}>{m.model_name} ({m.serial_number})</option>)}
            </InputField>
          </div>

          <div className={styles.formGrid}>
            <InputField label="방문일자 *" type="date" value={formData.visit_date} onChange={e => setFormData({...formData, visit_date: e.target.value})} />
            <InputField label="구분 *" as="select" value={formData.service_type} onChange={e => setFormData({...formData, service_type: e.target.value})}>
              <option value="A/S">A/S (수리)</option>
              <option value="정기점검">정기점검</option>
              <option value="설치">설치</option>
              <option value="철수">철수</option>
              <option value="배송">단순 배송</option>
            </InputField>
          </div>

          <div className={styles.formGrid}>
            <InputField label="상태 *" as="select" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
              <option value="접수">접수 (예정)</option>
              <option value="완료">완료 (처리됨)</option>
              <option value="보류">보류</option>
            </InputField>
            <InputField label="담당자 *" as="select" value={formData.manager_id} onChange={e => setFormData({...formData, manager_id: e.target.value})}>
              <option value="">직원 선택</option>
              {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
            </InputField>
          </div>

          <hr style={{margin:'20px 0', border:'none', borderTop:'1px solid #eee'}} />

          <InputField label="증상 / 요청사항" as="textarea" value={formData.symptom} onChange={e => setFormData({...formData, symptom: e.target.value})} style={{height:'60px'}} />
          <InputField label="조치 내용" as="textarea" value={formData.action_detail} onChange={e => setFormData({...formData, action_detail: e.target.value})} style={{height:'80px'}} />

          <div className={styles.formGrid}>
            <InputField label="확인 카운터 (흑백)" type="number" value={formData.meter_bw} onChange={e => setFormData({...formData, meter_bw: Number(e.target.value)})} />
            <InputField label="확인 카운터 (칼라)" type="number" value={formData.meter_col} onChange={e => setFormData({...formData, meter_col: Number(e.target.value)})} />
          </div>

          <div style={{backgroundColor:'#f9fafb', padding:'15px', borderRadius:'8px', marginTop:'10px'}}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'10px'}}>
              <span style={{fontWeight:'bold', fontSize:'0.9rem'}}>📦 사용 부품/소모품</span>
              <button type="button" onClick={addPartRow} style={{fontSize:'0.8rem', padding:'4px 8px', background:'#fff', border:'1px solid #ccc', borderRadius:'4px', cursor:'pointer'}}>+ 부품 추가</button>
            </div>
            
            {usedParts.map((part, idx) => (
              <div key={idx} style={{display:'flex', gap:'8px', marginBottom:'8px', alignItems:'center'}}>
                <select 
                  value={part.consumable_id} 
                  onChange={e => updatePartRow(idx, 'consumable_id', e.target.value)}
                  style={{flex:1, padding:'6px', borderRadius:'4px', border:'1px solid #ddd'}}
                >
                  <option value="">부품 선택</option>
                  {consumables.map(c => (
                    <option key={c.id} value={c.id}>{c.model_name} (현재:{c.current_stock})</option>
                  ))}
                </select>
                <input 
                  type="number" 
                  value={part.quantity} 
                  onChange={e => updatePartRow(idx, 'quantity', e.target.value)}
                  placeholder="수량"
                  style={{width:'60px', padding:'6px', borderRadius:'4px', border:'1px solid #ddd'}}
                />
                <button type="button" onClick={() => removePartRow(idx)} style={{color:'red', border:'none', background:'none', cursor:'pointer'}}>✖</button>
              </div>
            ))}
            {formData.status === '완료' && usedParts.length > 0 && (
              <p style={{fontSize:'0.75rem', color:'red', marginTop:'5px'}}>* '완료' 상태로 저장 시 재고가 차감됩니다.</p>
            )}
          </div>

          <div style={{display:'flex', justifyContent:'flex-end', gap:'8px', marginTop:'24px'}}>
            <Button variant="ghost" onClick={onClose} type="button">취소</Button>
            <Button variant="primary" type="submit" disabled={loading}>{editData ? '수정완료' : '저장하기'}</Button>
          </div>
        </form>
      </div>
    </div>
  )
}