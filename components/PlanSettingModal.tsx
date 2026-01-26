'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase'

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
    billing_group_id: null as string | null
  })

  // 같은 거래처의 다른 기계들 (합산 대상)
  const [siblings, setSiblings] = useState<any[]>([])
  
  // 현재 기계 정보
  const [currentItem, setCurrentItem] = useState<any>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    // 1. 현재 기계 정보 가져오기
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

    // 2. 같은 거래처의 다른 기계들 가져오기 (합산 그룹 설정을 위해)
    const { data: sibs } = await supabase
      .from('inventory')
      .select('id, model_name, serial_number, billing_group_id')
      .eq('client_id', clientId)
      .neq('id', inventoryId) // 자기 자신 제외
      .not('status', 'in', '("창고","폐기")') // 설치된 것만

    if (sibs) setSiblings(sibs)
  }

  // 합산 설정 체크박스 로직
  const toggleGroup = (targetGroupId: string | null, targetInvId: string) => {
    // 만약 이미 같은 그룹이면 -> 그룹 해제 (개별 청구로 변경)
    if (formData.billing_group_id === targetGroupId && targetGroupId !== null) {
      setFormData({ ...formData, billing_group_id: null }) // 새 그룹 ID 생성 혹은 null 처리는 저장 시점에 결정
    } else {
      // 다른 그룹이거나 그룹이 없으면 -> 그 기계의 그룹으로 편입
      // 만약 상대방도 그룹이 없다면? -> 새로 하나 만들어서 둘 다 묶어야 함 (저장 로직에서 처리)
      setFormData({ ...formData, billing_group_id: targetGroupId || 'NEW_GROUP_WITH_' + targetInvId })
    }
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      let finalGroupId = formData.billing_group_id

      // 'NEW_GROUP_WITH_' 로 시작하면, 상대방 기계와 나를 묶을 새로운 UUID 생성
      if (finalGroupId && finalGroupId.startsWith('NEW_GROUP_WITH_')) {
        const targetId = finalGroupId.replace('NEW_GROUP_WITH_', '')
        const newGroupUUID = crypto.randomUUID() // 새 그룹 ID 발급
        
        // 1. 상대방 기계 업데이트
        await supabase.from('inventory').update({ billing_group_id: newGroupUUID }).eq('id', targetId)
        // 2. 나도 이 그룹 ID 사용
        finalGroupId = newGroupUUID
      }

      // 내 정보 업데이트
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
      
      alert('요금제가 설정되었습니다.')
      onUpdate()
      onClose()
    } catch (e: any) {
      alert('저장 실패: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  // 개별 청구로 전환
  const setIndividual = () => {
    setFormData({ ...formData, billing_group_id: null })
  }

  return (
    <div style={{
      position:'fixed', top:0, left:0, right:0, bottom:0,
      backgroundColor:'rgba(0,0,0,0.5)', display:'flex', justifyContent:'center', alignItems:'center', zIndex:1000
    }}>
      <div style={{backgroundColor:'white', padding:'30px', borderRadius:'12px', width:'500px', maxHeight:'90vh', overflowY:'auto'}}>
        <h2 style={{fontSize:'1.3rem', fontWeight:'bold', marginBottom:'20px', borderBottom:'2px solid #333', paddingBottom:'10px'}}>
          ⚙️ 기계별 요금제 설정
        </h2>
        
        {currentItem && (
          <div style={{backgroundColor:'#f5f5f5', padding:'10px', borderRadius:'6px', marginBottom:'20px', fontSize:'0.9rem', color:'#555'}}>
             모델명: <b>{currentItem.model_name}</b> <br/>
             S/N: {currentItem.serial_number}
          </div>
        )}

        <div style={{marginBottom:'20px'}}>
          <label style={{display:'block', fontWeight:'bold', marginBottom:'5px'}}>월 기본료 (원)</label>
          <input type="number" className="input-field" style={{width:'100%', padding:'8px', border:'1px solid #ddd', borderRadius:'4px'}}
            value={formData.plan_basic_fee} 
            onChange={e => setFormData({...formData, plan_basic_fee: Number(e.target.value)})} 
          />
        </div>

        <div style={{display:'flex', gap:'15px', marginBottom:'15px'}}>
          <div style={{flex:1}}>
            <label style={{fontSize:'0.85rem', color:'#666'}}>흑백 무료매수</label>
            <input type="number" className="input-field" style={{width:'100%', padding:'6px', border:'1px solid #ddd'}}
              value={formData.plan_basic_cnt_bw} onChange={e => setFormData({...formData, plan_basic_cnt_bw: Number(e.target.value)})} />
          </div>
          <div style={{flex:1}}>
            <label style={{fontSize:'0.85rem', color:'#666'}}>칼라 무료매수</label>
            <input type="number" className="input-field" style={{width:'100%', padding:'6px', border:'1px solid #ddd'}}
              value={formData.plan_basic_cnt_col} onChange={e => setFormData({...formData, plan_basic_cnt_col: Number(e.target.value)})} />
          </div>
        </div>

        <div style={{display:'flex', gap:'15px', marginBottom:'20px'}}>
          <div style={{flex:1}}>
            <label style={{fontSize:'0.85rem', color:'#666'}}>흑백 추가요금(장당)</label>
            <input type="number" className="input-field" style={{width:'100%', padding:'6px', border:'1px solid #ddd'}}
              value={formData.plan_price_bw} onChange={e => setFormData({...formData, plan_price_bw: Number(e.target.value)})} />
          </div>
          <div style={{flex:1}}>
            <label style={{fontSize:'0.85rem', color:'#666'}}>칼라 추가요금(장당)</label>
            <input type="number" className="input-field" style={{width:'100%', padding:'6px', border:'1px solid #ddd'}}
              value={formData.plan_price_col} onChange={e => setFormData({...formData, plan_price_col: Number(e.target.value)})} />
          </div>
        </div>
        
        <details style={{marginBottom:'20px'}}>
          <summary style={{cursor:'pointer', fontSize:'0.9rem', color:'#888'}}>A3 가중치 설정 (기본 1/2배)</summary>
          <div style={{display:'flex', gap:'15px', marginTop:'10px', padding:'10px', background:'#fafafa'}}>
             <div style={{flex:1}}>
               <label>A3 흑백 배수</label>
               <input type="number" step="0.1" style={{width:'100%'}} value={formData.plan_weight_a3_bw} onChange={e => setFormData({...formData, plan_weight_a3_bw: Number(e.target.value)})} />
             </div>
             <div style={{flex:1}}>
               <label>A3 칼라 배수</label>
               <input type="number" step="0.1" style={{width:'100%'}} value={formData.plan_weight_a3_col} onChange={e => setFormData({...formData, plan_weight_a3_col: Number(e.target.value)})} />
             </div>
          </div>
        </details>

        {/* 🔗 합산 청구 설정 섹션 */}
        <div style={{borderTop:'1px solid #eee', paddingTop:'20px', marginTop:'20px'}}>
          <h3 style={{fontSize:'1rem', fontWeight:'bold', marginBottom:'10px'}}>🔗 청구 방식 선택</h3>
          
          <div style={{marginBottom:'10px'}}>
            <label style={{display:'flex', alignItems:'center', gap:'8px', cursor:'pointer'}}>
              <input type="radio" name="grouping" 
                checked={!formData.billing_group_id} 
                onChange={setIndividual} 
              />
              <span>개별 청구 (이 기계만 따로 계산)</span>
            </label>
          </div>

          {siblings.length > 0 && (
            <div style={{background:'#f0f9ff', padding:'15px', borderRadius:'8px'}}>
              <div style={{fontSize:'0.9rem', marginBottom:'8px', fontWeight:'bold', color:'#0070f3'}}>
                다음 기계와 합산하여 청구하기:
              </div>
              {siblings.map(sib => {
                // 이 형제 기계가 나와 같은 그룹인지 확인
                const isLinked = formData.billing_group_id && (formData.billing_group_id === sib.billing_group_id)
                // 만약 아직 저장안된 임시 그룹 상태라면?
                const isTempLinked = formData.billing_group_id === ('NEW_GROUP_WITH_' + sib.id)

                return (
                  <label key={sib.id} style={{display:'flex', alignItems:'center', gap:'8px', marginBottom:'5px', fontSize:'0.9rem', cursor:'pointer'}}>
                    <input type="radio" name="grouping"
                      checked={!!(isLinked || isTempLinked)}
                      onChange={() => toggleGroup(sib.billing_group_id, sib.id)}
                    />
                    <span>{sib.model_name} ({sib.serial_number})</span>
                    {sib.billing_group_id && <span style={{fontSize:'0.7rem', color:'#999'}}>(이미 그룹지정됨)</span>}
                  </label>
                )
              })}
            </div>
          )}
        </div>

        <div style={{display:'flex', justifyContent:'flex-end', gap:'10px', marginTop:'30px'}}>
          <button onClick={onClose} style={{padding:'10px 20px', border:'1px solid #ccc', background:'white', borderRadius:'6px', cursor:'pointer'}}>취소</button>
          <button onClick={handleSave} disabled={loading} style={{padding:'10px 20px', background:'#333', color:'white', border:'none', borderRadius:'6px', cursor:'pointer'}}>
            {loading ? '저장 중...' : '설정 저장'}
          </button>
        </div>
      </div>
    </div>
  )
}