'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase'
import Button from './ui/Button'
import InputField from './ui/Input'

interface Props {
  inventoryId: string
  clientId: string
  onClose: () => void
  onUpdate: () => void
}

export default function PlanSettingModal({ inventoryId, clientId, onClose, onUpdate }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  
  // 요금제 데이터 (SQL public.inventory 컬럼과 1:1 매칭)
  const [formData, setFormData] = useState({
    plan_basic_fee: 0,
    plan_basic_cnt_bw: 0,
    plan_basic_cnt_col: 0,
    plan_price_bw: 0,
    plan_price_col: 0,
    plan_weight_a3_bw: 1,
    plan_weight_a3_col: 1,
    billing_group_id: null as string | null
  })

  const [siblings, setSiblings] = useState<any[]>([])
  const [currentItem, setCurrentItem] = useState<any>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    // 1. 현재 기계 정보 및 기존 요금제 로드
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
        billing_group_id: current.billing_group_id
      })
    }

    // 2. 합산 청구가 가능한 같은 거래처의 다른 기기 조회
    const { data: sibs } = await supabase
      .from('inventory')
      .select('id, model_name, serial_number, billing_group_id')
      .eq('client_id', clientId)
      .neq('id', inventoryId)
      .not('status', 'in', '("창고","폐기")') 

    if (sibs) setSiblings(sibs)
  }

  // 합산 청구 그룹 지정 로직 (기능 보존)
  const toggleGroup = (targetGroupId: string | null, targetInvId: string) => {
    if (formData.billing_group_id === targetGroupId && targetGroupId !== null) {
      setFormData({ ...formData, billing_group_id: null })
    } else {
      // 상대방이 그룹이 없으면 임시 ID 부여, 있으면 해당 ID로 편입
      setFormData({ ...formData, billing_group_id: targetGroupId || 'NEW_GROUP_WITH_' + targetInvId })
    }
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      let finalGroupId = formData.billing_group_id

      // 신규 그룹 생성 처리 (기능 보존)
      if (finalGroupId && finalGroupId.startsWith('NEW_GROUP_WITH_')) {
        const targetId = finalGroupId.replace('NEW_GROUP_WITH_', '')
        const newGroupUUID = crypto.randomUUID()
        
        // 상대방 기기 그룹 업데이트
        await supabase.from('inventory').update({ billing_group_id: newGroupUUID }).eq('id', targetId)
        finalGroupId = newGroupUUID
      }

      // 현재 기기 요금제 및 그룹 정보 업데이트
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
          billing_group_id: finalGroupId
        })
        .eq('id', inventoryId)

      if (error) throw error
      
      alert('요금제 설정이 완료되었습니다.')
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
          ⚙️ 기계별 요금제 설정
        </h2>
        
        {currentItem && (
          <div style={{backgroundColor:'var(--notion-soft-bg)', padding:'12px', borderRadius:'var(--radius-md)', marginBottom:'24px', fontSize:'0.85rem', color:'var(--notion-sub-text)', border:'1px solid var(--notion-border)'}}>
             모델명: <b style={{color:'var(--notion-main-text)'}}>{currentItem.model_name}</b> <br/>
             S/N: {currentItem.serial_number}
          </div>
        )}

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
                    <input type="radio" name="grouping" checked={!!(isLinked || isTempLinked)} onChange={() => toggleGroup(sib.billing_group_id, sib.id)} />
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