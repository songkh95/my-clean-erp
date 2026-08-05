'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { fetchClientTimelineAction, updateBulkSettlementHistoryAction } from '@/app/actions/accounting'
import Button from '@/components/ui/Button'
import { Client } from '@/app/types'

interface Props {
  client: Client
  onBack: () => void
}

// [수정됨] inventory_id가 null일 수 있음을 명시
interface TimelineData {
  id: string
  inventory_id: string | null 
  prev_count_bw: number
  curr_count_bw: number
  prev_count_col: number
  curr_count_col: number
  prev_count_bw_a3: number
  curr_count_bw_a3: number
  prev_count_col_a3: number
  curr_count_col_a3: number
  usage_bw: number
  usage_col: number
  usage_bw_a3: number
  usage_col_a3: number
  calculated_amount: number
  is_modified?: boolean
  settlement: {
    billing_year: number
    billing_month: number
    is_paid: boolean
  }
  inventory: {
    model_name: string
    serial_number: string
    billing_group_id: string | null
    plan_basic_fee: number
    plan_weight_a3_bw: number
    plan_weight_a3_col: number
    plan_price_bw: number
    plan_price_col: number
    plan_basic_cnt_bw: number
    plan_basic_cnt_col: number
  } | null // inventory 자체가 null일 가능성 대비
}

