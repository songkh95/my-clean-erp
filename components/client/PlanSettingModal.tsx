'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/utils/supabase'
import Button from '@/components/ui/Button'
import InputField from '@/components/ui/Input'
import { Inventory } from '@/app/types'
import { updateInventoryPlanAction } from '@/app/actions/inventory'
import { calcContractEndDate } from '@/utils/clientInventoryExcel'

interface Props {
  inventoryId: string
  clientId: string
  onClose: () => void
  onUpdate: () => void
}

type SearchMachine = Inventory & {
  client?: { id: string; name: string } | null
}

export default function PlanSettingModal({ inventoryId, clientId, onClose, onUpdate }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  
  const [formData, setFormData] = useState({
    plan_basic_fee: 0,
    plan_basic_cnt_bw: 0,
    plan_basic_cnt_col: 0,
    plan_price_bw: 0,
    plan_price_col: 0,
    plan_weight_a3_bw: 1,
    plan_weight_a3_col: 1,
    billing_group_id: null as string | null,
    billing_date: '말일',
    contract_start_date: '',
    contract_end_date: '',
    contract_type: '',
    deposit: 0,
    sale_price: 0,
    contract_years: 0,
  })

  const [siblings, setSiblings] = useState<Inventory[]>([])
  const [groupPeers, setGroupPeers] = useState<SearchMachine[]>([])
  const [currentItem, setCurrentItem] = useState<Inventory | null>(null)
  const [originalGroupId, setOriginalGroupId] = useState<string | null>(null)
  const [originalGroupCount, setOriginalGroupCount] = useState(0)

  const [machineSearch, setMachineSearch] = useState('')
  const [searchResults, setSearchResults] = useState<SearchMachine[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const { data: current } = await supabase
      .from('inventory')
      .select('*')
      .eq('id', inventoryId)
      .single()
    
    if (current) {
      const item = current as unknown as Inventory
      setCurrentItem(item)
      setOriginalGroupId(item.billing_group_id)
      setFormData({
        plan_basic_fee: item.plan_basic_fee || 0,
        plan_basic_cnt_bw: item.plan_basic_cnt_bw || 0,
        plan_basic_cnt_col: item.plan_basic_cnt_col || 0,
        plan_price_bw: item.plan_price_bw || 0,
        plan_price_col: item.plan_price_col || 0,
        plan_weight_a3_bw: item.plan_weight_a3_bw || 1,
        plan_weight_a3_col: item.plan_weight_a3_col || 1,
        billing_group_id: item.billing_group_id,
        billing_date: item.billing_date || '말일',
        contract_start_date: item.contract_start_date || '',
        contract_end_date: item.contract_end_date || '',
        contract_type: item.contract_type || '',
        deposit: item.deposit || 0,
        sale_price: item.sale_price || 0,
        contract_years: item.contract_years || 0,
      })

      if (item.billing_group_id) {
        const { data: peers } = await supabase
          .from('inventory')
          .select('*, client:clients(id, name)')
          .eq('billing_group_id', item.billing_group_id)

        if (peers) {
          setOriginalGroupCount(peers.length)
          setGroupPeers(
            (peers as SearchMachine[]).filter(p => p.id !== inventoryId)
          )
        }
      }
    }

    const { data: sibs } = await supabase
      .from('inventory')
      .select('*')
      .eq('client_id', clientId)
      .neq('id', inventoryId)
      .not('status', 'in', '("창고","폐기")') 

    if (sibs) setSiblings(sibs as Inventory[])
  }

  // 다른 거래처 기기 검색
  useEffect(() => {
    const q = machineSearch.trim()
    if (q.length < 1) {
      setSearchResults([])
      return
    }

    let cancelled = false
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || cancelled) return
        const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
        if (!profile?.organization_id || cancelled) return
        const orgId = profile.organization_id

        const { data: byMachine } = await supabase
          .from('inventory')
          .select('*, client:clients(id, name)')
          .eq('organization_id', orgId)
          .neq('id', inventoryId)
          .not('status', 'in', '("창고","폐기")')
          .not('client_id', 'is', null)
          .or(`model_name.ilike.%${q}%,serial_number.ilike.%${q}%`)
          .limit(25)

        const rows = new Map<string, SearchMachine>()
        ;((byMachine || []) as SearchMachine[]).forEach(r => rows.set(r.id, r))

        const { data: matchedClients } = await supabase
          .from('clients')
          .select('id, name')
          .eq('organization_id', orgId)
          .eq('is_deleted', false)
          .ilike('name', `%${q}%`)
          .limit(15)

        const clientIds = (matchedClients || []).map(c => c.id)
        if (clientIds.length > 0) {
          const { data: byClient } = await supabase
            .from('inventory')
            .select('*, client:clients(id, name)')
            .eq('organization_id', orgId)
            .neq('id', inventoryId)
            .not('status', 'in', '("창고","폐기")')
            .in('client_id', clientIds)
            .limit(30)
          ;((byClient || []) as SearchMachine[]).forEach(r => rows.set(r.id, r))
        }

        if (!cancelled) setSearchResults(Array.from(rows.values()).slice(0, 25))
      } finally {
        if (!cancelled) setSearching(false)
      }
    }, 280)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [machineSearch, inventoryId, supabase])

  const handleGroupSelect = (targetAsset: SearchMachine | Inventory) => {
    const targetGroup = targetAsset.billing_group_id
    const tempId = 'NEW_GROUP_WITH_' + targetAsset.id

    // 이미 같은 대상과 연결 중이면 해제
    if (
      (targetGroup && formData.billing_group_id === targetGroup) ||
      formData.billing_group_id === tempId
    ) {
      requestUngroup()
      return
    }

    const isPriceDifferent = 
      formData.plan_price_bw !== (targetAsset.plan_price_bw ?? 0) ||
      formData.plan_price_col !== (targetAsset.plan_price_col ?? 0) ||
      formData.plan_weight_a3_bw !== (targetAsset.plan_weight_a3_bw ?? 1) ||
      formData.plan_weight_a3_col !== (targetAsset.plan_weight_a3_col ?? 1);

    const nextGroupId = targetGroup || tempId
    const clientName = (targetAsset as SearchMachine).client?.name

    const apply = (withPriceSync: boolean) => {
      setFormData(prev => ({
        ...prev,
        ...(withPriceSync ? {
          plan_price_bw: targetAsset.plan_price_bw ?? 0,
          plan_price_col: targetAsset.plan_price_col ?? 0,
          plan_weight_a3_bw: targetAsset.plan_weight_a3_bw ?? 1,
          plan_weight_a3_col: targetAsset.plan_weight_a3_col ?? 1,
        } : {}),
        billing_group_id: nextGroupId
      }))
      setGroupPeers([{
        ...(targetAsset as SearchMachine),
        client: (targetAsset as SearchMachine).client || { id: targetAsset.client_id || '', name: clientName || '(동일 거래처)' }
      }])
    }

    if (isPriceDifferent) {
      if (confirm(`⚠️ 선택한 기계와 단가/가중치가 다릅니다.\n단가를 동기화하고 합산하시겠습니까?`)) {
        apply(true)
      }
    } else {
      apply(false)
    }
  }

  const requestUngroup = () => {
    if (originalGroupId && originalGroupCount === 2) {
      const peer = groupPeers[0]
      const peerLabel = peer
        ? `${peer.model_name} (${peer.serial_number})`
        : '나머지 1대'
      if (!confirm(
        `현재 합산 그룹에 기계가 2대 있습니다.\n\n` +
        `이 기계의 합산을 끊으면 [${peerLabel}]도 합산 청구의 의미가 없어져 자동으로 개별 청구로 전환됩니다.\n\n계속할까요?`
      )) {
        return
      }
    } else if (originalGroupId && originalGroupCount > 2) {
      if (!confirm(
        `이 기계를 합산에서 제외합니다.\n그룹에 ${originalGroupCount - 1}대가 남습니다. 계속할까요?`
      )) {
        return
      }
    }
    setFormData(prev => ({ ...prev, billing_group_id: null }))
    // groupPeers는 저장 안내 문구용으로 유지 (원본 그룹 정보)
  }

  const handleSave = async () => {
    // 저장 직전: 개별 청구로 바꾸는 경우 2대 그룹이면 한 번 더 안내
    if (
      !formData.billing_group_id &&
      originalGroupId &&
      originalGroupCount === 2
    ) {
      const peer = groupPeers[0]
      const peerLabel = peer
        ? `${peer.model_name} (${peer.serial_number})`
        : '나머지 1대'
      if (!confirm(
        `합산 청구를 해제하면 연결된 [${peerLabel}]도 자동으로 합산이 끊어집니다.\n저장할까요?`
      )) {
        return
      }
    }

    setLoading(true)
    try {
      const result = await updateInventoryPlanAction(
        inventoryId,
        {
          plan_basic_fee: formData.plan_basic_fee,
          plan_basic_cnt_bw: formData.plan_basic_cnt_bw,
          plan_basic_cnt_col: formData.plan_basic_cnt_col,
          plan_price_bw: formData.plan_price_bw,
          plan_price_col: formData.plan_price_col,
          plan_weight_a3_bw: formData.plan_weight_a3_bw,
          plan_weight_a3_col: formData.plan_weight_a3_col,
          billing_date: formData.billing_date,
          contract_start_date: formData.contract_start_date, 
          contract_end_date: formData.contract_end_date,
          contract_type: formData.contract_type || null,
          deposit: formData.deposit || 0,
          sale_price: formData.sale_price || 0,
          contract_years: formData.contract_years || null,
        },
        formData.billing_group_id
      )

      if (result.success) {
        alert(result.message)
        onUpdate()
        onClose()
      } else {
        throw new Error(result.message)
      }
    } catch (e: any) {
      alert('저장 실패: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  const linkedLabel = useMemo(() => {
    if (!formData.billing_group_id) return null
    if (formData.billing_group_id.startsWith('NEW_GROUP_WITH_')) {
      const tid = formData.billing_group_id.replace('NEW_GROUP_WITH_', '')
      const found =
        siblings.find(s => s.id === tid) ||
        searchResults.find(s => s.id === tid) ||
        groupPeers.find(s => s.id === tid)
      if (!found) return '선택 기계와 신규 합산 예정'
      const cName = (found as SearchMachine).client?.name
      return `${cName ? `[${cName}] ` : ''}${found.model_name} (${found.serial_number})`
    }
    return groupPeers.length > 0
      ? groupPeers.map(p => `${p.client?.name ? `[${p.client.name}] ` : ''}${p.model_name}`).join(', ')
      : '합산 그룹 연결됨'
  }, [formData.billing_group_id, siblings, searchResults, groupPeers])

  const isMachineChecked = (m: Inventory) => {
    if (!formData.billing_group_id) return false
    if (formData.billing_group_id === ('NEW_GROUP_WITH_' + m.id)) return true
    if (m.billing_group_id && formData.billing_group_id === m.billing_group_id) return true
    return false
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
        width:'580px', 
        maxHeight:'90vh', 
        overflowY:'auto',
        boxShadow: '0 15px 50px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{fontSize:'1.2rem', fontWeight:'700', marginBottom:'20px', color:'var(--notion-main-text)'}}>
          기계별 요금제 및 청구 설정
        </h2>
        
        {currentItem && (
          <div style={{backgroundColor:'var(--notion-soft-bg)', padding:'12px', borderRadius:'var(--radius-md)', marginBottom:'24px', fontSize:'0.85rem', color:'var(--notion-sub-text)', border:'1px solid var(--notion-border)'}}>
             모델명: <b style={{color:'var(--notion-main-text)'}}>{currentItem.model_name}</b> <br/>
             S/N: {currentItem.serial_number}
          </div>
        )}

        <div style={{ marginBottom: '20px', padding: '16px', border: '1px solid var(--notion-border)', borderRadius: '8px', backgroundColor: '#fff' }}>
          <div style={{ fontSize: '0.9rem', fontWeight: '600', marginBottom: '10px', color: '#171717' }}>계약 정보</div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <InputField
              label="계약구분"
              as="select"
              value={formData.contract_type}
              onChange={e => setFormData({ ...formData, contract_type: e.target.value })}
              style={{ marginBottom: 0 }}
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
              style={{ marginBottom: 0 }}
            />
            <InputField
              label="판매금액"
              type="number"
              value={formData.sale_price}
              onChange={e => setFormData({ ...formData, sale_price: Number(e.target.value) })}
              style={{ marginBottom: 0 }}
            />
          </div>
          <div style={{ display: 'flex', gap: '12px', marginTop: 12 }}>
            <InputField 
              label="계약 시작일" 
              type="date" 
              value={formData.contract_start_date} 
              onChange={e => {
                const start = e.target.value
                const years = formData.contract_years
                const end = years > 0 ? calcContractEndDate(start, years) : null
                setFormData({
                  ...formData,
                  contract_start_date: start,
                  ...(end ? { contract_end_date: end } : {}),
                })
              }} 
              style={{ marginBottom: 0 }}
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
              style={{ marginBottom: 0 }}
            />
            <InputField 
              label="계약 종료일" 
              type="date" 
              value={formData.contract_end_date} 
              onChange={e => setFormData({ ...formData, contract_end_date: e.target.value })} 
              style={{ marginBottom: 0 }}
            />
          </div>
        </div>

        <div style={{ borderTop: '1px dashed #e5e5e5', paddingTop: '20px', marginBottom: '20px' }}>
          <div style={{ fontSize: '0.9rem', fontWeight: '600', marginBottom: '10px', color: '#171717' }}>청구 조건</div>
          
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
          
          <details style={{ marginTop: '10px' }}>
            <summary style={{cursor:'pointer', fontSize:'0.85rem', color:'var(--notion-sub-text)', fontWeight:'500'}}>A3 가중치 설정 (기본 1배)</summary>
            <div style={{display:'flex', gap:'12px', marginTop:'12px', padding:'16px', backgroundColor:'var(--notion-soft-bg)', borderRadius:'var(--radius-md)', border:'1px solid var(--notion-border)'}}>
              <InputField label="A3 흑백 배수" type="number" step="0.1" value={formData.plan_weight_a3_bw} onChange={e => setFormData({...formData, plan_weight_a3_bw: Number(e.target.value)})} style={{marginBottom:0}} />
              <InputField label="A3 칼라 배수" type="number" step="0.1" value={formData.plan_weight_a3_col} onChange={e => setFormData({...formData, plan_weight_a3_col: Number(e.target.value)})} style={{marginBottom:0}} />
            </div>
          </details>
        </div>

        <div style={{borderTop:'1px solid var(--notion-border)', paddingTop:'20px'}}>
          <h3 style={{fontSize:'0.9rem', fontWeight:'700', marginBottom:'12px', color:'var(--notion-main-text)'}}>청구 방식</h3>
          
          <label style={{display:'flex', alignItems:'center', gap:'8px', cursor:'pointer', marginBottom:'12px', fontSize:'0.9rem'}}>
            <input
              type="radio"
              name="grouping"
              checked={!formData.billing_group_id}
              onChange={requestUngroup}
            />
            <span>개별 청구 (단독 계산)</span>
          </label>

          {formData.billing_group_id && linkedLabel && (
            <div style={{
              marginBottom: 12,
              padding: '10px 12px',
              background: '#f9f0ff',
              border: '1px solid #d3adf7',
              borderRadius: 8,
              fontSize: '0.82rem',
              color: '#531dab'
            }}>
              합산 연결: <b>{linkedLabel}</b>
            </div>
          )}

          {siblings.length > 0 && (
            <div style={{backgroundColor:'var(--notion-blue-light)', padding:'16px', borderRadius:'var(--radius-md)', border:'1px solid var(--notion-blue)', marginBottom: 12}}>
              <div style={{fontSize:'0.8rem', marginBottom:'10px', fontWeight:'600', color:'var(--notion-blue)'}}>같은 거래처 기기와 합산</div>
              {siblings.map(sib => (
                <label key={sib.id} style={{display:'flex', alignItems:'center', gap:'8px', marginBottom:'6px', fontSize:'0.85rem', cursor:'pointer'}}>
                  <input 
                    type="radio" 
                    name="grouping" 
                    checked={isMachineChecked(sib)} 
                    onChange={() => handleGroupSelect(sib)} 
                  />
                  <span>{sib.model_name} ({sib.serial_number})</span>
                </label>
              ))}
            </div>
          )}

          {/* 다른 거래처 기기 검색 */}
          <div style={{
            padding: 16,
            borderRadius: 8,
            border: '1px solid var(--notion-border)',
            background: '#fff'
          }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 8, color: '#171717' }}>
              다른 거래처 기기와 합산 (검색)
            </div>
            <input
              type="search"
              placeholder="거래처명, 모델명, S/N 검색…"
              value={machineSearch}
              onChange={e => setMachineSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                border: '1px solid #ccc',
                borderRadius: 6,
                fontSize: '0.85rem',
                boxSizing: 'border-box',
                marginBottom: 8
              }}
            />
            {searching && <div style={{ fontSize: '0.75rem', color: '#999' }}>검색 중…</div>}
            {!searching && machineSearch.trim() && searchResults.length === 0 && (
              <div style={{ fontSize: '0.75rem', color: '#999' }}>검색 결과가 없습니다.</div>
            )}
            <div style={{ maxHeight: 180, overflowY: 'auto' }}>
              {searchResults.map(m => {
                const sameClient = m.client_id === clientId
                return (
                  <label
                    key={m.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                      padding: '8px 4px',
                      borderBottom: '1px solid #f0f0f0',
                      fontSize: '0.82rem',
                      cursor: 'pointer'
                    }}
                  >
                    <input
                      type="radio"
                      name="grouping"
                      checked={isMachineChecked(m)}
                      onChange={() => handleGroupSelect(m)}
                      style={{ marginTop: 3 }}
                    />
                    <span>
                      <b style={{ color: sameClient ? '#171717' : '#0070f3' }}>
                        [{m.client?.name || '거래처'}]
                      </b>{' '}
                      {m.model_name}
                      <span style={{ color: '#888' }}> ({m.serial_number})</span>
                      {m.billing_group_id && (
                        <span style={{ marginLeft: 6, fontSize: '0.7rem', color: '#9065b0' }}>합산중</span>
                      )}
                    </span>
                  </label>
                )
              })}
            </div>
          </div>
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
