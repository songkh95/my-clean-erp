'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase'
import Button from '@/components/ui/Button'
import InputField from '@/components/ui/Input'

interface Props {
  inventoryId: string
  clientId: string
  onClose: () => void
  onUpdate: () => void
}

export default function PlanSettingModal({ inventoryId, clientId, onClose, onUpdate }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  
  // 요금제 데이터
  const [formData, setFormData] = useState({
    plan_basic_fee: 0,
    plan_basic_cnt_bw: 0,
    plan_basic_cnt_col: 0,
    plan_price_bw: 0,
    plan_price_col: 0,
    plan_weight_a3_bw: 1,
    plan_weight_a3_col: 1,
    billing_group_id: null as string | null,
    billing_date: '말일'
  })

  const [siblings, setSiblings] = useState<any[]>([])
  const [currentItem, setCurrentItem] = useState<any>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    // 1. 현재 기계 정보 로드
    const { data: current } = await supabase
      .from('inventory')
      .select('*')
      .eq('id', inventoryId)
      .single()
    
    if (current) {
      setCurrentItem(current)
      setFormData({
        plan_basic_fee: current.plan_basic_fee || 0,
        plan_basic_cnt_bw: current.plan_basic_cnt_bw || 0,
        plan_basic_cnt_col: current.plan_basic_cnt_col || 0,
        plan_price_bw: current.plan_price_bw || 0,
        plan_price_col: current.plan_price_col || 0,
        plan_weight_a3_bw: current.plan_weight_a3_bw || 1,
        plan_weight_a3_col: current.plan_weight_a3_col || 1,
        billing_group_id: current.billing_group_id,
        billing_date: current.billing_date || '말일'
      })
    }

    // 2. 같은 거래처의 다른 기기 조회 (요금제 정보 포함)
    const { data: sibs } = await supabase
      .from('inventory')
      .select('id, model_name, serial_number, billing_group_id, plan_price_bw, plan_price_col, plan_weight_a3_bw, plan_weight_a3_col')
      .eq('client_id', clientId)
      .neq('id', inventoryId)
      .not('status', 'in', '("창고","폐기")') 

    if (sibs) setSiblings(sibs)
  }

  // ✅ [추가됨] 단가 통일 및 그룹 선택 로직
  const handleGroupSelect = (targetAsset: any) => {
    // 1. 이미 선택된 그룹을 다시 클릭하면 해제 (단독 청구로 변경)
    if (formData.billing_group_id === targetAsset.billing_group_id && targetAsset.billing_group_id !== null) {
      setFormData({ ...formData, billing_group_id: null });
      return;
    }

    // 2. 단가 비교 (현재 입력값 vs 대상 기계의 DB값)
    const isPriceDifferent = 
      formData.plan_price_bw !== targetAsset.plan_price_bw ||
      formData.plan_price_col !== targetAsset.plan_price_col ||
      formData.plan_weight_a3_bw !== targetAsset.plan_weight_a3_bw ||
      formData.plan_weight_a3_col !== targetAsset.plan_weight_a3_col;

    if (isPriceDifferent) {
      // 단가가 다를 경우 사용자에게 확인
      const confirmSync = confirm(
        `⚠️ 선택한 기계 [${targetAsset.model_name}]와 초과 단가 또는 가중치가 다릅니다.\n\n` +
        `합산 청구를 하려면 단가가 동일해야 합니다.\n` +
        `현재 기계의 단가를 대상 기계와 동일하게 변경하고 묶으시겠습니까?\n\n` +
        ` - 대상 흑백단가: ${targetAsset.plan_price_bw}원 (현재: ${formData.plan_price_bw}원)\n` +
        ` - 대상 컬러단가: ${targetAsset.plan_price_col}원 (현재: ${formData.plan_price_col}원)`
      );

      if (confirmSync) {
        // '확인' 시 단가를 덮어쓰고 그룹 지정
        setFormData({
          ...formData,
          plan_price_bw: targetAsset.plan_price_bw,
          plan_price_col: targetAsset.plan_price_col,
          plan_weight_a3_bw: targetAsset.plan_weight_a3_bw,
          plan_weight_a3_col: targetAsset.plan_weight_a3_col,
          billing_group_id: targetAsset.billing_group_id || 'NEW_GROUP_WITH_' + targetAsset.id
        });
      } else {
        // '취소' 시 아무 작업 안 함
        return; 
      }
    } else {
      // 단가가 같으면 바로 그룹 지정
      setFormData({ 
        ...formData, 
        billing_group_id: targetAsset.billing_group_id || 'NEW_GROUP_WITH_' + targetAsset.id 
      });
    }
  };

  const handleSave = async () => {
    setLoading(true)
    try {
      let finalGroupId = formData.billing_group_id

      // 신규 그룹 생성 처리
      if (finalGroupId && finalGroupId.startsWith('NEW_GROUP_WITH_')) {
        const targetId = finalGroupId.replace('NEW_GROUP_WITH_', '')
        const newGroupUUID = crypto.randomUUID()
        
        // 대상 기계의 그룹 ID 업데이트
        await supabase.from('inventory').update({ billing_group_id: newGroupUUID }).eq('id', targetId)
        finalGroupId = newGroupUUID
      }

      // 현재 기기 업데이트
      const { error } = await supabase
        .from('inventory')
        .update({
          plan_basic_fee: formData.plan_basic_fee,
          plan_basic_cnt_bw: formData.plan_basic_cnt_bw,
          plan_basic_cnt_col: formData.plan_basic_cnt_col,
          plan_price_bw: formData.plan_price_bw,
          plan_price_col: formData.plan_price_col,
          plan_weight_a3_bw: formData.plan_weight_a3_bw,
          plan_weight_a3_col: formData.plan_weight_a3_col,
          billing_group_id: finalGroupId,
          billing_date: formData.billing_date
        })
        .eq('id', inventoryId)

      if (error) throw error
      
      alert('설정이 완료되었습니다.')
      onUpdate()
      onClose()
    } catch (e: any) {
      alert('저장 실패: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position:'fixed', top:0, left:0, right:0, bottom:0,
      backgroundColor:'rgba(0,0,0,0.4)', display:'flex', justifyContent:'center', alignItems:'center', zIndex:1000
    }}>
      <div style={{
        backgroundColor:'var(--notion-bg)', 
        padding:'32px', 
        borderRadius:'12px', 
        width:'500px', 
        maxHeight:'90vh', 
        overflowY:'auto',
        boxShadow: '0 15px 50px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{fontSize:'1.2rem', fontWeight:'700', marginBottom:'20px', color:'var(--notion-main-text)'}}>
          ⚙️ 기계별 요금제 및 청구 설정
        </h2>
        
        {currentItem && (
          <div style={{backgroundColor:'var(--notion-soft-bg)', padding:'12px', borderRadius:'var(--radius-md)', marginBottom:'24px', fontSize:'0.85rem', color:'var(--notion-sub-text)', border:'1px solid var(--notion-border)'}}>
             모델명: <b style={{color:'var(--notion-main-text)'}}>{currentItem.model_name}</b> <br/>
             S/N: {currentItem.serial_number}
          </div>
        )}

        <InputField 
          label="매월 정기 청구일" 
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

        <div style={{display:'flex', gap:'12px'}}>
          <InputField label="흑백 무료매수" type="number" value={formData.plan_basic_cnt_bw} onChange={e => setFormData({...formData, plan_basic_cnt_bw: Number(e.target.value)})} />
          <InputField label="칼라 무료매수" type="number" value={formData.plan_basic_cnt_col} onChange={e => setFormData({...formData, plan_basic_cnt_col: Number(e.target.value)})} />
        </div>

        <div style={{display:'flex', gap:'12px'}}>
          <InputField label="흑백 초과단가" type="number" value={formData.plan_price_bw} onChange={e => setFormData({...formData, plan_price_bw: Number(e.target.value)})} />
          <InputField label="칼라 초과단가" type="number" value={formData.plan_price_col} onChange={e => setFormData({...formData, plan_price_col: Number(e.target.value)})} />
        </div>
        
        <details style={{marginBottom:'24px'}}>
          <summary style={{cursor:'pointer', fontSize:'0.85rem', color:'var(--notion-sub-text)', fontWeight:'500'}}>A3 가중치 설정 (기본 1배)</summary>
          <div style={{display:'flex', gap:'12px', marginTop:'12px', padding:'16px', backgroundColor:'var(--notion-soft-bg)', borderRadius:'var(--radius-md)', border:'1px solid var(--notion-border)'}}>
             <InputField label="A3 흑백 배수" type="number" step="0.1" value={formData.plan_weight_a3_bw} onChange={e => setFormData({...formData, plan_weight_a3_bw: Number(e.target.value)})} style={{marginBottom:0}} />
             <InputField label="A3 칼라 배수" type="number" step="0.1" value={formData.plan_weight_a3_col} onChange={e => setFormData({...formData, plan_weight_a3_col: Number(e.target.value)})} style={{marginBottom:0}} />
          </div>
        </details>

        <div style={{borderTop:'1px solid var(--notion-border)', paddingTop:'20px'}}>
          <h3 style={{fontSize:'0.9rem', fontWeight:'700', marginBottom:'12px', color:'var(--notion-main-text)'}}>🔗 청구 방식 선택</h3>
          
          <label style={{display:'flex', alignItems:'center', gap:'8px', cursor:'pointer', marginBottom:'12px', fontSize:'0.9rem'}}>
            <input type="radio" name="grouping" checked={!formData.billing_group_id} onChange={() => setFormData({ ...formData, billing_group_id: null })} />
            <span>개별 청구 (단독 계산)</span>
          </label>

          {siblings.length > 0 && (
            <div style={{backgroundColor:'var(--notion-blue-light)', padding:'16px', borderRadius:'var(--radius-md)', border:'1px solid var(--notion-blue)'}}>
              <div style={{fontSize:'0.8rem', marginBottom:'10px', fontWeight:'600', color:'var(--notion-blue)'}}>다른 기기와 합산 청구:</div>
              {siblings.map(sib => {
                const isLinked = formData.billing_group_id && (formData.billing_group_id === sib.billing_group_id)
                const isTempLinked = formData.billing_group_id === ('NEW_GROUP_WITH_' + sib.id)

                return (
                  <label key={sib.id} style={{display:'flex', alignItems:'center', gap:'8px', marginBottom:'6px', fontSize:'0.85rem', cursor:'pointer'}}>
                    <input 
                      type="radio" 
                      name="grouping" 
                      checked={!!(isLinked || isTempLinked)} 
                      onChange={() => handleGroupSelect(sib)} // ✅ 수정된 핸들러 사용
                    />
                    <span>{sib.model_name} ({sib.serial_number})</span>
                  </label>
                )
              })}
            </div>
          )}
        </div>

        <div style={{display:'flex', justifyContent:'flex-end', gap:'8px', marginTop:'32px'}}>
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button variant="primary" onClick={handleSave} disabled={loading}>
            {loading ? '저장 중...' : '설정 저장'}
          </Button>
        </div>
      </div>
    </div>
  )
}