export default function ClientTimelineView({ client, onBack }: Props) {
  const [loading, setLoading] = useState(true)
  const [timelineData, setTimelineData] = useState<TimelineData[]>([])
  const [hasChanges, setHasChanges] = useState(false)
  
  // 조회 기간 설정 (기본값: 올해 1월 ~ 12월)
  const [yearRange, setYearRange] = useState({ start: new Date().getFullYear(), end: new Date().getFullYear() })

  // 데이터 로드
  useEffect(() => {
    loadData()
  }, [client.id, yearRange])

  const loadData = async () => {
    setLoading(true)
    const result = await fetchClientTimelineAction(client.id, yearRange.start, yearRange.end)
    if (result.success) {
      // [수정됨] 타입 단언을 사용하여 데이터 설정 (Server Action 결과와 로컬 타입 매칭)
      setTimelineData(result.data as unknown as TimelineData[])
    }
    setLoading(false)
  }

  // 기계별로 데이터 그룹핑
  const groupedData = useMemo(() => {
    const groups: { [key: string]: TimelineData[] } = {}
    timelineData.forEach(item => {
      // [수정됨] inventory_id가 없으면 'unknown'으로 그룹핑
      const key = item.inventory_id || 'unknown'
      if (!groups[key]) groups[key] = []
      groups[key].push(item)
    })
    return groups
  }, [timelineData])

  // 값 변경 핸들러
  const handleValueChange = (id: string, field: string, val: string) => {
    const numVal = Number(val.replace(/[^0-9]/g, '')) 
    
    setTimelineData(prev => prev.map(item => {
      if (item.id === id) {
        const newItem = { ...item, [field]: numVal, is_modified: true } as TimelineData
        
        // 사용량 재계산
        if (field === 'curr_count_bw' || field === 'prev_count_bw') {
          const c = field === 'curr_count_bw' ? numVal : newItem.curr_count_bw
          const p = field === 'prev_count_bw' ? numVal : newItem.prev_count_bw
          newItem.usage_bw = Math.max(0, c - p)
        }
        if (field === 'curr_count_col' || field === 'prev_count_col') {
          const c = field === 'curr_count_col' ? numVal : newItem.curr_count_col
          const p = field === 'prev_count_col' ? numVal : newItem.prev_count_col
          newItem.usage_col = Math.max(0, c - p)
        }
        if (field === 'curr_count_bw_a3' || field === 'prev_count_bw_a3') {
          const c = field === 'curr_count_bw_a3' ? numVal : newItem.curr_count_bw_a3
          const p = field === 'prev_count_bw_a3' ? numVal : newItem.prev_count_bw_a3
          newItem.usage_bw_a3 = Math.max(0, c - p)
        }
        if (field === 'curr_count_col_a3' || field === 'prev_count_col_a3') {
          const c = field === 'curr_count_col_a3' ? numVal : newItem.curr_count_col_a3
          const p = field === 'prev_count_col_a3' ? numVal : newItem.prev_count_col_a3
          newItem.usage_col_a3 = Math.max(0, c - p)
        }

        // 금액 가계산
        if (newItem.inventory) {
          const wBw = newItem.inventory.plan_weight_a3_bw || 1
          const wCol = newItem.inventory.plan_weight_a3_col || 1
          
          const totalBw = newItem.usage_bw + (newItem.usage_bw_a3 * wBw)
          const totalCol = newItem.usage_col + (newItem.usage_col_a3 * wCol)
          
          const freeBw = newItem.inventory.plan_basic_cnt_bw || 0
          const freeCol = newItem.inventory.plan_basic_cnt_col || 0
          
          const extraBw = Math.max(0, totalBw - freeBw)
          const extraCol = Math.max(0, totalCol - freeCol)
          
          const extraFee = (extraBw * (newItem.inventory.plan_price_bw || 0)) + (extraCol * (newItem.inventory.plan_price_col || 0))
          const basicFee = newItem.inventory.plan_basic_fee || 0
          
          newItem.calculated_amount = basicFee + extraFee
        }
        
        return newItem
      }
      return item
    }))
    setHasChanges(true)
  }

  // [▼ 다음 달로 반영] 기능
  // [수정됨] invId 타입을 string | null 로 변경
  const handleCopyNext = (invId: string | null, currentIdx: number) => {
    // invId가 없거나 'unknown'이면 처리 불가
    if (!invId) return;

    const group = groupedData[invId]
    if (!group || currentIdx >= group.length - 1) return

    const currentItem = group[currentIdx]
    const nextItem = group[currentIdx + 1]

    if (nextItem.settlement.is_paid) {
      alert('다음 달 내역이 이미 입금 완료되어 수정할 수 없습니다.')
      return
    }

    setTimelineData(prev => prev.map(item => {
      if (item.id === nextItem.id) {
        const updated = {
          ...item,
          prev_count_bw: currentItem.curr_count_bw,
          prev_count_col: currentItem.curr_count_col,
          prev_count_bw_a3: currentItem.curr_count_bw_a3,
          prev_count_col_a3: currentItem.curr_count_col_a3,
          is_modified: true
        }
        
        updated.usage_bw = Math.max(0, updated.curr_count_bw - updated.prev_count_bw)
        updated.usage_col = Math.max(0, updated.curr_count_col - updated.prev_count_col)
        updated.usage_bw_a3 = Math.max(0, updated.curr_count_bw_a3 - updated.prev_count_bw_a3)
        updated.usage_col_a3 = Math.max(0, updated.curr_count_col_a3 - updated.prev_count_col_a3)
        
        return updated
      }
      return item
    }))
    setHasChanges(true)
  }

  const handleSave = async () => {
    if (!confirm('수정된 내용을 저장하시겠습니까? (금액은 서버에서 다시 정확히 계산됩니다)')) return
    
    const updates = timelineData.filter(i => i.is_modified)
    const res = await updateBulkSettlementHistoryAction(updates)
    
    if (res.success) {
      alert(res.message)
      setHasChanges(false)
      loadData()
    } else {
      alert(res.message)
    }
  }

  return (
    <div style={{ animation: 'fadeIn 0.3s' }}>
      {/* 상단 헤더 */}
      <div style={{ backgroundColor: '#fff', padding: '20px', borderBottom: '1px solid #ddd', marginBottom: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '4px' }}>🏢 {client.name}</h2>
            <div style={{ fontSize: '0.9rem', color: '#666' }}>
              {client.representative_name} | {client.contact_person} ({client.phone})
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="ghost" onClick={onBack}>🔙 목록으로</Button>
            {hasChanges && <Button variant="primary" onClick={handleSave}>💾 변경사항 저장</Button>}
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center' }}>데이터 로딩 중...</div>
      ) : Object.keys(groupedData).length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>조회된 기간에 청구 내역이 없습니다.</div>
      ) : (
        // 기계별 카드 렌더링
        Object.keys(groupedData).map(invId => {
          const group = groupedData[invId]
          const inventory = group[0].inventory
          
          // [수정됨] inventory가 null일 경우 대비
          if (!inventory) return null;

          const isGroupMachine = !!inventory.billing_group_id

          return (
            <div key={invId} style={{ backgroundColor: '#fff', border: '1px solid #e5e5e5', borderRadius: '8px', marginBottom: '30px', overflow: 'hidden' }}>
              {/* 기계 헤더 */}
              <div style={{ padding: '15px 20px', backgroundColor: '#f9f9f9', borderBottom: '1px solid #e5e5e5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#333' }}>📦 {inventory.model_name}</span>
                  <span style={{ fontSize: '0.9rem', color: '#666', marginLeft: '10px' }}>S/N: {inventory.serial_number}</span>
                  {isGroupMachine && <span style={{ marginLeft: '10px', fontSize: '0.75rem', backgroundColor: '#f3e8ff', color: '#7e22ce', padding: '2px 6px', borderRadius: '4px' }}>🔗 그룹합산</span>}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#888' }}>
                  기본료: {inventory.plan_basic_fee?.toLocaleString()}원
                </div>
              </div>

              {/* 타임라인 테이블 */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#fbfbfb', borderBottom: '1px solid #eee', color: '#666' }}>
                      <th style={{ padding: '10px', width: '80px' }}>청구월</th>
                      <th style={{ padding: '10px', width: '60px' }}>상태</th>
                      <th style={{ padding: '10px', width: '25%' }}>전월 지침 (Editable)</th>
                      <th style={{ padding: '10px', width: '25%' }}>당월 지침 (Editable)</th>
                      <th style={{ padding: '10px', width: '20%' }}>실사용 (자동계산)</th>
                      <th style={{ padding: '10px', width: '100px', textAlign: 'right' }}>청구액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.map((item, idx) => {
                      const isPaid = item.settlement.is_paid
                      // 연속성 검사: 이전 달 당월 vs 이번 달 전월
                      let isDiscontinuous = false
                      if (idx > 0) {
                        const prevMonthItem = group[idx - 1]
                        if (
                          item.prev_count_bw !== prevMonthItem.curr_count_bw ||
                          item.prev_count_col !== prevMonthItem.curr_count_col
                        ) {
                          isDiscontinuous = true
                        }
                      }

                      return (
                        <tr key={item.id} style={{ borderBottom: '1px solid #f0f0f0', backgroundColor: item.is_modified ? '#fffbe6' : 'white' }}>
                          <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>
                            {item.settlement.billing_year}-{String(item.settlement.billing_month).padStart(2,'0')}
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            {isPaid ? <span style={{color:'green', fontSize:'0.7rem'}}>✔ 완료</span> : <span style={{color:'#ccc', fontSize:'0.7rem'}}>미납</span>}
                          </td>
                          
                          {/* 전월 지침 입력칸 */}
                          <td style={{ padding: '12px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', border: isDiscontinuous ? '2px solid red' : 'none', padding: isDiscontinuous ? '4px' : '0', borderRadius:'4px' }}>
                              <InputBox label="흑A4" value={item.prev_count_bw} onChange={(v: string) => handleValueChange(item.id, 'prev_count_bw', v)} disabled={isPaid} />
                              <InputBox label="칼A4" value={item.prev_count_col} onChange={(v: string) => handleValueChange(item.id, 'prev_count_col', v)} disabled={isPaid} color="blue" />
                              <InputBox label="흑A3" value={item.prev_count_bw_a3} onChange={(v: string) => handleValueChange(item.id, 'prev_count_bw_a3', v)} disabled={isPaid} />
                              <InputBox label="칼A3" value={item.prev_count_col_a3} onChange={(v: string) => handleValueChange(item.id, 'prev_count_col_a3', v)} disabled={isPaid} color="blue" />
                            </div>
                            {isDiscontinuous && <div style={{ color: 'red', fontSize: '0.7rem', marginTop: '2px' }}>⚠️ 지난달 마감 지침과 다름</div>}
                          </td>

                          {/* 당월 지침 입력칸 + 복사 버튼 */}
                          <td style={{ padding: '12px', position: 'relative' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                              <InputBox label="흑A4" value={item.curr_count_bw} onChange={(v: string) => handleValueChange(item.id, 'curr_count_bw', v)} disabled={isPaid} bold />
                              <InputBox label="칼A4" value={item.curr_count_col} onChange={(v: string) => handleValueChange(item.id, 'curr_count_col', v)} disabled={isPaid} color="blue" bold />
                              <InputBox label="흑A3" value={item.curr_count_bw_a3} onChange={(v: string) => handleValueChange(item.id, 'curr_count_bw_a3', v)} disabled={isPaid} bold />
                              <InputBox label="칼A3" value={item.curr_count_col_a3} onChange={(v: string) => handleValueChange(item.id, 'curr_count_col_a3', v)} disabled={isPaid} color="blue" bold />
                            </div>
                            
                            {/* 다음 달로 복사 버튼 */}
                            {!isPaid && idx < group.length - 1 && item.inventory_id && (
                              <button 
                                onClick={() => handleCopyNext(item.inventory_id, idx)}
                                style={{
                                  position: 'absolute', bottom: '-10px', left: '50%', transform: 'translateX(-50%)', zIndex: 10,
                                  backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '12px', 
                                  fontSize: '0.7rem', padding: '2px 8px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                }}
                                title="현재 당월 지침을 다음 달 전월 지침으로 복사"
                              >
                                ▼ 다음달 반영
                              </button>
                            )}
                          </td>

                          {/* 실사용량 (Read Only) */}
                          <td style={{ padding: '12px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', fontSize: '0.8rem' }}>
                              <div style={{ color: '#666' }}>흑A4: {item.usage_bw?.toLocaleString()}</div>
                              <div style={{ color: '#0070f3' }}>칼A4: {item.usage_col?.toLocaleString()}</div>
                              <div style={{ color: '#666' }}>흑A3: {item.usage_bw_a3?.toLocaleString()}</div>
                              <div style={{ color: '#0070f3' }}>칼A3: {item.usage_col_a3?.toLocaleString()}</div>
                            </div>
                          </td>

                          {/* 청구액 */}
                          <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold', color: '#171717' }}>
                            {item.calculated_amount?.toLocaleString()}원
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

interface InputBoxProps {
  label: string;
  value: number;
  onChange: (value: string) => void;
  disabled?: boolean;
  color?: 'black' | 'blue';
  bold?: boolean;
}

// 작은 입력 박스 컴포넌트
function InputBox({ label, value, onChange, disabled, color = 'black', bold = false }: InputBoxProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span style={{ fontSize: '0.65rem', color: '#999', marginBottom: '1px' }}>{label}</span>
      <input 
        type="text" 
        value={value ?? 0}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        style={{ 
          width: '100%', border: '1px solid #ddd', borderRadius: '4px', padding: '4px', 
          textAlign: 'right', fontSize: '0.85rem',
          color: color === 'blue' ? '#0070f3' : '#333',
          fontWeight: bold ? 'bold' : 'normal',
          backgroundColor: disabled ? '#f5f5f5' : '#fff'
        }}
      />
    </div>
  )
}