import { useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@/utils/supabase' 
import { calculateClientBill } from '@/utils/billingCalculator'
import { saveSettlementAction } from '@/app/actions/accounting'
import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/supabase'
import { 
  Client, 
  Inventory, 
  Settlement, 
  MachineHistory, 
  CounterData, 
  BillCalculationResult,
  CalculatedAsset,
  SettlementDetail
} from '@/app/types'

export function useAccounting() {
  const supabase = createClient() as SupabaseClient<Database>
  
  const [loading, setLoading] = useState<boolean>(false)
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false)
  
  const [regYear, setRegYear] = useState<number>(new Date().getFullYear())
  const [regMonth, setRegMonth] = useState<number>(new Date().getMonth() + 1)
  const [targetDay, setTargetDay] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState<string>('')
  
  const [filterConfig, setFilterConfig] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    day: 'all',
    term: ''
  })

  const [isRegOpen, setIsRegOpen] = useState<boolean>(true)
  const [clients, setClients] = useState<Client[]>([])
  const [inventoryMap, setInventoryMap] = useState<{[key: string]: Inventory[]}>({}) 
  const [inputData, setInputData] = useState<{[key: string]: CounterData}>({}) 
  const [prevData, setPrevData] = useState<{[key: string]: CounterData}>({})
  const [selectedInventories, setSelectedInventories] = useState<Set<string>>(new Set()) 
  const [showUnregistered, setShowUnregistered] = useState<boolean>(false)

  const [currentSettlements, setCurrentSettlements] = useState<Settlement[]>([])

  const [isHistOpen, setIsHistOpen] = useState<boolean>(true)
  const [historyList, setHistoryList] = useState<Settlement[]>([])
  const [histYear, setHistYear] = useState<number>(new Date().getFullYear())
  const [histMonth, setHistMonth] = useState<number>(new Date().getMonth() + 1)
  const [histTargetDay, setHistTargetDay] = useState<string>('all')
  const [histSearchTerm, setHistSearchTerm] = useState<string>('')
  const [histFilterConfig, setHistFilterConfig] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    day: 'all',
    term: ''
  })
  const [monthMachineHistory, setMonthMachineHistory] = useState<MachineHistory[]>([])

  const fetchRegistrationData = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return;
    
    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
    const orgId = profile?.organization_id
    if (!orgId) return

    const { data: clientData } = await supabase.from('clients').select('*').eq('organization_id', orgId).eq('is_deleted', false).order('name')
    if (clientData) setClients(clientData as Client[])

    const { data: invData } = await supabase.from('inventory')
      .select('*')
      .eq('organization_id', orgId)
      .not('client_id', 'is', null)

    const startDate = new Date(filterConfig.year, filterConfig.month - 1, 1).toISOString()
    const endDate = new Date(filterConfig.year, filterConfig.month, 0, 23, 59, 59).toISOString()

    const { data: historyData } = await supabase
      .from('machine_history')
      .select('*, inventory(*)')
      .eq('organization_id', orgId)
      .gte('recorded_at', startDate)
      .lte('recorded_at', endDate)

    const invMap: {[key: string]: Inventory[]} = {}
    
    const safeInvData = (invData || []) as unknown as Inventory[];
    const safeHistoryData = (historyData || []) as unknown as MachineHistory[];

    safeInvData.forEach((inv) => {
      const cid = inv.client_id!;
      if (!invMap[cid]) invMap[cid] = []
      // @ts-ignore
      const isNewReplacement = safeHistoryData.some(h => h.inventory_id === inv.id && h.action_type === 'INSTALL');
      invMap[cid].push({ ...inv, is_active: true, is_replacement_after: isNewReplacement })
    });

    // @ts-ignore
    safeHistoryData.forEach((hist) => {
      if (hist.action_type === 'WITHDRAW' && hist.client_id) {
        if (!invMap[hist.client_id]) invMap[hist.client_id] = []
        if (!invMap[hist.client_id].some(item => item.id === hist.inventory_id)) {
          const isReplacementBefore = hist.memo?.includes('교체');
          const withdrawnInv = hist.inventory as unknown as Inventory | undefined;
          
          if (withdrawnInv) {
            invMap[hist.client_id].push({ 
                ...withdrawnInv, 
                is_active: false, 
                is_replacement_before: !!isReplacementBefore,
                is_withdrawal: !isReplacementBefore,
                final_counts: { 
                  bw: hist.bw_count || 0, 
                  col: hist.col_count || 0, 
                  bw_a3: hist.bw_a3_count || 0, 
                  col_a3: hist.col_a3_count || 0 
                }
            })
          }
        }
      }
    });
    setInventoryMap(invMap)

    const { data: currSettlements } = await supabase.from('settlements')
      .select('id, client_id, details:settlement_details(inventory_id)')
      .eq('organization_id', orgId)
      .eq('billing_year', filterConfig.year)
      .eq('billing_month', filterConfig.month)
    
    if (currSettlements) setCurrentSettlements(currSettlements as unknown as Settlement[])

    let prevY = filterConfig.year, prevM = filterConfig.month - 1
    if (prevM === 0) { prevM = 12; prevY -= 1 }

    const { data: prevSettlements } = await supabase.from('settlements').select('id').eq('organization_id', orgId).eq('billing_year', prevY).eq('billing_month', prevM)
    const prevMap: {[key: string]: CounterData} = {}
    
    if (prevSettlements && prevSettlements.length > 0) {
      const settlementIds = prevSettlements.map(s => s.id)
      const { data: details } = await supabase.from('settlement_details').select('inventory_id, curr_count_bw, curr_count_col, curr_count_bw_a3, curr_count_col_a3').in('settlement_id', settlementIds)
      
      const safeDetails = (details || []) as unknown as SettlementDetail[];
      safeDetails.forEach((d) => { 
        if (d.inventory_id) {
          prevMap[d.inventory_id] = { 
            bw: d.curr_count_bw || 0, 
            col: d.curr_count_col || 0, 
            bw_a3: d.curr_count_bw_a3 || 0, 
            col_a3: d.curr_count_col_a3 || 0 
          } 
        }
      })
    }

    const allInventories: Inventory[] = Object.values(invMap).flat();
    allInventories.forEach(inv => {
      if (inv && !prevMap[inv.id]) {
        prevMap[inv.id] = { 
          bw: inv.initial_count_bw || 0, 
          col: inv.initial_count_col || 0, 
          bw_a3: inv.initial_count_bw_a3 || 0, 
          col_a3: inv.initial_count_col_a3 || 0 
        }
      }
    })
    setPrevData(prevMap)
    setLoading(false)
  }, [filterConfig, supabase])

  const fetchHistoryData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return; 

    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
    const orgId = profile?.organization_id

    if (!orgId) return

    const { data } = await supabase
      .from('settlements')
      .select(`*, client:client_id(name, business_number, representative_name, email, address), details:settlement_details(*, inventory:inventory_id(model_name, serial_number, status, billing_date))`)
      .eq('organization_id', orgId)
      .eq('billing_year', histFilterConfig.year)
      .eq('billing_month', histFilterConfig.month)
      .order('created_at', { ascending: false })
      
    if (data) setHistoryList(data as unknown as Settlement[])

    const startDate = new Date(histFilterConfig.year, histFilterConfig.month - 1, 1).toISOString()
    const endDate = new Date(histFilterConfig.year, histFilterConfig.month, 0, 23, 59, 59).toISOString()
    const { data: mHistory } = await supabase.from('machine_history').select('*').eq('organization_id', orgId).gte('recorded_at', startDate).lte('recorded_at', endDate)
    if (mHistory) setMonthMachineHistory(mHistory as unknown as MachineHistory[])
  }, [histFilterConfig, supabase])

  useEffect(() => { fetchRegistrationData() }, [fetchRegistrationData])
  useEffect(() => { fetchHistoryData() }, [fetchHistoryData])

  const handleSearch = () => setFilterConfig({ year: regYear, month: regMonth, day: targetDay, term: searchTerm })
  const handleHistSearch = () => setHistFilterConfig({ year: histYear, month: histMonth, day: histTargetDay, term: histSearchTerm })

  const handleInputChange = (invId: string, field: keyof CounterData, value: string) => {
    const numValue = value === '' ? 0 : Number(value)
    setInputData((prev) => ({ 
      ...prev, 
      [invId]: { ...prev[invId], [field]: numValue } 
    }))
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

  const calculateClientBillFiltered = (client: Client): BillCalculationResult => {
    const assets = inventoryMap[client.id] || []
    const originalBill = calculateClientBill(client, assets, prevData, inputData)
    
    originalBill.details = originalBill.details.filter((d) => {
        const isSettled = currentSettlements.some(s => 
            s.client_id === client.id && 
            s.details?.some((det) => det.inventory_id === d.inventory_id)
        );
        return !isSettled;
    });

    originalBill.totalAmount = originalBill.details.reduce((sum, d) => 
      sum + (d.isGroupLeader ? (d.rowCost?.total || 0) : 0), 0);
      
    return originalBill
  }

  const calculateSelectedTotal = (targetClients: Client[] = clients): number => {
    let sum = 0
    targetClients.forEach(client => {
      const billData = calculateClientBillFiltered(client)
      billData.details.forEach(d => { 
        if (selectedInventories.has(d.inventory_id) && d.isGroupLeader) sum += d.rowCost.total 
      })
    })
    return sum
  }

  const handlePreSave = () => {
    if (selectedInventories.size === 0) return alert('선택된 기계가 없습니다.')
    setIsModalOpen(true)
  }

  const handleFinalSave = async () => {
    if (!confirm('정말로 저장하시겠습니까?')) return
    
    setLoading(true)

    try {
      const dataToSend: { client: Client; details: CalculatedAsset[]; totalAmount: number }[] = []
      
      const affectedClientIds = new Set<string>()
      clients.forEach(c => {
         const assets = inventoryMap[c.id] || []
         if(assets.some(a => selectedInventories.has(a.id))) affectedClientIds.add(c.id)
      })

      for (const clientId of Array.from(affectedClientIds)) {
        const client = clients.find(c => c.id === clientId)
        if (!client) continue
        
        const billData = calculateClientBillFiltered(client)
        const selectedDetails = billData.details.filter(d => selectedInventories.has(d.inventory_id))
        
        if (selectedDetails.length === 0) continue

        const totalAmount = selectedDetails.reduce((sum, d) => d.isGroupLeader ? sum + d.rowCost.total : sum, 0)

        dataToSend.push({
          client,
          details: selectedDetails,
          totalAmount
        })
      }

      const result = await saveSettlementAction({
        year: filterConfig.year,
        month: filterConfig.month,
        clientData: dataToSend
      })

      if (result.success) {
        alert(result.message)
        setIsModalOpen(false)
        setSelectedInventories(new Set())
        setInputData({})
        await fetchHistoryData()
        await fetchRegistrationData()
      } else {
        alert(result.message)
      }

    } catch (e) {
       const msg = e instanceof Error ? e.message : String(e)
       alert('저장 중 알 수 없는 오류 발생: ' + msg)
    } finally {
      setLoading(false)
    }
  }

  const handleRebillHistory = async (id: string) => {
    if (!confirm('이 건을 재청구하시겠습니까?\n\n청구 내역만 삭제되며, 기계 이력(설치/철수)은 유지됩니다.')) return;
    setLoading(true);
    try {
      await supabase.from('settlement_details').delete().eq('settlement_id', id);
      const { error } = await supabase.from('settlements').delete().eq('id', id);
      if (error) throw error;
      alert('재청구 처리가 완료되었습니다.');
      await fetchHistoryData(); 
      await fetchRegistrationData();
    } catch (e) { 
        const msg = e instanceof Error ? e.message : String(e);
        alert('오류: ' + msg); 
    } finally { 
        setLoading(false); 
    }
  }

  const handleDeleteHistory = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    setLoading(true);
    try {
      const { data: details } = await supabase.from('settlement_details').select('inventory_id, is_replacement_record').eq('settlement_id', id);
      
      const invIds = (details?.map(d => d.inventory_id) || []).filter((id): id is string => id !== null);
      const replacementInvIds = (details?.filter(d => d.is_replacement_record).map(d => d.inventory_id) || []).filter((id): id is string => id !== null);
      
      const startDate = new Date(histYear, histMonth - 1, 1).toISOString();
      const nextMonthDate = new Date(histYear, histMonth, 1);
      const endDate = nextMonthDate.toISOString();

      if (invIds.length > 0) {
        const { data: installedHistory } = await supabase.from('machine_history').select('inventory_id').in('inventory_id', invIds).eq('action_type', 'INSTALL').gte('recorded_at', startDate).lt('recorded_at', endDate);
        
        const installedInvIds = (installedHistory?.map(h => h.inventory_id) || []).filter((id): id is string => id !== null);
        
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
    } catch (e) { 
        const msg = e instanceof Error ? e.message : String(e);
        alert('삭제 중 오류 발생: ' + msg); 
    } finally { 
        setLoading(false); 
    }
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
    } catch (e) { 
        const msg = e instanceof Error ? e.message : String(e);
        alert('재청구 처리 중 오류: ' + msg); 
    }
  }

  const handleDeleteDetail = async (settlementId: string, detailId: string, inventoryId: string, amount: number, isReplacement: boolean) => {
    if (!confirm('이 기록을 완전히 삭제하시겠습니까?')) return;
    try {
      await supabase.from('settlement_details').delete().eq('id', detailId);
      const { data: settlement } = await supabase.from('settlements').select('total_amount').eq('id', settlementId).single();
      if (settlement) {
        const newTotal = Math.max(0, (settlement.total_amount || 0) - amount);
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
    } catch (e) { 
        const msg = e instanceof Error ? e.message : String(e);
        alert('삭제 중 오류 발생: ' + msg); 
    }
  }

  const handleExcludeAsset = async (asset: CalculatedAsset) => {
    if (!confirm(`[${asset.model_name}] 기계를 이번 달 청구 목록에서 제외하시겠습니까?`)) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      // 🔴 [수정됨] 사용자 체크
      if (!user) { alert('로그인이 필요합니다.'); setLoading(false); return; }

      const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single();
      
      // 🔴 [수정됨] 조직 정보 체크 및 string 타입 확정
      if (!profile?.organization_id) {
         alert('조직 정보를 찾을 수 없습니다.');
         setLoading(false);
         return;
      }
      const orgId = profile.organization_id;

      // 🔴 [수정됨] 거래처 ID 체크 및 string 타입 확정
      if (!asset.client_id) { alert('거래처 정보가 없습니다.'); setLoading(false); return; }
      const clientId = asset.client_id;
      
      let settlementId = '';
      
      const { data: existingSettlements } = await supabase.from('settlements')
        .select('id, total_amount')
        .eq('organization_id', orgId)
        .eq('client_id', clientId) // 이제 에러 안 남
        .eq('billing_year', filterConfig.year)
        .eq('billing_month', filterConfig.month);

      if (existingSettlements && existingSettlements.length > 0) settlementId = existingSettlements[0].id;
      else {
        const { data: settlement, error: sErr } = await supabase.from('settlements').insert({ 
            organization_id: orgId, 
            client_id: clientId, // 에러 안 남
            billing_year: filterConfig.year, 
            billing_month: filterConfig.month, 
            total_amount: 0, 
            is_paid: false 
        }).select().single();

        if (sErr || !settlement) throw new Error('정산서 생성 실패: ' + sErr.message);
        settlementId = settlement.id;
      }

      await supabase.from('settlement_details').insert({
        settlement_id: settlementId, 
        inventory_id: asset.inventory_id, 
        prev_count_bw: asset.prev.bw, 
        curr_count_bw: asset.prev.bw, 
        prev_count_col: asset.prev.col, 
        curr_count_col: asset.prev.col, 
        prev_count_bw_a3: asset.prev.bw_a3, 
        curr_count_bw_a3: asset.prev.bw_a3, 
        prev_count_col_a3: asset.prev.col_a3, 
        curr_count_col_a3: asset.prev.col_a3, 
        calculated_amount: 0, 
        is_replacement_record: !!(asset.is_replacement_before || asset.is_withdrawal),
        is_paid: false
      });

      if (asset.is_replacement_before || asset.is_withdrawal) {
        await supabase.from('inventory').update({ status: '창고', client_id: null, last_status_updated_at: new Date().toISOString() }).eq('id', asset.inventory_id);
      }
      alert('목록에서 제외되었습니다.');
      await fetchHistoryData(); await fetchRegistrationData();
    } catch (e) { 
        const msg = e instanceof Error ? e.message : String(e);
        alert('처리 중 오류 발생: ' + msg); 
    } finally { 
        setLoading(false); 
    }
  }

  const togglePaymentStatus = async (id: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    const { error: hErr } = await supabase.from('settlements').update({ is_paid: newStatus }).eq('id', id);
    if (hErr) return alert('상태 변경 실패: ' + hErr.message);
    await supabase.from('settlement_details').update({ is_paid: newStatus }).eq('settlement_id', id);
    setHistoryList(prev => prev.map(item => {
      if (item.id === id) {
        const updatedDetails = item.details 
          ? item.details.map(d => ({ ...d, is_paid: newStatus })) 
          : [];
        return { ...item, is_paid: newStatus, details: updatedDetails };
      }
      return item;
    }));
  }

  const toggleDetailPaymentStatus = async (settlementId: string, detailId: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    const { error } = await supabase.from('settlement_details').update({ is_paid: newStatus }).eq('id', detailId);
    if (error) return alert('상태 변경 실패: ' + error.message);
    setHistoryList(prev => prev.map(item => {
      if (item.id === settlementId) {
        const updatedDetails = item.details 
          ? item.details.map(d => d.id === detailId ? { ...d, is_paid: newStatus } : d) 
          : [];
        return { ...item, details: updatedDetails };
      }
      return item;
    }));
  }

  return {
    loading, isModalOpen, setIsModalOpen,
    regYear, setRegYear, regMonth, setRegMonth, targetDay, setTargetDay, searchTerm, setSearchTerm,
    isRegOpen, setIsRegOpen,
    filteredClients: clients, inventoryMap, inputData, prevData, selectedInventories, showUnregistered, setShowUnregistered,
    historyList, histYear, setHistYear, histMonth, setHistMonth, histTargetDay, setHistTargetDay, histSearchTerm, setHistSearchTerm,
    isHistOpen, setIsHistOpen,
    monthMachineHistory, clients,
    handleSearch, handleHistSearch, handleInputChange, toggleInventorySelection, setSelectedInventoriesBulk,
    calculateClientBillFiltered, calculateSelectedTotal, handlePreSave, handleFinalSave,
    handleRebillHistory, handleDeleteHistory, handleDetailRebill, handleDeleteDetail, handleExcludeAsset, 
    togglePaymentStatus, toggleDetailPaymentStatus 
  }
}