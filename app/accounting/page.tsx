'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/utils/supabase'
import styles from './accounting.module.css'

import AccountingRegistration from '@/components/accounting/AccountingRegistration'
import AccountingHistory from '@/components/accounting/AccountingHistory'
import SettlementConfirmModal from '@/components/accounting/SettlementConfirmModal'
import ManualBillingModal from '@/components/accounting/ManualBillingModal'

export default function AccountingPage() {
  const supabase = createClient()
  
  const [loading, setLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isManualModalOpen, setIsManualModalOpen] = useState(false)
  
  // 입력용 상태
  const [regYear, setRegYear] = useState(new Date().getFullYear())
  const [regMonth, setRegMonth] = useState(new Date().getMonth() + 1)
  const [targetDay, setTargetDay] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  // 실제 필터 적용 상태
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
  const [monthMachineHistory, setMonthMachineHistory] = useState<any[]>([])

  useEffect(() => { fetchRegistrationData() }, [filterConfig.year, filterConfig.month])
  useEffect(() => { fetchHistoryData() }, [histYear, histMonth]) 

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

    const { data: clientData } = await supabase.from('clients').select('*').eq('organization_id', orgId).order('name')
    if (clientData) setClients(clientData)

    const { data: invData } = await supabase.from('inventory')
      .select('*')
      .eq('organization_id', orgId)
      .not('client_id', 'is', null)
      .order('created_at', { ascending: true })

    const startDate = new Date(filterConfig.year, filterConfig.month - 1, 1).toISOString()
    const endDate = new Date(filterConfig.year, filterConfig.month, 0, 23, 59, 59).toISOString()

    const { data: historyData } = await supabase
      .from('machine_history')
      .select('*, inventory(*)')
      .eq('organization_id', orgId)
      .gte('recorded_at', startDate)
      .lte('recorded_at', endDate)

    const invMap: {[key: string]: any[]} = {}
    
    invData?.forEach(inv => {
      if (!invMap[inv.client_id]) invMap[inv.client_id] = []
      const isNewReplacement = historyData?.some(h => h.inventory_id === inv.id && h.action_type === 'INSTALL');
      invMap[inv.client_id].push({ ...inv, is_active: true, is_replacement_after: isNewReplacement })
    });

    historyData?.forEach(hist => {
      if (hist.action_type === 'WITHDRAW') {
        if (!invMap[hist.client_id]) invMap[hist.client_id] = []
        const alreadyIn = invMap[hist.client_id].some(item => item.id === hist.inventory_id)
        if (!alreadyIn) {
          const isReplacementBefore = hist.memo?.includes('교체');
          invMap[hist.client_id].push({ 
            ...hist.inventory, 
            is_active: false, 
            is_replacement_before: isReplacementBefore,
            is_withdrawal: !isReplacementBefore,
            final_counts: { bw: hist.bw_count, col: hist.col_count, bw_a3: hist.bw_a3_count, col_a3: hist.col_a3_count }
          })
        }
      }
    });

    setInventoryMap(invMap)

    let prevY = filterConfig.year, prevM = filterConfig.month - 1
    if (prevM === 0) { prevM = 12; prevY -= 1 }

    const { data: prevSettlements } = await supabase.from('settlements').select('id').eq('organization_id', orgId).eq('billing_year', prevY).eq('billing_month', prevM)
    const prevMap: {[key: string]: any} = {}
    
    if (prevSettlements && prevSettlements.length > 0) {
      const settlementIds = prevSettlements.map(s => s.id)
      const { data: details } = await supabase.from('settlement_details').select('inventory_id, curr_count_bw, curr_count_col, curr_count_bw_a3, curr_count_col_a3').in('settlement_id', settlementIds)
      details?.forEach(d => { if (d.inventory_id) prevMap[d.inventory_id] = { bw: d.curr_count_bw, col: d.curr_count_col, bw_a3: d.curr_count_bw_a3, col_a3: d.curr_count_col_a3 } })
    }

    const allInventories = [...(invData || []), ...(historyData?.map(h => h.inventory).filter(Boolean) || [])]
    allInventories.forEach(inv => {
      if (inv && !prevMap[inv.id]) {
        prevMap[inv.id] = { bw: inv.initial_count_bw||0, col: inv.initial_count_col||0, bw_a3: inv.initial_count_bw_a3||0, col_a3: inv.initial_count_col_a3||0 }
      }
    })
    setPrevData(prevMap)
    setLoading(false)
  }

  const fetchHistoryData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user?.id).single()
    const orgId = profile?.organization_id

    const { data } = await supabase
      .from('settlements')
      .select(`*, client:client_id(name), details:settlement_details(*, inventory:inventory_id(model_name, serial_number, status))`)
      .eq('organization_id', orgId)
      .eq('billing_year', histYear)
      .eq('billing_month', histMonth)
      .order('created_at', { ascending: false })
      
    if (data) setHistoryList(data)

    const startDate = new Date(histYear, histMonth - 1, 1).toISOString()
    const endDate = new Date(histYear, histMonth, 0, 23, 59, 59).toISOString()

    const { data: mHistory } = await supabase
      .from('machine_history')
      .select('inventory_id, action_type, memo')
      .eq('organization_id', orgId)
      .gte('recorded_at', startDate)
      .lte('recorded_at', endDate)
    
    if (mHistory) setMonthMachineHistory(mHistory)
  }

  const handleInputChange = (invId: string, field: string, value: string) => {
    const numValue = value === '' ? 0 : Number(value)
    setInputData((prev: any) => ({ ...prev, [invId]: { ...prev[invId], [field]: numValue } }))
  }

  const toggleInventorySelection = (invId: string) => {
    const newSet = new Set(selectedInventories)
    
    let targetAsset = null;
    for (const clientId in inventoryMap) {
      const found = inventoryMap[clientId].find(a => a.id === invId);
      if (found) { targetAsset = found; break; }
    }

    if (targetAsset && targetAsset.billing_group_id) {
      const groupIds: string[] = [];
      for (const clientId in inventoryMap) {
        const groupAssets = inventoryMap[clientId].filter(a => a.billing_group_id === targetAsset.billing_group_id);
        groupAssets.forEach(a => groupIds.push(a.id));
      }
      const isCurrentlySelected = newSet.has(invId);
      if (isCurrentlySelected) groupIds.forEach(id => newSet.delete(id));
      else groupIds.forEach(id => newSet.add(id));
    } else {
      if (newSet.has(invId)) newSet.delete(invId)
      else newSet.add(invId)
    }
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
      const isWithdrawn = inv.is_replacement_before || inv.is_withdrawal;
      const c = isWithdrawn ? inv.final_counts : (inputData[inv.id] || { bw:0, col:0, bw_a3:0, col_a3:0 })
      
      const usageRawBW = Math.max(0, (c.bw || 0) - (p.bw || 0))
      const usageRawCol = Math.max(0, (c.col || 0) - (p.col || 0))
      const usageRawBW_A3 = Math.max(0, (c.bw_a3 || 0) - (p.bw_a3 || 0))
      const usageRawCol_A3 = Math.max(0, (c.col_a3 || 0) - (p.col_a3 || 0))
      const weightBW = inv.plan_weight_a3_bw || 1
      const weightCol = inv.plan_weight_a3_col || 1
      const convertedBW = usageRawBW + (usageRawBW_A3 * weightBW)
      const convertedCol = usageRawCol + (usageRawCol_A3 * weightCol)

      return {
        inv, inventory_id: inv.id, model_name: inv.model_name, serial_number: inv.serial_number, billing_group_id: inv.billing_group_id,
        prev: p, curr: c, usage: { bw: usageRawBW, col: usageRawCol, bw_a3: usageRawBW_A3, col_a3: usageRawCol_A3 },
        converted: { bw: convertedBW, col: convertedCol },
        usageBreakdown: { basicBW: 0, extraBW: 0, basicCol: 0, extraCol: 0 },
        plan: { basic_fee: inv.plan_basic_fee || 0, free_bw: inv.plan_basic_cnt_bw || 0, free_col: inv.plan_basic_cnt_col || 0, price_bw: inv.plan_price_bw || 0, price_col: inv.plan_price_col || 0 },
        rowCost: { basic: 0, extra: 0, total: 0 }, isGroupLeader: true, groupSpan: 1
      }
    });

    const groups: {[key: string]: any[]} = {}
    tempCalculations.forEach(calc => {
      const groupKey = calc.billing_group_id || `INDIVIDUAL_${calc.inventory_id}`
      if (!groups[groupKey]) groups[groupKey] = []
      groups[groupKey].push(calc)
    });

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
          asset.isGroupLeader = true; asset.groupSpan = groupAssets.length;
          asset.rowCost = { basic: groupBasicFee, extra: groupExtraFee, total: groupTotal };
          asset.usageBreakdown = { basicBW: usedBasicBW, extraBW: usedExtraBW, basicCol: usedBasicCol, extraCol: usedExtraCol };
        } else { 
          asset.isGroupLeader = false; asset.groupSpan = 0; 
          asset.rowCost = { basic: 0, extra: 0, total: 0 };
          asset.usageBreakdown = { basicBW: 0, extraBW: 0, basicCol: 0, extraCol: 0 };
        }
      });
    });

    const totalAmount = tempCalculations.reduce((sum, d) => sum + (d.isGroupLeader ? (d.rowCost?.total || 0) : 0), 0)
    return { details: tempCalculations, totalAmount }
  }

  const filteredClients = useMemo(() => {
    return clients.filter(c => {
      const assets = inventoryMap[c.id] || []
      const hasUnsettledAsset = assets.some(asset => {
        const isAlreadySettled = historyList.some(h => 
          h.billing_year === filterConfig.year &&
          h.billing_month === filterConfig.month &&
          h.details?.some((d: any) => d.inventory_id === asset.id)
        );
        if (isAlreadySettled) return false;
        const matchesDay = filterConfig.day === 'all' || asset.billing_date === filterConfig.day
        const matchesTerm = filterConfig.term === '' || 
                           c.name.includes(filterConfig.term) || 
                           asset.model_name.includes(filterConfig.term) || 
                           asset.serial_number.includes(filterConfig.term)
        return matchesDay && matchesTerm
      });
      return hasUnsettledAsset;
    })
  }, [clients, inventoryMap, filterConfig, historyList])

  const calculateClientBillFiltered = (client: any) => {
    const originalBill = calculateClientBill(client)
    originalBill.details = originalBill.details.filter((d: any) => {
        const isSettled = historyList.some(h => 
            h.billing_year === filterConfig.year &&
            h.billing_month === filterConfig.month &&
            h.details?.some((det: any) => det.inventory_id === d.inventory_id)
        );
        return !isSettled;
    });
    originalBill.totalAmount = originalBill.details.reduce((sum: number, d: any) => 
      sum + (d.isGroupLeader ? (d.rowCost?.total || 0) : 0), 0);
    return originalBill
  }

  const calculateSelectedTotal = (targetClients = clients): number => {
    let sum = 0
    targetClients.forEach(client => {
      const billData = calculateClientBillFiltered(client)
      billData.details.forEach((d: any) => { if (selectedInventories.has(d.inventory_id) && d.isGroupLeader) sum += (d.rowCost?.total || 0) })
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
      const selectedDetails = billData.details.filter((d: any) => selectedInventories.has(d.inventory_id));
      if (selectedDetails.length === 0) continue;

      const selectedTotalAmount = selectedDetails.reduce((sum: number, d: any) => d.isGroupLeader ? sum + d.rowCost.total : sum, 0);

      const { data: existingSettlements } = await supabase
        .from('settlements')
        .select('id, total_amount')
        .eq('organization_id', orgId)
        .eq('client_id', clientId)
        .eq('billing_year', filterConfig.year)
        .eq('billing_month', filterConfig.month);

      let settlementId = '';

      if (existingSettlements && existingSettlements.length > 0) {
        const targetSettlement = existingSettlements[0];
        settlementId = targetSettlement.id;
        const newTotal = (targetSettlement.total_amount || 0) + selectedTotalAmount;
        await supabase.from('settlements').update({ total_amount: newTotal, updated_at: new Date().toISOString() }).eq('id', settlementId);
      } else {
        const { data: settlement, error: sErr } = await supabase.from('settlements').insert({
          organization_id: orgId, client_id: clientId,
          billing_year: filterConfig.year, billing_month: filterConfig.month, 
          total_amount: selectedTotalAmount, is_paid: false
        }).select().single()

        if (sErr || !settlement) continue
        settlementId = settlement.id;
      }

      const detailsPayload = selectedDetails.map((d: any) => {
        let finalAmount = 0;
        if (d.billing_group_id) {
          if (d.isGroupLeader) {
            finalAmount = (d.plan.basic_fee || 0) + (d.rowCost.extra || 0);
          } else {
            finalAmount = (d.plan.basic_fee || 0);
          }
        } else {
          finalAmount = d.rowCost.total;
        }

        return {
          settlement_id: settlementId, inventory_id: d.inventory_id,
          prev_count_bw: d.prev.bw, curr_count_bw: d.curr.bw, prev_count_col: d.prev.col, curr_count_col: d.curr.col,
          prev_count_bw_a3: d.prev.bw_a3, curr_count_bw_a3: d.curr.bw_a3, prev_count_col_a3: d.prev.col_a3, curr_count_col_a3: d.curr.col_a3,
          calculated_amount: finalAmount,
          is_replacement_record: (d.inv.is_replacement_before || d.inv.is_withdrawal) ? true : false
        }
      })
      await supabase.from('settlement_details').insert(detailsPayload)

      const withdrawnAssets = selectedDetails.filter((d: any) => d.inv.is_replacement_before || d.inv.is_withdrawal);
      for (const asset of withdrawnAssets) {
        await supabase.from('inventory').update({ status: '창고', client_id: null, last_status_updated_at: new Date().toISOString() }).eq('id', asset.inventory_id);
      }
    }
    
    alert('저장되었습니다!');
    setIsModalOpen(false); 
    setSelectedInventories(new Set()); 
    setInputData({}); 
    await fetchHistoryData(); 
    await fetchRegistrationData();
    setLoading(false);
  }

  // ✅ [수정됨] 재청구 버튼 (상태 복구 포함 - 기존 로직 유지)
  const handleRebillHistory = async (id: string) => {
    if (confirm('정말 재청구하시겠습니까?\n(청구 내역이 삭제되고, 관련 기계들의 상태가 청구 전으로 복구됩니다.)')) {
      const { data: details } = await supabase.from('settlement_details').select('inventory_id').eq('settlement_id', id).eq('is_replacement_record', true);
      await supabase.from('settlements').delete().eq('id', id);
      if (details && details.length > 0) {
        const invIds = details.map(d => d.inventory_id);
        await supabase.from('inventory').update({ status: '교체전(철수)' }).in('id', invIds);
      }
      await fetchHistoryData();
      await fetchRegistrationData();
      alert('재청구 상태로 변경되었습니다. [사용매수 등록] 탭에서 확인해주세요.');
    }
  }

  // ✅ [수정됨] 삭제 버튼: 청구 이력 삭제 + 이번 달 이력 삭제 (기계 상태 변경 X)
  const handleDeleteHistory = async (id: string) => {
    if (confirm('정말 삭제하시겠습니까?\n\n이 작업은 청구 이력과 해당 월의 설치/회수 기록을 삭제하여\n목록에서 해당 건을 완전히 제외합니다.\n(기계의 물리적 상태는 변경되지 않습니다)')) {
      setLoading(true);
      try {
        const { data: details } = await supabase
          .from('settlement_details')
          .select('inventory_id')
          .eq('settlement_id', id);

        const invIds = details?.map(d => d.inventory_id) || [];

        // 1. 정산 내역 삭제
        const { error } = await supabase.from('settlements').delete().eq('id', id);
        if (error) throw error;

        // 2. 이번 달 이력(machine_history) 삭제 -> 목록 재진입 방지
        if (invIds.length > 0) {
          const startDate = new Date(histYear, histMonth - 1, 1).toISOString();
          const endDate = new Date(histYear, histMonth, 0, 23, 59, 59).toISOString();
          
          await supabase.from('machine_history')
            .delete()
            .in('inventory_id', invIds)
            .gte('recorded_at', startDate)
            .lte('recorded_at', endDate);
        }
        
        alert('완전히 삭제되었습니다.');
        await fetchHistoryData();
        await fetchRegistrationData();
      } catch (e: any) {
        alert('삭제 중 오류 발생: ' + e.message);
      } finally {
        setLoading(false);
      }
    }
  }

  // ✅ [수정됨] 개별 삭제: inventory 업데이트 로직 제거
  const handleDeleteDetail = async (settlementId: string, detailId: string, inventoryId: string, amount: number, isReplacement: boolean) => {
    if (!confirm('이 기계의 정산 내역만 삭제하시겠습니까?')) return;
    try {
      await supabase.from('settlement_details').delete().eq('id', detailId);
      const { data: settlement } = await supabase.from('settlements').select('total_amount').eq('id', settlementId).single();
      if (settlement) {
        const newTotal = Math.max(0, settlement.total_amount - amount);
        await supabase.from('settlements').update({ total_amount: newTotal }).eq('id', settlementId);
      }
      // inventory 상태 업데이트 로직 제거됨 (사용자 요청)

      const { count } = await supabase.from('settlement_details').select('*', { count: 'exact', head: true }).eq('settlement_id', settlementId);
      if (count === 0) await supabase.from('settlements').delete().eq('id', settlementId);

      alert('삭제되었습니다.');
      await fetchHistoryData();
      await fetchRegistrationData();
    } catch (e: any) {
      alert('삭제 중 오류가 발생했습니다: ' + e.message);
    }
  }

  const handleExcludeAsset = async (asset: any) => {
    if (!confirm(`[${asset.model_name}] 기계를 이번 달 청구 목록에서 제외하시겠습니까?\n(0원으로 정산 처리되어 목록에서 사라집니다.)`)) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user?.id).single();
      const orgId = profile?.organization_id;

      let settlementId = '';
      const { data: existingSettlements } = await supabase
        .from('settlements')
        .select('id, total_amount')
        .eq('organization_id', orgId)
        .eq('client_id', asset.inv.client_id)
        .eq('billing_year', filterConfig.year)
        .eq('billing_month', filterConfig.month);

      if (existingSettlements && existingSettlements.length > 0) {
        settlementId = existingSettlements[0].id;
      } else {
        const { data: settlement, error: sErr } = await supabase.from('settlements').insert({
          organization_id: orgId, client_id: asset.inv.client_id,
          billing_year: filterConfig.year, billing_month: filterConfig.month, 
          total_amount: 0, is_paid: false
        }).select().single();

        if (sErr || !settlement) throw new Error('정산서 생성 실패');
        settlementId = settlement.id;
      }

      await supabase.from('settlement_details').insert({
        settlement_id: settlementId,
        inventory_id: asset.inventory_id,
        prev_count_bw: asset.prev.bw, curr_count_bw: asset.prev.bw,
        prev_count_col: asset.prev.col, curr_count_col: asset.prev.col,
        prev_count_bw_a3: asset.prev.bw_a3, curr_count_bw_a3: asset.prev.bw_a3,
        prev_count_col_a3: asset.prev.col_a3, curr_count_col_a3: asset.prev.col_a3,
        calculated_amount: 0,
        is_replacement_record: (asset.inv.is_replacement_before || asset.inv.is_withdrawal) ? true : false
      });

      if (asset.inv.is_replacement_before || asset.inv.is_withdrawal) {
        await supabase.from('inventory').update({ 
          status: '창고', 
          client_id: null, 
          last_status_updated_at: new Date().toISOString() 
        }).eq('id', asset.inventory_id);
      }

      alert('목록에서 제외되었습니다.');
      await fetchHistoryData();
      await fetchRegistrationData();

    } catch (e: any) {
      alert('처리 중 오류 발생: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  const handleManualAdd = (client: any, asset: any) => {
    const targetClient = client || { id: 'TEMP_CLIENT_' + asset.id, name: '(미지정 거래처)' };
    
    const clientExists = clients.some(c => c.id === targetClient.id);
    if (!clientExists) {
      setClients(prev => [...prev, targetClient].sort((a,b) => a.name.localeCompare(b.name)));
    }

    const newAsset = {
      ...asset,
      is_active: true,
      plan_basic_fee: asset.plan_basic_fee || 0,
      plan_price_bw: asset.plan_price_bw || 0,
    };

    setInventoryMap(prev => {
      const newList = [...(prev[targetClient.id] || [])];
      if (!newList.some(a => a.id === asset.id)) {
        newList.push(newAsset);
      }
      return { ...prev, [targetClient.id]: newList };
    });

    setIsManualModalOpen(false);
    alert(`[${asset.model_name}] 기계가 목록에 추가되었습니다.\n작성 후 '청구서 확정 및 저장'을 눌러야 반영됩니다.`);
  }

  const existingInventoryIds = useMemo(() => {
    const ids = new Set<string>();
    Object.values(inventoryMap).forEach(list => list.forEach(item => ids.add(item.id)));
    return ids;
  }, [inventoryMap]);

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
        calculateSelectedTotal={() => calculateSelectedTotal(filteredClients)}
        handlePreSave={handlePreSave}
        onSearch={handleSearch}
        setSelectedInventoriesBulk={setSelectedInventoriesBulk}
        handleExcludeAsset={handleExcludeAsset}
        onOpenManualAdd={() => setIsManualModalOpen(true)}
      />

      <AccountingHistory 
        isHistOpen={isHistOpen} setIsHistOpen={setIsHistOpen}
        histYear={histYear} setHistYear={setHistYear}
        histMonth={histMonth} setHistMonth={setHistMonth}
        historyList={historyList} 
        handleRebillHistory={handleRebillHistory}
        handleDeleteHistory={handleDeleteHistory}
        monthMachineHistory={monthMachineHistory} 
        handleDeleteDetail={handleDeleteDetail}   
      />

      {isManualModalOpen && (
        <ManualBillingModal 
          isOpen={isManualModalOpen}
          onClose={() => setIsManualModalOpen(false)}
          onAdd={handleManualAdd}
          existingIds={existingInventoryIds}
        />
      )}
      
      {isModalOpen && (
        <SettlementConfirmModal 
          selectedInventories={selectedInventories} calculateSelectedTotal={() => calculateSelectedTotal(clients)}
          clients={clients} inventoryMap={inventoryMap} calculateClientBill={calculateClientBillFiltered}
          onClose={() => setIsModalOpen(false)} onSave={handleFinalSave}
        />
      )}
    </div>
  )
}