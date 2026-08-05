// app/accounting/hooks/useAccounting.ts

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@/utils/supabase' 
import { calculateClientBill } from '@/utils/billingCalculator'
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
  SettlementDetail,
  Organization
} from '@/app/types'

import { 
  saveSettlementAction,
  deleteSettlementAction,
  rebillSettlementHistoryAction,
  rebillSettlementDetailAction,
  deleteSettlementDetailAction,
  toggleSettlementPaymentAction,
  toggleDetailPaymentAction,
  deleteSettlementsAction
} from '@/app/actions/accounting'
import { getMonthDateRange, calcGrandTotal } from '@/utils/billingAmounts'
import { loadAppSettings } from '@/utils/appSettings'

export function useAccounting() {
  // --- 상태 관리 ---
  const [loading, setLoading] = useState<boolean>(false)
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false)
  
  // 명세서 관련 상태
  const [isStatementOpen, setIsStatementOpen] = useState<boolean>(false)
  const [selectedSettlementForStatement, setSelectedSettlementForStatement] = useState<Settlement | null>(null)
  const [myOrg, setMyOrg] = useState<Organization | null>(null)

  const [regYear, setRegYear] = useState<number>(new Date().getFullYear())
  const [regMonth, setRegMonth] = useState<number>(new Date().getMonth() + 1)
  const [targetDay, setTargetDay] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [showUnregistered, setShowUnregistered] = useState<boolean>(false)
  
  const [filterConfig, setFilterConfig] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    day: 'all',
    term: ''
  })

  const [isRegOpen, setIsRegOpen] = useState<boolean>(true)
  const [isHistOpen, setIsHistOpen] = useState<boolean>(true)

  const [clients, setClients] = useState<Client[]>([])
  const [inventoryMap, setInventoryMap] = useState<{[key: string]: Inventory[]}>({}) 
  const [inputData, setInputData] = useState<{[key: string]: CounterData}>({}) 
  const [prevData, setPrevData] = useState<{[key: string]: CounterData}>({})
  const [selectedInventories, setSelectedInventories] = useState<Set<string>>(new Set()) 
  const [currentSettlements, setCurrentSettlements] = useState<Settlement[]>([]) 
  /** 전월 지침 출처: settlement | initial (초기값 폴백) */
  const [prevSourceMap, setPrevSourceMap] = useState<Record<string, 'settlement' | 'initial'>>({})
  /** 사용자가 당월 지침을 한번이라도 입력한 기기 */
  const [touchedInputs, setTouchedInputs] = useState<Set<string>>(new Set()) 

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

  useEffect(() => {
    const s = loadAppSettings()
    setShowUnregistered(s.accounting.defaultShowUnregistered)
  }, [])

  // --- 1. 등록 데이터 조회 ---
  const fetchRegistrationData = useCallback(async () => {
    setLoading(true)
    try {
    const supabase = createClient() as SupabaseClient<Database>
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    
    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
    const orgId = profile?.organization_id
    if (!orgId) return

    // 내 회사 정보 조회 (명세서 공급자용)
    const { data: orgData } = await supabase.from('organizations').select('*').eq('id', orgId).single()
    if (orgData) setMyOrg(orgData as Organization)

    const { data: clientData } = await supabase.from('clients').select('*').eq('organization_id', orgId).eq('is_deleted', false).order('name')
    if (clientData) setClients(clientData as Client[])

    const { data: invData } = await supabase.from('inventory')
      .select('*')
      .eq('organization_id', orgId)
      .not('client_id', 'is', null)

    const startDate = getMonthDateRange(filterConfig.year, filterConfig.month).start
    const endDate = getMonthDateRange(filterConfig.year, filterConfig.month).end

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
      // 순수 신규 설치가 아닌 '교체 후 설치'만 표시
      const isNewReplacement = safeHistoryData.some(h =>
        h.inventory_id === inv.id &&
        h.action_type === 'INSTALL' &&
        (!!(h as any).is_replacement || !!h.memo?.includes('교체'))
      );
      invMap[cid].push({ ...inv, is_active: true, is_replacement_after: isNewReplacement })
    });

    // @ts-ignore
    safeHistoryData.forEach((hist) => {
      if (hist.action_type === 'WITHDRAW' && hist.client_id) {
        if (!invMap[hist.client_id]) invMap[hist.client_id] = []
        if (!invMap[hist.client_id].some(item => item.id === hist.inventory_id)) {
          const isReplacementBefore = (hist as any).is_replacement || hist.memo?.includes('교체');
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
      .select('id, client_id, total_amount, details:settlement_details(inventory_id)')
      .eq('organization_id', orgId)
      .eq('billing_year', filterConfig.year)
      .eq('billing_month', filterConfig.month)
    
    if (currSettlements) setCurrentSettlements(currSettlements as unknown as Settlement[])

    let prevY = filterConfig.year, prevM = filterConfig.month - 1
    if (prevM === 0) { prevM = 12; prevY -= 1 }

    const { data: prevSettlements } = await supabase.from('settlements').select('id').eq('organization_id', orgId).eq('billing_year', prevY).eq('billing_month', prevM)
    const prevMap: {[key: string]: CounterData} = {}
    const sourceMap: Record<string, 'settlement' | 'initial'> = {}
    
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
          sourceMap[d.inventory_id] = 'settlement'
        }
      })
    }

    const initialInputData: {[key: string]: CounterData} = {}
    
    const allInventories: Inventory[] = Object.values(invMap).flat();
    allInventories.forEach(inv => {
      if (inv && !prevMap[inv.id]) {
        prevMap[inv.id] = { 
          bw: inv.initial_count_bw || 0, 
          col: inv.initial_count_col || 0, 
          bw_a3: inv.initial_count_bw_a3 || 0, 
          col_a3: inv.initial_count_col_a3 || 0 
        }
        sourceMap[inv.id] = 'initial'
      }

      if (inv.is_replacement_before || inv.is_withdrawal) {
        if (inv.final_counts) {
          initialInputData[inv.id] = {
            bw: inv.final_counts.bw,
            col: inv.final_counts.col,
            bw_a3: inv.final_counts.bw_a3,
            col_a3: inv.final_counts.col_a3
          }
        }
      }
    })
    
    setPrevData(prevMap)
    setPrevSourceMap(sourceMap)
    setInputData(initialInputData)
    setTouchedInputs(new Set(Object.keys(initialInputData)))
    } finally {
      setLoading(false)
    }
  }, [filterConfig])

  // --- 2. 청구 이력 조회 ---
  const fetchHistoryData = useCallback(async () => {
    const supabase = createClient() as SupabaseClient<Database>
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return; 

    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
    const orgId = profile?.organization_id
    if (!orgId) return

    const { data, error } = await supabase
      .from('settlements')
      .select(`
        *,
        client:clients (
          id, name, business_number, representative_name, email, address
        ),
        details:settlement_details (
          *,
          inventory:inventory (
            model_name, serial_number, status, billing_date, billing_group_id,
            plan_basic_cnt_bw, plan_basic_cnt_col
          )
        )
      `)
      .eq('organization_id', orgId)
      .eq('billing_year', histFilterConfig.year)
      .eq('billing_month', histFilterConfig.month)
      .order('created_at', { ascending: false });

    if (error) console.error('History Fetch Error:', error);

    if (data) {
      let filteredList = data as unknown as Settlement[];

      if (histFilterConfig.day !== 'all') {
        filteredList = filteredList.filter(settlement => {
          return settlement.details?.some(detail => 
            detail.inventory?.billing_date === histFilterConfig.day
          );
        });
      }

      if (histFilterConfig.term) {
        const term = histFilterConfig.term.toLowerCase();
        filteredList = filteredList.filter(settlement => {
          const clientMatch = settlement.client?.name?.toLowerCase().includes(term);
          const inventoryMatch = settlement.details?.some(detail => 
            detail.inventory?.model_name?.toLowerCase().includes(term) ||
            detail.inventory?.serial_number?.toLowerCase().includes(term)
          );
          return clientMatch || inventoryMatch;
        });
      }

      setHistoryList(filteredList);
    }

    const range = getMonthDateRange(histFilterConfig.year, histFilterConfig.month)
    const { data: mHistory } = await supabase.from('machine_history').select('*').eq('organization_id', orgId).gte('recorded_at', range.start).lte('recorded_at', range.end)
    if (mHistory) setMonthMachineHistory(mHistory as unknown as MachineHistory[])
  }, [histFilterConfig])

  useEffect(() => { fetchRegistrationData() }, [fetchRegistrationData])
  useEffect(() => { fetchHistoryData() }, [fetchHistoryData])

  // 연·월 변경 시 조회 조건과 즉시 동기화 (검증/저장 달 불일치 방지)
  useEffect(() => {
    setFilterConfig(prev => {
      if (prev.year === regYear && prev.month === regMonth) return prev
      return { ...prev, year: regYear, month: regMonth }
    })
  }, [regYear, regMonth])

  // --- 이벤트 핸들러 ---
  const handleSearch = () => setFilterConfig({ year: regYear, month: regMonth, day: targetDay, term: searchTerm })
  const handleHistSearch = () => setHistFilterConfig({ year: histYear, month: histMonth, day: histTargetDay, term: histSearchTerm })

  const handleInputChange = (invId: string, field: keyof CounterData, value: string) => {
    const numValue = value === '' ? 0 : Number(value)
    setInputData((prev) => ({
      ...prev,
      [invId]: {
        ...(prev[invId] ?? { bw: 0, col: 0, bw_a3: 0, col_a3: 0 }),
        [field]: numValue
      }
    }))
    setTouchedInputs(prev => new Set(prev).add(invId))
  }

  const getSettledInventoryIds = useCallback(() => {
    const ids = new Set<string>()
    currentSettlements.forEach(s => {
      s.details?.forEach((d: any) => {
        if (d.inventory_id) ids.add(d.inventory_id)
      })
    })
    return ids
  }, [currentSettlements])

  /** 합산 그룹이면 같은 그룹 미정산 기기를 함께 선택/해제 */
  const toggleInventorySelection = (invId: string) => {
    const settledIds = getSettledInventoryIds()
    const allAssets = Object.values(inventoryMap).flat()
    const target = allAssets.find(a => a.id === invId)
    if (!target) return

    const groupMembers = target.billing_group_id
      ? allAssets.filter(a =>
          a.billing_group_id === target.billing_group_id &&
          !settledIds.has(a.id) &&
          (filterConfig.day === 'all' || a.billing_date === filterConfig.day)
        )
      : [target]

    const memberIds = groupMembers.map(a => a.id)
    const shouldSelect = !selectedInventories.has(invId)
    const newSet = new Set(selectedInventories)
    memberIds.forEach(id => {
      if (shouldSelect) newSet.add(id)
      else newSet.delete(id)
    })
    setSelectedInventories(newSet)
  }

  const setSelectedInventoriesBulk = (ids: string[], action: 'add' | 'remove') => {
    const settledIds = getSettledInventoryIds()
    const allAssets = Object.values(inventoryMap).flat()
    const expanded = new Set<string>()

    ids.forEach(id => {
      const target = allAssets.find(a => a.id === id)
      if (!target) {
        expanded.add(id)
        return
      }
      if (target.billing_group_id) {
        allAssets
          .filter(a => a.billing_group_id === target.billing_group_id && !settledIds.has(a.id))
          .forEach(a => expanded.add(a.id))
      } else {
        expanded.add(id)
      }
    })

    const newSet = new Set(selectedInventories);
    expanded.forEach(id => {
      if (action === 'add') newSet.add(id);
      else newSet.delete(id);
    });
    setSelectedInventories(newSet);
  }

  // --- 계산 및 필터링: 미정산 기기만으로 요금 재계산 (교차 거래처 합산 그룹 포함) ---
  const calculateClientBillFiltered = (client: Client): BillCalculationResult => {
    const settledIds = getSettledInventoryIds()
    let ownAssets = (inventoryMap[client.id] || []).filter(a => !settledIds.has(a.id))
    if (filterConfig.day !== 'all') {
      ownAssets = ownAssets.filter(a => a.billing_date === filterConfig.day)
    }

    const groupIds = new Set(
      ownAssets.map(a => a.billing_group_id).filter((id): id is string => Boolean(id))
    )
    const allAssets = Object.values(inventoryMap).flat().filter(a => !settledIds.has(a.id))
    const peers = allAssets.filter(
      a => a.billing_group_id && groupIds.has(a.billing_group_id)
    )

    const byId = new Map<string, Inventory>()
    ;[...ownAssets, ...peers].forEach(a => byId.set(a.id, a))
    const calcAssets = Array.from(byId.values())

    const bill = calculateClientBill(client, calcAssets, prevData, inputData)
    const ownIds = new Set(ownAssets.map(a => a.id))
    const ownDetails = bill.details.filter(d => ownIds.has(d.inventory_id))

    // 화면에는 이 거래처 기기만 보이되, 합산 breakdown은 전체 그룹 계산 결과 유지
    for (const gid of groupIds) {
      const fullLeader = bill.details.find(
        d => d.billing_group_id === gid && d.isGroupLeader
      )
      const ownInGroup = ownDetails.filter(d => d.billing_group_id === gid)
      ownInGroup.forEach((d, i) => {
        d.isGroupLeader = i === 0
        d.groupSpan = i === 0 ? ownInGroup.length : 0
        if (i === 0 && fullLeader?.groupUsageBreakdown) {
          d.groupUsageBreakdown = fullLeader.groupUsageBreakdown
        }
      })
    }

    return {
      details: ownDetails,
      totalAmount: ownDetails.reduce((sum, d) => sum + (d.rowCost?.total || 0), 0)
    }
  }

  const filteredClients = useMemo(() => {
    const settledIds = new Set<string>()
    currentSettlements.forEach(s => {
      s.details?.forEach((d: any) => {
        if (d.inventory_id) settledIds.add(d.inventory_id)
      })
    })

    return clients.filter(c => {
      const assets = inventoryMap[c.id] || []
      const unsettled = assets.filter(a => !settledIds.has(a.id))
      if (unsettled.length === 0) return false

      // 미등록만: 해당 월에 정산된 기기가 하나도 없는 거래처
      if (showUnregistered) {
        const hasAnySettled = assets.some(a => settledIds.has(a.id))
        if (hasAnySettled) return false
      }

      const hasMatchingAsset = unsettled.some(asset => {
        const matchesDay = filterConfig.day === 'all' || asset.billing_date === filterConfig.day
        const matchesTerm = filterConfig.term === '' ||
                           c.name.includes(filterConfig.term) ||
                           asset.model_name.includes(filterConfig.term) ||
                           asset.serial_number.includes(filterConfig.term)
        return matchesDay && matchesTerm
      })

      return hasMatchingAsset
    })
  }, [clients, inventoryMap, filterConfig, currentSettlements, showUnregistered])

  const calculateSelectedTotal = (targetClients: Client[] = clients): number => {
    let sum = 0
    targetClients.forEach(client => {
      const billData = calculateClientBillFiltered(client)
      billData.details.forEach(d => { 
        if (selectedInventories.has(d.inventory_id)) sum += d.rowCost.total 
      })
    })
    return sum
  }

  // --- 저장 및 액션 ---
  const handlePreSave = () => {
    if (selectedInventories.size === 0) return alert('선택된 기계가 없습니다.')

    const missingInput: string[] = []
    const zeroCurr: string[] = []

    selectedInventories.forEach(id => {
      const allAssets = Object.values(inventoryMap).flat()
      const asset = allAssets.find(a => a.id === id)
      const label = asset ? `${asset.model_name}` : id
      const curr = inputData[id]
      const prev = prevData[id] || { bw: 0, col: 0, bw_a3: 0, col_a3: 0 }
      const isAutoFilled = asset?.is_replacement_before || asset?.is_withdrawal

      if (!touchedInputs.has(id) && !isAutoFilled) {
        missingInput.push(label)
        return
      }
      const sumCurr = (curr?.bw || 0) + (curr?.col || 0) + (curr?.bw_a3 || 0) + (curr?.col_a3 || 0)
      const sumPrev = prev.bw + prev.col + prev.bw_a3 + prev.col_a3
      if (sumCurr === 0 && sumPrev > 0 && !isAutoFilled) {
        zeroCurr.push(label)
      }
    })

    if (missingInput.length > 0) {
      return alert(`당월 지침이 입력되지 않은 기기가 있습니다.\n\n${missingInput.slice(0, 8).join('\n')}${missingInput.length > 8 ? '\n…' : ''}`)
    }
    if (zeroCurr.length > 0) {
      if (!confirm(`당월 지침이 0인 기기가 있습니다. 계속할까요?\n\n${zeroCurr.slice(0, 8).join('\n')}`)) return
    }

    const initialPrevCount = Array.from(selectedInventories).filter(id => prevSourceMap[id] === 'initial').length
    if (initialPrevCount > 0 && loadAppSettings().accounting.confirmWhenUsingInitialCounter) {
      if (!confirm(`선택한 기기 중 ${initialPrevCount}대는 전월 정산이 없어 설치 초기 카운터를 전월로 사용합니다.\n계속 저장할까요?`)) return
    }

    setIsModalOpen(true)
  }

  const handleFinalSave = async () => {
    if (regYear !== filterConfig.year || regMonth !== filterConfig.month) {
      alert('연/월이 변경되었습니다. 먼저 [조회]를 눌러 목록을 갱신한 뒤 저장해주세요.')
      return
    }
    if (!confirm('정말로 저장하시겠습니까?')) return
    setLoading(true)

    try {
      const dataToSend: { client: Client; details: CalculatedAsset[]; totalAmount: number }[] = []
      
      filteredClients.forEach(client => {
        const billData = calculateClientBillFiltered(client)
        const selectedDetails = billData.details.filter(d => selectedInventories.has(d.inventory_id))
        
        if (selectedDetails.length > 0) {
          const totalAmount = selectedDetails.reduce((sum, d) => sum + d.rowCost.total, 0)
          dataToSend.push({ client, details: selectedDetails, totalAmount })
        }
      })

      if (dataToSend.length === 0) {
        alert('저장할 데이터가 없습니다.');
        setLoading(false);
        return;
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
        setTouchedInputs(new Set())
        await Promise.all([fetchHistoryData(), fetchRegistrationData()])
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

  const handleRebillHistory = async (id: string) => {
    if (!confirm('이 건을 재청구하시겠습니까?')) return;
    setLoading(true);
    try {
      const result = await rebillSettlementHistoryAction(id);
      if (result.success) {
        alert('재청구 처리가 완료되었습니다.');
        await Promise.all([ fetchHistoryData(), fetchRegistrationData() ])
      } else {
        throw new Error(result.message);
      }
    } catch (e: any) { alert('오류: ' + e.message); } finally { setLoading(false); }
  }

  const handleDeleteHistory = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    setLoading(true);
    try {
        const result = await deleteSettlementAction(id);
        if (result.success) {
          alert('삭제되었습니다.');
          await Promise.all([ fetchHistoryData(), fetchRegistrationData() ])
        } else {
          throw new Error(result.message);
        }
    } catch (e: any) { alert('삭제 중 오류: ' + e.message); } finally { setLoading(false); }
  }

  const handleBatchRebillHistory = async (ids: string[]) => {
    if (ids.length === 0) return alert('선택된 내역이 없습니다.');
    if (!confirm(`선택한 ${ids.length}건을 재청구(삭제)하시겠습니까?\n내역은 삭제되며 다시 등록할 수 있게 됩니다.`)) return;
    setLoading(true);
    const result = await deleteSettlementsAction(ids);
    if (result.success) {
      alert('일괄 재청구 처리가 완료되었습니다.');
      await Promise.all([ fetchHistoryData(), fetchRegistrationData() ]);
    } else {
      alert(result.message);
    }
    setLoading(false);
  }

  const handleBatchDeleteHistory = async (ids: string[]) => {
    if (ids.length === 0) return alert('선택된 내역이 없습니다.');
    if (!confirm(`선택한 ${ids.length}건을 정말 삭제하시겠습니까?`)) return;
    setLoading(true);
    const result = await deleteSettlementsAction(ids);
    if (result.success) {
      alert('일괄 삭제되었습니다.');
      await Promise.all([ fetchHistoryData(), fetchRegistrationData() ]);
    } else {
      alert(result.message);
    }
    setLoading(false);
  }

  const handleDetailRebill = async (settlementId: string, detailId: string, inventoryId: string, isReplacement: boolean, clientId: string) => {
    if (!confirm('이 기계만 재청구하시겠습니까?')) return;
    try {
      const result = await rebillSettlementDetailAction(settlementId, detailId, inventoryId, isReplacement, clientId);
      if (result.success) {
        alert('처리되었습니다.');
        await Promise.all([ fetchHistoryData(), fetchRegistrationData() ])
      } else {
        alert('실패: ' + result.message);
      }
    } catch (e: any) { alert('오류: ' + e.message); }
  }

  const handleDeleteDetail = async (settlementId: string, detailId: string, inventoryId: string, amount: number, isReplacement: boolean) => {
    if (!confirm('이 기록을 완전히 삭제하시겠습니까?')) return;
    try {
      const result = await deleteSettlementDetailAction(settlementId, detailId, amount);
      if (result.success) {
        alert('삭제되었습니다.');
        await Promise.all([ fetchHistoryData(), fetchRegistrationData() ])
      } else {
        alert('실패: ' + result.message);
      }
    } catch (e: any) { alert('오류: ' + e.message); }
  }

  // ❌ [삭제] handleExcludeAsset 함수 제거

  const togglePaymentStatus = async (id: string, currentStatus: boolean) => {
    const result = await toggleSettlementPaymentAction(id, currentStatus);
    if (!result.success) alert('변경 실패: ' + result.message);
    fetchHistoryData();
  }

  const toggleDetailPaymentStatus = async (settlementId: string, detailId: string, currentStatus: boolean) => {
    const result = await toggleDetailPaymentAction(detailId, currentStatus);
    if (!result.success) alert('변경 실패: ' + result.message);
    fetchHistoryData();
  }

  const handleOpenStatement = (originalSettlement: Settlement, targetDetails: SettlementDetail[]) => {
    if (!targetDetails || targetDetails.length === 0) {
      alert("명세서를 출력할 기계를 선택해주세요.");
      return;
    }

    const supplyTotal = targetDetails.reduce((sum, detail) => {
      return sum + (detail.calculated_amount || 0);
    }, 0);

    const tempSettlement: Settlement = {
      ...originalSettlement,
      details: targetDetails,
      total_amount: calcGrandTotal(supplyTotal)
    };

    setSelectedSettlementForStatement(tempSettlement)
    setIsStatementOpen(true)
  }

  const handleCloseStatement = () => {
    setIsStatementOpen(false)
    setSelectedSettlementForStatement(null)
  }

  return {
    loading, isModalOpen, setIsModalOpen,
    regYear, setRegYear, regMonth, setRegMonth, targetDay, setTargetDay, searchTerm, setSearchTerm,
    isRegOpen, setIsRegOpen,
    filteredClients, 
    inventoryMap, inputData, prevData, prevSourceMap, selectedInventories, showUnregistered, setShowUnregistered,
    historyList, histYear, setHistYear, histMonth, setHistMonth, histTargetDay, setHistTargetDay, histSearchTerm, setHistSearchTerm,
    isHistOpen, setIsHistOpen, monthMachineHistory, clients,
    handleSearch, handleHistSearch, handleInputChange, toggleInventorySelection, setSelectedInventoriesBulk,
    calculateClientBillFiltered, calculateSelectedTotal, handlePreSave, handleFinalSave,
    handleRebillHistory, handleDeleteHistory, handleDetailRebill, handleDeleteDetail,
    togglePaymentStatus, toggleDetailPaymentStatus,
    handleBatchDeleteHistory, handleBatchRebillHistory,
    
    isStatementOpen, selectedSettlementForStatement, myOrg,
    handleOpenStatement, handleCloseStatement
  }
}