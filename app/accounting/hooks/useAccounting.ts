// hooks/useAccounting.ts
import { useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@/utils/supabase'
import { calculateClientBill } from '@/utils/billingCalculator'

export function useAccounting() {
  const supabase = createClient()
  
  const [loading, setLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  
  // 1. 등록 탭 상태
  const [regYear, setRegYear] = useState(new Date().getFullYear())
  const [regMonth, setRegMonth] = useState(new Date().getMonth() + 1)
  const [targetDay, setTargetDay] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
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

  // 2. 이력 탭 상태
  const [isHistOpen, setIsHistOpen] = useState(true)
  const [historyList, setHistoryList] = useState<any[]>([])
  const [histYear, setHistYear] = useState(new Date().getFullYear())
  const [histMonth, setHistMonth] = useState(new Date().getMonth() + 1)
  const [histTargetDay, setHistTargetDay] = useState('all')
  const [histSearchTerm, setHistSearchTerm] = useState('')
  const [histFilterConfig, setHistFilterConfig] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    day: 'all',
    term: ''
  })
  const [monthMachineHistory, setMonthMachineHistory] = useState<any[]>([])

  // 데이터 조회 함수들
  const fetchRegistrationData = useCallback(async () => {
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
  }, [filterConfig, supabase])

  const fetchHistoryData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user?.id).single()
    const orgId = profile?.organization_id

    let query = supabase
      .from('settlements')
      .select(`*, client:client_id(name), details:settlement_details(*, inventory:inventory_id(model_name, serial_number, status, billing_date))`)
      .eq('organization_id', orgId)
      .eq('billing_year', histFilterConfig.year)
      .eq('billing_month', histFilterConfig.month)
      .order('created_at', { ascending: false })

    const { data } = await query
      
    if (data) {
      let filtered = data;
      if (histFilterConfig.day !== 'all') {
        filtered = filtered.filter(item => 
          item.details?.some((d: any) => d.inventory?.billing_date === histFilterConfig.day)
        )
      }
      if (histFilterConfig.term) {
        const term = histFilterConfig.term.toLowerCase()
        filtered = filtered.filter(item => 
          item.client?.name?.toLowerCase().includes(term) ||
          item.details?.some((d: any) => 
            d.inventory?.model_name?.toLowerCase().includes(term) || 
            d.inventory?.serial_number?.toLowerCase().includes(term)
          )
        )
      }
      setHistoryList(filtered)
    }

    const startDate = new Date(histFilterConfig.year, histFilterConfig.month - 1, 1).toISOString()
    const endDate = new Date(histFilterConfig.year, histFilterConfig.month, 0, 23, 59, 59).toISOString()

    const { data: mHistory } = await supabase
      .from('machine_history')
      .select('inventory_id, action_type, memo')
      .eq('organization_id', orgId)
      .gte('recorded_at', startDate)
      .lte('recorded_at', endDate)
    
    if (mHistory) setMonthMachineHistory(mHistory)
  }, [histFilterConfig, supabase])

  // 초기 로딩
  useEffect(() => { fetchRegistrationData() }, [fetchRegistrationData])
  useEffect(() => { fetchHistoryData() }, [fetchHistoryData])

  // 핸들러 함수들
  const handleSearch = () => setFilterConfig({ year: regYear, month: regMonth, day: targetDay, term: searchTerm })
  const handleHistSearch = () => setHistFilterConfig({ year: histYear, month: histMonth, day: histTargetDay, term: histSearchTerm })

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

  const calculateClientBillFiltered = (client: any) => {
    const assets = inventoryMap[client.id] || []
    const originalBill = calculateClientBill(client, assets, prevData, inputData)
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
        const clientBillingDate = inventoryMap[clientId]?.[0]?.billing_date || '말일';
        const { data: settlement, error: sErr } = await supabase.from('settlements').insert({
          organization_id: orgId, client_id: clientId,
          billing_year: filterConfig.year, billing_month: filterConfig.month, 
          billing_date: clientBillingDate, total_amount: selectedTotalAmount, is_paid: false
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
    setIsModalOpen(false); setSelectedInventories(new Set()); setInputData({}); 
    await fetchHistoryData(); await fetchRegistrationData(); setLoading(false)
  }

  const handleRebillHistory = async (id: string) => {
    if (!confirm('이 건을 재청구하시겠습니까?\n\n청구 내역만 삭제되며, 기계 이력(설치/철수)은 유지됩니다.')) return;
    setLoading(true);
    try {
      await supabase.from('settlement_details').delete().eq('settlement_id', id);
      const { error } = await supabase.from('settlements').delete().eq('id', id);
      if (error) throw error;
      alert('재청구 처리가 완료되었습니다.');
      await fetchHistoryData(); await fetchRegistrationData();
    } catch (e: any) { alert('오류: ' + e.message); } finally { setLoading(false); }
  }

  const handleDeleteHistory = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    setLoading(true);
    try {
      const { data: details } = await supabase.from('settlement_details').select('inventory_id, is_replacement_record').eq('settlement_id', id);
      const invIds = details?.map(d => d.inventory_id) || [];
      const replacementInvIds = details?.filter(d => d.is_replacement_record).map(d => d.inventory_id) || [];
      const startDate = new Date(histYear, histMonth - 1, 1).toISOString();
      const nextMonthDate = new Date(histYear, histMonth, 1);
      const endDate = nextMonthDate.toISOString();

      if (invIds.length > 0) {
        const { data: installedHistory } = await supabase.from('machine_history').select('inventory_id').in('inventory_id', invIds).eq('action_type', 'INSTALL').gte('recorded_at', startDate).lt('recorded_at', endDate);
        const installedInvIds = installedHistory?.map(h => h.inventory_id) || [];
        if (installedInvIds.length > 0) {
           await supabase.from('inventory').update({ status: '창고', client_id: null, last_status_updated_at: new Date().toISOString() }).in('id', installedInvIds);
        }
        if (replacementInvIds.length > 0 || installedInvIds.length > 0) {
          const idsToDeleteHistory = [...new Set([...installedInvIds, ...replacementInvIds])];
          await supabase.from('machine_history').delete().in('inventory_id', idsToDeleteHistory).gte('recorded_at', startDate).lt('recorded_at', endDate);
        }
      }
      const { error } = await supabase.from('settlements').delete().eq('id', id);
      if (error) throw error;
      alert('삭제되었습니다.');
      await fetchHistoryData(); await fetchRegistrationData();
    } catch (e: any) { alert('삭제 중 오류 발생: ' + e.message); } finally { setLoading(false); }
  }

  const handleDetailRebill = async (settlementId: string, detailId: string, inventoryId: string, isReplacement: boolean, clientId: string) => {
    if (!confirm('이 기계만 재청구하시겠습니까?')) return;
    try {
      await supabase.from('settlement_details').delete().eq('id', detailId);
      if (isReplacement) {
        await supabase.from('inventory').update({ status: '교체전(철수)', client_id: clientId }).eq('id', inventoryId);
      }
      const { count } = await supabase.from('settlement_details').select('*', { count: 'exact', head: true }).eq('settlement_id', settlementId);
      if (count === 0) await supabase.from('settlements').delete().eq('id', settlementId);
      alert('재청구 상태로 변경되었습니다.');
      await fetchHistoryData(); await fetchRegistrationData();
    } catch (e: any) { alert('재청구 처리 중 오류: ' + e.message); }
  }

  const handleDeleteDetail = async (settlementId: string, detailId: string, inventoryId: string, amount: number, isReplacement: boolean) => {
    if (!confirm('이 기록을 완전히 삭제하시겠습니까?')) return;
    try {
      await supabase.from('settlement_details').delete().eq('id', detailId);
      const { data: settlement } = await supabase.from('settlements').select('total_amount').eq('id', settlementId).single();
      if (settlement) {
        const newTotal = Math.max(0, settlement.total_amount - amount);
        await supabase.from('settlements').update({ total_amount: newTotal }).eq('id', settlementId);
      }
      const { count } = await supabase.from('settlement_details').select('*', { count: 'exact', head: true }).eq('settlement_id', settlementId);
      if (count === 0) await supabase.from('settlements').delete().eq('id', settlementId);

      const startDate = new Date(histYear, histMonth - 1, 1).toISOString();
      const nextMonthDate = new Date(histYear, histMonth, 1);
      const endDate = nextMonthDate.toISOString();

      await supabase.from('machine_history').delete().eq('inventory_id', inventoryId).gte('recorded_at', startDate).lt('recorded_at', endDate);
      const { data: installedHistory } = await supabase.from('machine_history').select('id').eq('inventory_id', inventoryId).eq('action_type', 'INSTALL').gte('recorded_at', startDate).lt('recorded_at', endDate);
      if (installedHistory && installedHistory.length > 0) {
         await supabase.from('inventory').update({ status: '창고', client_id: null, last_status_updated_at: new Date().toISOString() }).eq('id', inventoryId);
      }
      alert('기록이 삭제되었습니다.');
      await fetchHistoryData(); await fetchRegistrationData();
    } catch (e: any) { alert('삭제 중 오류 발생: ' + e.message); }
  }

  const handleExcludeAsset = async (asset: any) => {
    if (!confirm(`[${asset.model_name}] 기계를 이번 달 청구 목록에서 제외하시겠습니까?`)) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user?.id).single();
      const orgId = profile?.organization_id;

      let settlementId = '';
      const { data: existingSettlements } = await supabase.from('settlements').select('id, total_amount').eq('organization_id', orgId).eq('client_id', asset.inv.client_id).eq('billing_year', filterConfig.year).eq('billing_month', filterConfig.month);

      if (existingSettlements && existingSettlements.length > 0) settlementId = existingSettlements[0].id;
      else {
        const { data: settlement, error: sErr } = await supabase.from('settlements').insert({ organization_id: orgId, client_id: asset.inv.client_id, billing_year: filterConfig.year, billing_month: filterConfig.month, total_amount: 0, is_paid: false }).select().single();
        if (sErr || !settlement) throw new Error('정산서 생성 실패');
        settlementId = settlement.id;
      }

      await supabase.from('settlement_details').insert({
        settlement_id: settlementId, inventory_id: asset.inventory_id, prev_count_bw: asset.prev.bw, curr_count_bw: asset.prev.bw, prev_count_col: asset.prev.col, curr_count_col: asset.prev.col, prev_count_bw_a3: asset.prev.bw_a3, curr_count_bw_a3: asset.prev.bw_a3, prev_count_col_a3: asset.prev.col_a3, curr_count_col_a3: asset.prev.col_a3, calculated_amount: 0, is_replacement_record: (asset.inv.is_replacement_before || asset.inv.is_withdrawal) ? true : false
      });

      if (asset.inv.is_replacement_before || asset.inv.is_withdrawal) {
        await supabase.from('inventory').update({ status: '창고', client_id: null, last_status_updated_at: new Date().toISOString() }).eq('id', asset.inventory_id);
      }
      alert('목록에서 제외되었습니다.');
      await fetchHistoryData(); await fetchRegistrationData();
    } catch (e: any) { alert('처리 중 오류 발생: ' + e.message); } finally { setLoading(false); }
  }

  return {
    // State
    loading, isModalOpen, setIsModalOpen,
    regYear, setRegYear, regMonth, setRegMonth, targetDay, setTargetDay, searchTerm, setSearchTerm,
    isRegOpen, setIsRegOpen,
    filteredClients, inventoryMap, inputData, prevData, selectedInventories, showUnregistered, setShowUnregistered,
    isHistOpen, setIsHistOpen, historyList,
    histYear, setHistYear, histMonth, setHistMonth, histTargetDay, setHistTargetDay, histSearchTerm, setHistSearchTerm,
    monthMachineHistory, clients,
    
    // Actions
    handleSearch, handleHistSearch, handleInputChange, toggleInventorySelection, setSelectedInventoriesBulk,
    calculateClientBillFiltered, calculateSelectedTotal, handlePreSave, handleFinalSave,
    handleRebillHistory, handleDeleteHistory, handleDetailRebill, handleDeleteDetail, handleExcludeAsset
  }
}