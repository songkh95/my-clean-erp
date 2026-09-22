'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase'
import Button from '@/components/ui/Button'
import InputField from '@/components/ui/Input'
import { Inventory } from '@/app/types'
// ✅ Server Action 임포트
import { replaceInventoryAction } from '@/app/actions/inventory'

interface Props {
  oldAsset: Inventory
  clientId: string
  onClose: () => void
  onSuccess: () => void
}

export default function MachineReplaceModal({ oldAsset, clientId, onClose, onSuccess }: Props) {
  const supabase = createClient()
  
  const [loading, setLoading] = useState(false)
  const [warehouseItems, setWarehouseItems] = useState<Inventory[]>([])
  
  // 계약 조건 모드: 'inherit'(기존승계) | 'new'(신규적용)
  const [planMode, setPlanMode] = useState<'inherit' | 'new'>('inherit')

  // 폼 데이터 상태
  const [formData, setFormData] = useState({
    // 카운터 정보
    final_bw: 0, final_col: 0, final_bw_a3: 0, final_col_a3: 0,
    new_asset_id: '',
    new_initial_bw: 0, new_initial_col: 0, new_initial_bw_a3: 0, new_initial_col_a3: 0,
    
    // 계약 기간 (기본값: 오늘)
    contract_start_date: new Date().toISOString().split('T')[0], 
    contract_end_date: '',
    
    // 요금제 정보
    plan_basic_fee: 0,
    plan_basic_cnt_bw: 0,
    plan_basic_cnt_col: 0,
    plan_price_bw: 0,
    plan_price_col: 0,
    plan_weight_a3_bw: 1,
    plan_weight_a3_col: 1,
    
    memo: ''
  })

  useEffect(() => {
    fetchWarehouseItems()
    // 초기 로드시 기존 기계 정보로 셋업 (승계 모드)
    applyOldPlan()
  }, [])

  const fetchWarehouseItems = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
    
    if (profile?.organization_id) {
      const { data } = await supabase
        .from('inventory')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .eq('status', '창고')
      
      if (data) setWarehouseItems(data as Inventory[])
    }
  }

  // 기존 기계 요금제 적용 헬퍼
  const applyOldPlan = () => {
    setFormData(prev => ({
      ...prev,
      plan_basic_fee: oldAsset.plan_basic_fee || 0,
      plan_basic_cnt_bw: oldAsset.plan_basic_cnt_bw || 0,
      plan_basic_cnt_col: oldAsset.plan_basic_cnt_col || 0,
      plan_price_bw: oldAsset.plan_price_bw || 0,
      plan_price_col: oldAsset.plan_price_col || 0,
      plan_weight_a3_bw: oldAsset.plan_weight_a3_bw || 1,
      plan_weight_a3_col: oldAsset.plan_weight_a3_col || 1,
    }))
  }

  // 라디오 버튼 변경 핸들러
  const handleModeChange = (mode: 'inherit' | 'new') => {
    setPlanMode(mode)
    if (mode === 'inherit') {
      applyOldPlan()
    }
    // 신규 모드일 때는 기존 값을 유지하되 사용자가 수정하도록 함
  }

  // ✅ 새 기계 선택 시 저장된 카운터 자동 불러오기
  const handleNewAssetChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const selectedId = e.target.value
    const selectedItem = warehouseItems.find(item => item.id === selectedId)

    if (selectedItem) {
      setFormData(prev => ({
        ...prev,
        new_asset_id: selectedId,
        new_initial_bw: selectedItem.initial_count_bw || 0,
        new_initial_col: selectedItem.initial_count_col || 0,
        new_initial_bw_a3: selectedItem.initial_count_bw_a3 || 0,
        new_initial_col_a3: selectedItem.initial_count_col_a3 || 0
      }))
    } else {
      setFormData(prev => ({ ...prev, new_asset_id: selectedId }))
    }
  }

  const handleReplace = async () => {
    if (!formData.new_asset_id) return alert('교체할 새 기계를 선택해주세요.')

    if (!confirm('정말 교체 처리를 진행하시겠습니까? (되돌릴 수 없습니다)')) return

    setLoading(true)

    try {
      const result = await replaceInventoryAction(
        clientId,
        oldAsset.id,
        formData.new_asset_id,
        {
          final_counts: {
            bw: formData.final_bw,
            col: formData.final_col,
            bw_a3: formData.final_bw_a3,
            col_a3: formData.final_col_a3
          },
          new_initial_counts: {
            bw: formData.new_initial_bw,
            col: formData.new_initial_col,
            bw_a3: formData.new_initial_bw_a3,
            col_a3: formData.new_initial_col_a3
          },
          contract: {
            start_date: formData.contract_start_date,
            end_date: formData.contract_end_date
          },
          // 선택된 요금제 정보를 서버로 전송
          plan: {
            basic_fee: formData.plan_basic_fee,
            basic_cnt_bw: formData.plan_basic_cnt_bw,
            basic_cnt_col: formData.plan_basic_cnt_col,
            price_bw: formData.plan_price_bw,
            price_col: formData.plan_price_col,
            weight_a3_bw: formData.plan_weight_a3_bw,
            weight_a3_col: formData.plan_weight_a3_col,
          },
          memo: formData.memo
          // ❌ inheritPlan 삭제됨 (plan 객체가 직접 전달되므로 불필요)
        }
      )

      if (result.success) {
        alert(result.message)
        onSuccess()
        onClose()
      } else {
        throw new Error(result.message)
      }

    } catch (e: any) {
      alert('오류 발생: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
      <div style={{ backgroundColor: 'var(--notion-bg)', padding: '32px', borderRadius: '12px', width: '700px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 10px 40px rgba(0,0,0,0.1)' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '20px', color: 'var(--notion-main-text)' }}>🔄 기계 교체 (맞교환) 및 계약 설정</h2>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px' }}>
          {/* 1. 기존 기계 (회수) */}
          <div style={{ padding: '16px', backgroundColor: '#fff1f0', borderRadius: '8px', border: '1px solid #ffa39e' }}>
            <div style={{ fontWeight: '600', marginBottom: '10px', color: '#cf1322' }}>📤 기존 기계 회수 (마감)</div>
            <div style={{ fontSize:'0.8rem', marginBottom:'8px', color:'#666'}}>{oldAsset.model_name} ({oldAsset.serial_number})</div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <InputField label="흑A4" type="number" value={formData.final_bw} onChange={e => setFormData({ ...formData, final_bw: Number(e.target.value) })} style={{marginBottom:0, fontSize:'0.8rem'}} />
              <InputField label="칼A4" type="number" value={formData.final_col} onChange={e => setFormData({ ...formData, final_col: Number(e.target.value) })} style={{marginBottom:0, fontSize:'0.8rem'}} />
              <InputField label="흑A3" type="number" value={formData.final_bw_a3} onChange={e => setFormData({ ...formData, final_bw_a3: Number(e.target.value) })} style={{marginBottom:0, fontSize:'0.8rem'}} />
              <InputField label="칼A3" type="number" value={formData.final_col_a3} onChange={e => setFormData({ ...formData, final_col_a3: Number(e.target.value) })} style={{marginBottom:0, fontSize:'0.8rem'}} />
            </div>
          </div>

          {/* 2. 새 기계 (설치) */}
          <div style={{ padding: '16px', backgroundColor: '#e6f7ff', borderRadius: '8px', border: '1px solid #91d5ff' }}>
            <div style={{ fontWeight: '600', marginBottom: '10px', color: '#0050b3' }}>📥 새 기계 설치 (시작)</div>
            
            <InputField 
              label="교체할 기계 선택" 
              as="select" 
              value={formData.new_asset_id} 
              onChange={handleNewAssetChange} 
              style={{marginBottom: '8px', fontSize:'0.85rem'}}
            >
              <option value="">교체할 기계 선택...</option>
              {warehouseItems.map(item => (
                <option key={item.id} value={item.id}>
                  {item.model_name} ({item.serial_number})
                </option>
              ))}
            </InputField>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <InputField label="흑A4" type="number" value={formData.new_initial_bw} onChange={e => setFormData({ ...formData, new_initial_bw: Number(e.target.value) })} style={{marginBottom:0, fontSize:'0.8rem'}} />
              <InputField label="칼A4" type="number" value={formData.new_initial_col} onChange={e => setFormData({ ...formData, new_initial_col: Number(e.target.value) })} style={{marginBottom:0, fontSize:'0.8rem'}} />
              <InputField label="흑A3" type="number" value={formData.new_initial_bw_a3} onChange={e => setFormData({ ...formData, new_initial_bw_a3: Number(e.target.value) })} style={{marginBottom:0, fontSize:'0.8rem'}} />
              <InputField label="칼A3" type="number" value={formData.new_initial_col_a3} onChange={e => setFormData({ ...formData, new_initial_col_a3: Number(e.target.value) })} style={{marginBottom:0, fontSize:'0.8rem'}} />
            </div>
          </div>
        </div>

        {/* 3. 계약 조건 설정 */}
        <div style={{ marginTop: '20px', padding: '20px', border: '1px solid #E5E5E5', borderRadius: '8px', backgroundColor: '#FAFAFA' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
            <div style={{ fontWeight:'700', color:'#171717' }}>📄 계약 조건 및 요금제 설정</div>
            <div style={{ display:'flex', gap:'12px', fontSize:'0.9rem' }}>
              <label style={{ display:'flex', alignItems:'center', gap:'4px', cursor:'pointer' }}>
                <input type="radio" name="planMode" checked={planMode === 'inherit'} onChange={() => handleModeChange('inherit')} />
                기존 계약 승계
              </label>
              <label style={{ display:'flex', alignItems:'center', gap:'4px', cursor:'pointer' }}>
                <input type="radio" name="planMode" checked={planMode === 'new'} onChange={() => handleModeChange('new')} />
                새로운 계약 적용
              </label>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', opacity: planMode === 'inherit' ? 0.7 : 1 }}>
            <InputField label="월 기본료" type="number" value={formData.plan_basic_fee} onChange={e => setFormData({...formData, plan_basic_fee: Number(e.target.value)})} readOnly={planMode === 'inherit'} />
            <InputField label="흑백 무료매수" type="number" value={formData.plan_basic_cnt_bw} onChange={e => setFormData({...formData, plan_basic_cnt_bw: Number(e.target.value)})} readOnly={planMode === 'inherit'} />
            <InputField label="칼라 무료매수" type="number" value={formData.plan_basic_cnt_col} onChange={e => setFormData({...formData, plan_basic_cnt_col: Number(e.target.value)})} readOnly={planMode === 'inherit'} />
            <InputField label="흑백 초과단가" type="number" value={formData.plan_price_bw} onChange={e => setFormData({...formData, plan_price_bw: Number(e.target.value)})} readOnly={planMode === 'inherit'} />
            <InputField label="칼라 초과단가" type="number" value={formData.plan_price_col} onChange={e => setFormData({...formData, plan_price_col: Number(e.target.value)})} readOnly={planMode === 'inherit'} />
            <div style={{ display:'flex', gap:'8px' }}>
               <InputField label="A3가중치(흑)" type="number" step="0.1" value={formData.plan_weight_a3_bw} onChange={e => setFormData({...formData, plan_weight_a3_bw: Number(e.target.value)})} readOnly={planMode === 'inherit'} />
               <InputField label="A3가중치(칼)" type="number" step="0.1" value={formData.plan_weight_a3_col} onChange={e => setFormData({...formData, plan_weight_a3_col: Number(e.target.value)})} readOnly={planMode === 'inherit'} />
            </div>
          </div>

          <div style={{ marginTop:'12px', borderTop:'1px dashed #ccc', paddingTop:'12px' }}>
             <p style={{fontSize:'0.8rem', fontWeight:'600', marginBottom:'8px', color:'#555'}}>📅 계약 기간 (신규 기계 기준)</p>
             <div style={{ display: 'flex', gap: '10px' }}>
                <InputField label="시작일" type="date" value={formData.contract_start_date} onChange={e => setFormData({ ...formData, contract_start_date: e.target.value })} style={{marginBottom:0}} />
                <InputField label="종료일" type="date" value={formData.contract_end_date} onChange={e => setFormData({ ...formData, contract_end_date: e.target.value })} style={{marginBottom:0}} />
             </div>
          </div>
        </div>

        <div style={{ marginTop: '20px' }}>
          <InputField label="비고 (교체 사유 등)" as="textarea" value={formData.memo} onChange={e => setFormData({ ...formData, memo: e.target.value })} style={{ height: '60px' }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '24px' }}>
          <Button variant="danger" onClick={onClose}>취소</Button>
          <Button variant="primary" onClick={handleReplace} disabled={loading}>
            {loading ? '처리 중...' : '교체 및 계약 확정'}
          </Button>
        </div>
      </div>
    </div>
  )
}