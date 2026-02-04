// app/accounting/hooks/useAccounting.ts

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
  
  // --- 상태 관리 ---
  const [loading, setLoading] = useState<boolean>(false)
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false)
  
  // 등록(Registration) 필터 상태
  const [regYear, setRegYear] = useState<number>(new Date().getFullYear())
  const [regMonth, setRegMonth] = useState<number>(new Date().getMonth() + 1)
  const [targetDay, setTargetDay] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [showUnregistered, setShowUnregistered] = useState<boolean>(false)
  
  // 실제 적용된 등록 필터
  const [filterConfig, setFilterConfig] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    day: 'all',
    term: ''
  })

  // UI 상태
  const [isRegOpen, setIsRegOpen] = useState<boolean>(true)
  const [isHistOpen, setIsHistOpen] = useState<boolean>(true)

  // 데이터 상태
  const [clients, setClients] = useState<Client[]>([])
  const [inventoryMap, setInventoryMap] = useState<{[key: string]: Inventory[]}>({}) 
  const [inputData, setInputData] = useState<{[key: string]: CounterData}>({}) 
  const [prevData, setPrevData] = useState<{[key: string]: CounterData}>({})
  const [selectedInventories, setSelectedInventories] = useState<Set<string>>(new Set()) 
  const [currentSettlements, setCurrentSettlements] = useState<Settlement[]>([]) 

  // 이력(History) 데이터 및 필터 상태
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

  // --- 1. 등록 데이터 조회 ---
  const fetchRegistrationData = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return;
    
    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
    const orgId = profile?.organization_id
    if (!orgId) return

    // 1-1. 거래처 목록 조회
    const { data: clientData } = await supabase.from('clients').select('*').eq('organization_id', orgId).eq('is_deleted', false).order('name')
    if (clientData) setClients(clientData as Client[])

    // 1-2. 전체 자산 조회
    const { data: invData } = await supabase.from('inventory')
      .select('*')
      .eq('organization_id', orgId)
      .not('client_id', 'is', null)

    // 1-3. 기계 변동 이력 조회
    const startDate = new Date(filterConfig.year, filterConfig.month - 1, 1).toISOString()
    const endDate = new Date(filterConfig.year, filterConfig.month, 0, 23, 59, 59).toISOString()

    const { data: historyData } = await supabase
      .from('machine_history')
      .select('*, inventory(*)')
      .eq('organization_id', orgId)
      .gte('recorded_at', startDate)
      .lte('recorded_at', endDate)

    // 1-4. Inventory Map 구성
    const invMap: {[key: string]: Inventory[]} = {}
    
    const safeInvData = (invData || []) as unknown as Inventory[];
    const safeHistoryData = (historyData || []) as unknown as MachineHistory[];

    // 기본 설치 기계 추가
    safeInvData.forEach((inv) => {
      const cid = inv.client_id!;
      if (!invMap[cid]) invMap[cid] = []
      // 이번 달 설치된 기계인지 확인
      // @ts-ignore
      const isNewReplacement = safeHistoryData.some(h => h.inventory_id === inv.id && h.action_type === 'INSTALL');
      invMap[cid].push({ ...inv, is_active: true, is_replacement_after: isNewReplacement })
    });

    // 이번 달 철수된 기계 추가 (정산 목록에 표시하기 위함)
    // @ts-ignore
    safeHistoryData.forEach((hist) => {
      if (hist.action_type === 'WITHDRAW' && hist.client_id) {
        if (!invMap[hist.client_id]) invMap[hist.client_id] = []
        
        // 이미 목록에 있는지 확인 (중복 방지)
        if (!invMap[hist.client_id].some(item => item.id === hist.inventory_id)) {
          
          // 🔴 [수정됨] is_replacement 컬럼 확인 (없으면 메모 확인으로 대체)
          // DB에 컬럼을 추가했으므로 (hist as any).is_replacement 로 접근 가능
          const isReplacementBefore = (hist as any).is_replacement || hist.memo?.includes('교체');
          
          const withdrawnInv = hist.inventory as unknown as Inventory | undefined;
          
          if (withdrawnInv) {
            invMap[hist.client_id].push({ 
                ...withdrawnInv, 
                is_active: false, 
                is_replacement_before: !!isReplacementBefore, // 교체 전 철수
                is_withdrawal: !isReplacementBefore, // 일반 철수
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

    // 1-5. 이미 청구된 내역 조회
    const { data: currSettlements } = await supabase.from('settlements')
      .select('id, client_id, details:settlement_details(inventory_id)')
      .eq('organization_id', orgId)
      .eq('billing_year', filterConfig.year)
      .eq('billing_month', filterConfig.month)
    
    if (currSettlements) setCurrentSettlements(currSettlements as unknown as Settlement[])

    // 1-6. 전월 카운터 데이터 조회
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

    // 전월 데이터가 없으면 초기 카운터 사용
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

  // --- 2. 청구 이력 조회 ---
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

  // --- 3. 이벤트 핸들러 ---
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

  // --- 4. 계산 및 필터링 ---
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

  // --- 5. 액션 ---
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
        dataToSend.push({ client, details: selectedDetails, totalAmount })
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
       alert('저장 중 오류: ' + msg)
    } finally {
      setLoading(false)
    }
  }

  // --- 6. 이력 관리 ---
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
    } catch (e) { alert('오류: ' + e); } finally { setLoading(false); }
  }

  const handleDeleteHistory = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까? 관련 기계 상태가 창고로 변경될 수 있습니다.')) return;
    setLoading(true);
    try {
        const { error } = await supabase.from('settlements').delete().eq('id', id);
        if (error) throw error;
        alert('삭제되었습니다.');
        await fetchHistoryData(); await fetchRegistrationData();
    } catch (e) { alert('삭제 중 오류: ' + e); } finally { setLoading(false); }
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
      
      alert('처리되었습니다.');
      await fetchHistoryData(); await fetchRegistrationData();
    } catch (e) { alert('오류: ' + e); }
  }

  const handleDeleteDetail = async (settlementId: string, detailId: string, inventoryId: string, amount: number, isReplacement: boolean) => {
    if (!confirm('이 기록을 완전히 삭제하시겠습니까?')) return;
    try {
      await supabase.from('settlement_details').delete().eq('id', detailId);
      const { data: settlement } = await supabase.from('settlements').select('total_amount').eq('id', settlementId).single();
      if (settlement) {
        await supabase.from('settlements').update({ total_amount: Math.max(0, (settlement.total_amount || 0) - amount) }).eq('id', settlementId);
      }
      alert('삭제되었습니다.');
      await fetchHistoryData(); await fetchRegistrationData();
    } catch (e) { alert('오류: ' + e); }
  }

  const handleExcludeAsset = async (asset: CalculatedAsset) => {
    if (!confirm(`[${asset.model_name}] 기계를 이번 달 청구 목록에서 제외하시겠습니까?`)) return;
    setLoading(true);
    try {
      alert('제외되었습니다.');
      await fetchRegistrationData();
    } catch(e) { alert('오류: ' + e); } finally { setLoading(false); }
  }

  const togglePaymentStatus = async (id: string, currentStatus: boolean) => {
    await supabase.from('settlements').update({ is_paid: !currentStatus }).eq('id', id);
    await supabase.from('settlement_details').update({ is_paid: !currentStatus }).eq('settlement_id', id);
    fetchHistoryData();
  }

  const toggleDetailPaymentStatus = async (settlementId: string, detailId: string, currentStatus: boolean) => {
    await supabase.from('settlement_details').update({ is_paid: !currentStatus }).eq('id', detailId);
    fetchHistoryData();
  }

  return {
    loading, isModalOpen, setIsModalOpen,
    regYear, setRegYear, regMonth, setRegMonth, targetDay, setTargetDay, searchTerm, setSearchTerm,
    isRegOpen, setIsRegOpen,
    filteredClients: clients,
    inventoryMap, inputData, prevData, selectedInventories, showUnregistered, setShowUnregistered,
    historyList, histYear, setHistYear, histMonth, setHistMonth, histTargetDay, setHistTargetDay, histSearchTerm, setHistSearchTerm,
    isHistOpen, setIsHistOpen, monthMachineHistory, clients,
    handleSearch, handleHistSearch, handleInputChange, toggleInventorySelection, setSelectedInventoriesBulk,
    calculateClientBillFiltered, calculateSelectedTotal, handlePreSave, handleFinalSave,
    handleRebillHistory, handleDeleteHistory, handleDetailRebill, handleDeleteDetail, handleExcludeAsset, 
    togglePaymentStatus, toggleDetailPaymentStatus 
  }
}