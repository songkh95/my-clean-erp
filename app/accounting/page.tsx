'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/utils/supabase'
import styles from './accounting.module.css'

import AccountingRegistration from '@/components/accounting/AccountingRegistration'
import AccountingHistory from '@/components/accounting/AccountingHistory'
import SettlementConfirmModal from '@/components/accounting/SettlementConfirmModal'

export default function AccountingPage() {
  const supabase = createClient()
  
  const [loading, setLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  
  // 입력용 상태 (입력창과 연결)
  const [regYear, setRegYear] = useState(new Date().getFullYear())
  const [regMonth, setRegMonth] = useState(new Date().getMonth() + 1)
  const [targetDay, setTargetDay] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  // 실제 필터 적용 상태 (조회 버튼 클릭 시 업데이트)
  const [filterConfig, setFilterConfig] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    day: 'all',
    term: ''
  })

  const [isRegOpen, setIsRegOpen] = useState(true)
  const [clients, setClients] = useState<any[]>([])
  const [inventoryMap, setInventoryMap] = useState<{[key: string]: any[]}>({}) 
  const [inputData, setInputData] = useState<{[key: string]: any}>({}) 
  const [prevData, setPrevData] = useState<{[key: string]: any}>({})
  const [selectedInventories, setSelectedInventories] = useState<Set<string>>(new Set()) 
  const [showUnregistered, setShowUnregistered] = useState(false)

  const [isHistOpen, setIsHistOpen] = useState(true)
  const [historyList, setHistoryList] = useState<any[]>([])
  const [histYear, setHistYear] = useState(new Date().getFullYear())
  const [histMonth, setHistMonth] = useState(new Date().getMonth() + 1)

  useEffect(() => { fetchRegistrationData() }, [filterConfig.year, filterConfig.month])
  useEffect(() => { fetchHistoryData() }, [histYear, histMonth])

  // [조회] 버튼 클릭 시 필터링 실행
  const handleSearch = () => {
    setFilterConfig({
      year: regYear,
      month: regMonth,
      day: targetDay,
      term: searchTerm
    })
  }

  const fetchRegistrationData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user?.id).single()
    const orgId = profile?.organization_id

    if (!orgId) return

    const { data: clientData } = await supabase.from('clients')
      .select('*')
      .eq('organization_id', orgId)
      .order('name')
    
    if (clientData) setClients(clientData)

    const { data: invData } = await supabase.from('inventory')
      .select('*')
      .eq('organization_id', orgId)
      .not('client_id', 'is', null)
      .order('created_at', { ascending: true })

    const invMap: {[key: string]: any[]} = {}
    if (invData) {
      invData.forEach(inv => {
        if (!invMap[inv.client_id]) invMap[inv.client_id] = []
        invMap[inv.client_id].push(inv)
      })
    }
    setInventoryMap(invMap)

    let prevY = filterConfig.year, prevM = filterConfig.month - 1
    if (prevM === 0) { prevM = 12; prevY -= 1 }

    const { data: prevSettlements } = await supabase.from('settlements').select('id, client_id').eq('organization_id', orgId).eq('billing_year', prevY).eq('billing_month', prevM)
    const prevMap: {[key: string]: any} = {}
    
    if (prevSettlements && prevSettlements.length > 0) {
      const settlementIds = prevSettlements.map(s => s.id)
      const { data: details } = await supabase.from('settlement_details').select('inventory_id, curr_count_bw, curr_count_col, curr_count_bw_a3, curr_count_col_a3').in('settlement_id', settlementIds)
      
      if (details) {
        details.forEach(d => {
          if (d.inventory_id) prevMap[d.inventory_id] = { bw: d.curr_count_bw, col: d.curr_count_col, bw_a3: d.curr_count_bw_a3, col_a3: d.curr_count_col_a3 }
        })
      }
    }

    if (invData) {
      invData.forEach(inv => {
        if (!prevMap[inv.id]) prevMap[inv.id] = { bw: inv.initial_count_bw||0, col: inv.initial_count_col||0, bw_a3: inv.initial_count_bw_a3||0, col_a3: inv.initial_count_col_a3||0 }
      })
    }
    setPrevData(prevMap)
    setLoading(false)
  }

  const fetchHistoryData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user?.id).single()
    const { data } = await supabase.from('settlements').select('*, client:client_id(name)').eq('organization_id', profile?.organization_id).eq('billing_year', histYear).eq('billing_month', histMonth).order('created_at', { ascending: false })
    if (data) setHistoryList(data)
  }

  const handleInputChange = (invId: string, field: string, value: string) => {
    const numValue = value === '' ? 0 : Number(value)
    setInputData((prev: any) => ({ ...prev, [invId]: { ...prev[invId], [field]: numValue } }))
  }

  const toggleInventorySelection = (invId: string) => {
    const newSet = new Set(selectedInventories)
    if (newSet.has(invId)) newSet.delete(invId)
    else newSet.add(invId)
    setSelectedInventories(newSet)
  }

  const setSelectedInventoriesBulk = (ids: string[], action: 'add' | 'remove') => {
  const newSet = new Set(selectedInventories);
  ids.forEach(id => {
    if (action === 'add') newSet.add(id);
    else newSet.delete(id);
  });
  setSelectedInventories(newSet);
}

  const calculateClientBill = (client: any) => {
    const assets = inventoryMap[client.id] || []
    
    let tempCalculations: any[] = assets.map(inv => {
      const p = prevData[inv.id] || { bw:0, col:0, bw_a3:0, col_a3:0 }
      const c = inputData[inv.id] || { bw:0, col:0, bw_a3:0, col_a3:0 }

      const usageRawBW = Math.max(0, (c.bw || 0) - (p.bw || 0))
      const usageRawCol = Math.max(0, (c.col || 0) - (p.col || 0))
      const usageRawBW_A3 = Math.max(0, (c.bw_a3 || 0) - (p.bw_a3 || 0))
      const usageRawCol_A3 = Math.max(0, (c.col_a3 || 0) - (p.col_a3 || 0))

      const weightBW = inv.plan_weight_a3_bw || 1
      const weightCol = inv.plan_weight_a3_col || 1

      const convertedBW = usageRawBW + (usageRawBW_A3 * weightBW)
      const convertedCol = usageRawCol + (usageRawCol_A3 * weightCol)

      return {
        inv,
        inventory_id: inv.id,
        model_name: inv.model_name,
        serial_number: inv.serial_number,
        billing_group_id: inv.billing_group_id,
        prev: p, curr: c,
        usage: { bw: usageRawBW, col: usageRawCol, bw_a3: usageRawBW_A3, col_a3: usageRawCol_A3 },
        converted: { bw: convertedBW, col: convertedCol },
        usageBreakdown: { basicBW: 0, extraBW: 0, basicCol: 0, extraCol: 0 },
        plan: {
          basic_fee: inv.plan_basic_fee || 0,
          free_bw: inv.plan_basic_cnt_bw || 0,
          free_col: inv.plan_basic_cnt_col || 0,
          price_bw: inv.plan_price_bw || 0,
          price_col: inv.plan_price_col || 0
        },
        rowCost: { basic: 0, extra: 0, total: 0 },
        isGroupLeader: true,
        groupSpan: 1
      }
    })

    const groups: {[key: string]: any[]} = {}
    tempCalculations.forEach(calc => {
      const groupKey = calc.billing_group_id || `INDIVIDUAL_${calc.inventory_id}`
      if (!groups[groupKey]) groups[groupKey] = []
      groups[groupKey].push(calc)
    })

    Object.values(groups).forEach(groupAssets => {
      const groupBasicFee = groupAssets.reduce((sum, item) => sum + item.plan.basic_fee, 0)
      const groupFreeBW = groupAssets.reduce((sum, item) => sum + item.plan.free_bw, 0)
      const groupFreeCol = groupAssets.reduce((sum, item) => sum + item.plan.free_col, 0)
      
      const groupUsageBW = groupAssets.reduce((sum, item) => sum + item.converted.bw, 0)
      const groupUsageCol = groupAssets.reduce((sum, item) => sum + item.converted.col, 0)

      const usedBasicBW = Math.min(groupUsageBW, groupFreeBW)
      const usedExtraBW = Math.max(0, groupUsageBW - groupFreeBW)
      
      const usedBasicCol = Math.min(groupUsageCol, groupFreeCol)
      const usedExtraCol = Math.max(0, groupUsageCol - groupFreeCol)

      const unitPriceBW = groupAssets[0].plan.price_bw
      const unitPriceCol = groupAssets[0].plan.price_col

      const groupExtraFee = (usedExtraBW * unitPriceBW) + (usedExtraCol * unitPriceCol)
      const groupTotal = groupBasicFee + groupExtraFee

      groupAssets.forEach((asset, idx) => {
        if (idx === 0) {
          asset.isGroupLeader = true
          asset.groupSpan = groupAssets.length
          asset.rowCost = { basic: groupBasicFee, extra: groupExtraFee, total: groupTotal }
          asset.usageBreakdown = { 
            basicBW: usedBasicBW, extraBW: usedExtraBW,
            basicCol: usedBasicCol, extraCol: usedExtraCol
          }
        } else {
          asset.isGroupLeader = false
          asset.groupSpan = 0
          asset.rowCost = { basic: 0, extra: 0, total: 0 }
        }
      })
    })

    const totalAmount = tempCalculations.reduce((sum, d) => sum + (d.isGroupLeader ? d.rowCost.total : 0), 0)

    return { details: tempCalculations, totalAmount }
  }

  // 기계별 청구일 기준 필터링된 클라이언트 리스트
  const filteredClients = useMemo(() => {
    return clients.filter(c => {
      const assets = inventoryMap[c.id] || []
      const hasMatchingAsset = assets.some(asset => {
        const matchesDay = filterConfig.day === 'all' || asset.billing_date === filterConfig.day
        const matchesTerm = filterConfig.term === '' || 
                           c.name.includes(filterConfig.term) || 
                           asset.model_name.includes(filterConfig.term) || 
                           asset.serial_number.includes(filterConfig.term)
        return matchesDay && matchesTerm
      })

      if (!hasMatchingAsset) return false
      if (showUnregistered) {
        return !historyList.some(h => h.client_id === c.id)
      }
      return true
    })
  }, [clients, inventoryMap, filterConfig, showUnregistered, historyList])

  // 필터링된 계산 함수
  const calculateClientBillFiltered = (client: any) => {
    const originalBill = calculateClientBill(client)
    originalBill.details = originalBill.details.filter((d: any) => 
      filterConfig.day === 'all' || d.inv.billing_date === filterConfig.day
    )
    return originalBill
  }

  const calculateSelectedTotal = (): number => {
    let sum = 0
    clients.forEach(client => {
      const billData = calculateClientBillFiltered(client)
      billData.details.forEach((d: any) => {
        if (selectedInventories.has(d.inventory_id) && d.isGroupLeader) {
          sum += d.rowCost.total
        }
      })
    })
    return sum
  }

  const handlePreSave = () => {
    if (selectedInventories.size === 0) return alert('선택된 기계가 없습니다.')
    setIsModalOpen(true)
  }

  const handleFinalSave = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user?.id).single()
    const orgId = profile?.organization_id

    const affectedClientIds = new Set<string>();
    clients.forEach(c => {
       const assets = inventoryMap[c.id] || [];
       if(assets.some(a => selectedInventories.has(a.id))) affectedClientIds.add(c.id);
    });

    for (const clientId of Array.from(affectedClientIds)) {
      const client = clients.find(c => c.id === clientId)
      if (!client) continue
      const billData = calculateClientBillFiltered(client)

      const { data: settlement, error: sErr } = await supabase.from('settlements').insert({
        organization_id: orgId, client_id: clientId,
        billing_year: filterConfig.year, billing_month: filterConfig.month, 
        total_amount: billData.totalAmount, is_paid: false
      }).select().single()

      if (sErr || !settlement) continue

      const detailsPayload = billData.details.map((d: any) => ({
        settlement_id: settlement.id, inventory_id: d.inventory_id,
        prev_count_bw: d.prev.bw, curr_count_bw: d.curr.bw, prev_count_col: d.prev.col, curr_count_col: d.curr.col,
        prev_count_bw_a3: d.prev.bw_a3, curr_count_bw_a3: d.curr.bw_a3, prev_count_col_a3: d.prev.col_a3, curr_count_col_a3: d.curr.col_a3,
        calculated_amount: d.rowCost.total
      }))
      await supabase.from('settlement_details').insert(detailsPayload)
    }
    alert('저장되었습니다!')
    setIsModalOpen(false); setSelectedInventories(new Set()); setInputData({}); 
    fetchHistoryData(); setLoading(false)
  }

  const handleDeleteHistory = async (id: string) => {
    if (confirm('정말 삭제하시겠습니까?')) {
      await supabase.from('settlements').delete().eq('id', id)
      fetchHistoryData()
    }
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>💰 정산 및 회계 관리</h1>
      <AccountingRegistration 
        isRegOpen={isRegOpen} setIsRegOpen={setIsRegOpen}
        regYear={regYear} setRegYear={setRegYear}
        regMonth={regMonth} setRegMonth={setRegMonth}
        targetDay={targetDay} setTargetDay={setTargetDay}
        searchTerm={searchTerm} setSearchTerm={setSearchTerm}
        showUnregistered={showUnregistered} setShowUnregistered={setShowUnregistered}
        loading={loading} filteredClients={filteredClients}
        inventoryMap={inventoryMap} inputData={inputData}
        prevData={prevData} selectedInventories={selectedInventories}
        handleInputChange={handleInputChange} toggleInventorySelection={toggleInventorySelection}
        calculateClientBill={calculateClientBillFiltered}
        calculateSelectedTotal={calculateSelectedTotal}
        handlePreSave={handlePreSave}
        onSearch={handleSearch}
        setSelectedInventoriesBulk={setSelectedInventoriesBulk}
      />
      <AccountingHistory 
        isHistOpen={isHistOpen} setIsHistOpen={setIsHistOpen}
        histYear={histYear} setHistYear={setHistYear}
        histMonth={histMonth} setHistMonth={setHistMonth}
        historyList={historyList} handleDeleteHistory={handleDeleteHistory}
      />
      {isModalOpen && (
        <SettlementConfirmModal 
          selectedInventories={selectedInventories} calculateSelectedTotal={calculateSelectedTotal}
          clients={clients} inventoryMap={inventoryMap} calculateClientBill={calculateClientBillFiltered}
          onClose={() => setIsModalOpen(false)} onSave={handleFinalSave}
        />
      )}
    </div>
  )
}