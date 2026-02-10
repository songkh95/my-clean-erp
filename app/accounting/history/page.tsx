'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/utils/supabase'
import { 
  updateBulkSettlementHistoryAction, 
  deleteSettlementDetailAction, 
  rebillSettlementDetailAction 
} from '@/app/actions/accounting'
import { Client, Settlement, Organization, HistoryItem } from '@/app/types' 
import StatementModal from '@/components/accounting/StatementModal'
import HistoryFilter from '@/components/accounting/HistoryFilter'
import HistoryTable from '@/components/accounting/HistoryTable' 

export default function AccountingHistoryPage() {
    const supabase = createClient()

    // 상태 관리
    const [clients, setClients] = useState<Client[]>([])
    const [searchTerm, setSearchTerm] = useState('')
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [selectedClient, setSelectedClient] = useState<Client | null>(null)
    const [myOrg, setMyOrg] = useState<Organization | null>(null)

    // 필터
    const currentYear = new Date().getFullYear()
    const [startMonth, setStartMonth] = useState(`${currentYear}-01`)
    const [endMonth, setEndMonth] = useState(`${currentYear}-12`)
    const [viewMode, setViewMode] = useState<'all' | 'machine'>('all')

    // 데이터
    const [loading, setLoading] = useState(false)
    const [items, setItems] = useState<HistoryItem[]>([])
    const [originalItems, setOriginalItems] = useState<HistoryItem[]>([]) // 백업용
    const [hasChanges, setHasChanges] = useState(false)
    const [isEditMode, setIsEditMode] = useState(false)

    // 모달
    const [isStatementOpen, setIsStatementOpen] = useState(false)
    const [statementData, setStatementData] = useState<Settlement | null>(null)

    // 1. 초기 데이터 로드
    useEffect(() => {
        const fetchInitialData = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
            if (profile?.organization_id) {
                const { data: org } = await supabase.from('organizations').select('*').eq('id', profile.organization_id).single()
                if (org) setMyOrg(org as Organization)
            }

            const { data } = await supabase.from('clients').select('*').order('name')
            if (data) setClients(data)
        }
        fetchInitialData()
    }, [])

    const filteredClients = useMemo(() => {
        if (!searchTerm) return []
        return clients.filter(c =>
            c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.representative_name?.toLowerCase().includes(searchTerm.toLowerCase())
        )
    }, [searchTerm, clients])

    // 2. 이력 데이터 조회
    const fetchHistory = async (targetClient: Client | null = selectedClient) => {
        if (!targetClient) {
            alert('거래처를 선택하거나 입력해주세요.')
            return
        }
        
        setLoading(true)
        setIsEditMode(false) 
        setHasChanges(false)

        const [sYear, sMonth] = startMonth.split('-').map(Number)
        const [eYear, eMonth] = endMonth.split('-').map(Number)

        const { data } = await supabase
            .from('settlement_details')
            .select(`
                *,
                settlement:settlements!inner(id, billing_year, billing_month, is_paid, total_amount),
                inventory:inventory(
                    id, model_name, serial_number, 
                    plan_basic_fee, plan_price_bw, plan_price_col, 
                    plan_basic_cnt_bw, plan_basic_cnt_col,
                    plan_weight_a3_bw, plan_weight_a3_col
                )
            `)
            .eq('settlement.client_id', targetClient.id)
            .gte('settlement.billing_year', sYear)
            .lte('settlement.billing_year', eYear)

        if (data) {
            const filtered = data.filter((d: any) => {
                const dateVal = d.settlement.billing_year * 100 + d.settlement.billing_month
                const startVal = sYear * 100 + sMonth
                const endVal = eYear * 100 + eMonth
                return dateVal >= startVal && dateVal <= endVal
            }).map((d: any) => ({
                ...d,
                usage_bw: d.usage_bw || 0,
                usage_col: d.usage_col || 0,
                usage_bw_a3: d.usage_bw_a3 || 0,
                usage_col_a3: d.usage_col_a3 || 0,
                calculated_amount: d.calculated_amount || 0,
                is_modified: false
            })) as HistoryItem[]

            setItems(filtered)
            setOriginalItems(JSON.parse(JSON.stringify(filtered))) // 원본 백업
        } else {
            setItems([])
            setOriginalItems([])
        }
        setLoading(false)
    }

    // 3. 검색 핸들러
    const handleSearchTrigger = () => {
        if (selectedClient && selectedClient.name === searchTerm) {
            fetchHistory(selectedClient)
            return
        }

        if (searchTerm) {
            const exactMatch = clients.find(c => c.name === searchTerm)
            if (exactMatch) {
                setSelectedClient(exactMatch)
                fetchHistory(exactMatch)
                setShowSuggestions(false)
            } else {
                const partialMatch = clients.find(c => c.name.includes(searchTerm))
                if (partialMatch) {
                    setSelectedClient(partialMatch)
                    setSearchTerm(partialMatch.name)
                    fetchHistory(partialMatch)
                    setShowSuggestions(false)
                } else {
                    alert('일치하는 거래처가 없습니다.')
                }
            }
        } else {
            alert('거래처명을 입력해주세요.')
        }
    }

    // 4. 데이터 정합성 검사 (Error Map 생성)
    const errorMap = useMemo(() => {
        const errors = new Map<string, { bw: boolean, col: boolean, bw_a3: boolean, col_a3: boolean }>();
        const itemLookup = new Map<string, HistoryItem>();
        
        items.forEach(item => {
            const key = `${item.inventory_id}-${item.settlement.billing_year}-${item.settlement.billing_month}`;
            itemLookup.set(key, item);
        });

        items.forEach(item => {
            let prevYear = item.settlement.billing_year;
            let prevMonth = item.settlement.billing_month - 1;
            if (prevMonth === 0) { prevMonth = 12; prevYear -= 1; }
            
            const prevKey = `${item.inventory_id}-${prevYear}-${prevMonth}`;
            const prevItem = itemLookup.get(prevKey);

            if (prevItem) {
                const isBwErr = prevItem.curr_count_bw !== item.prev_count_bw;
                const isColErr = prevItem.curr_count_col !== item.prev_count_col;
                const isBwA3Err = prevItem.curr_count_bw_a3 !== item.prev_count_bw_a3;
                const isColA3Err = prevItem.curr_count_col_a3 !== item.prev_count_col_a3;

                if (isBwErr || isColErr || isBwA3Err || isColA3Err) {
                    errors.set(item.id, { 
                        bw: isBwErr, col: isColErr, bw_a3: isBwA3Err, col_a3: isColA3Err 
                    });
                }
            }
        });
        return errors;
    }, [items]);

    // 5. 입력값 변경
    const handleInputChange = (id: string, field: keyof HistoryItem, val: string) => {
        const numVal = Number(val.replace(/[^0-9]/g, ''))

        setItems(prev => prev.map(item => {
            if (item.id === id) {
                const newItem = { ...item, [field]: numVal, is_modified: true }

                if ((field as string).includes('count')) {
                    newItem.usage_bw = newItem.curr_count_bw - newItem.prev_count_bw
                    newItem.usage_col = newItem.curr_count_col - newItem.prev_count_col
                    newItem.usage_bw_a3 = newItem.curr_count_bw_a3 - newItem.prev_count_bw_a3
                    newItem.usage_col_a3 = newItem.curr_count_col_a3 - newItem.prev_count_col_a3
                }

                if (newItem.inventory) {
                    const inv = newItem.inventory
                    const safeUsageBw = Math.max(0, newItem.usage_bw)
                    const safeUsageCol = Math.max(0, newItem.usage_col)
                    const safeUsageBwA3 = Math.max(0, newItem.usage_bw_a3)
                    const safeUsageColA3 = Math.max(0, newItem.usage_col_a3)

                    const totalBw = safeUsageBw + (safeUsageBwA3 * (inv.plan_weight_a3_bw || 1))
                    const totalCol = safeUsageCol + (safeUsageColA3 * (inv.plan_weight_a3_col || 1))

                    const extraBw = Math.max(0, totalBw - (inv.plan_basic_cnt_bw || 0))
                    const extraCol = Math.max(0, totalCol - (inv.plan_basic_cnt_col || 0))

                    newItem.calculated_amount = (inv.plan_basic_fee || 0) +
                        (extraBw * (inv.plan_price_bw || 0)) +
                        (extraCol * (inv.plan_price_col || 0))
                }
                return newItem
            }
            return item
        }))
        setHasChanges(true)
    }

    // 수정 모드 토글 (취소/시작)
    const handleToggleEditMode = () => {
        if (isEditMode) {
            // 수정 취소
            if (hasChanges) {
                if (confirm('수정을 취소하시겠습니까? 입력한 내용은 저장되지 않고 이전 상태로 돌아갑니다.')) {
                    setItems(JSON.parse(JSON.stringify(originalItems)))
                    setHasChanges(false)
                    setIsEditMode(false)
                }
            } else {
                setIsEditMode(false)
            }
        } else {
            // 수정 시작
            setIsEditMode(true)
        }
    }

    // 6. 저장 핸들러
    const handleSave = async () => {
        if (errorMap.size > 0) {
            alert('⚠️ 데이터 불일치 오류가 발견되었습니다.\n빨간색으로 표시된 칸은 [지난달 당월 지침]과 [이번달 전월 지침]이 다릅니다.\n데이터 무결성을 위해 "지난달 데이터"를 수정하여 숫자를 맞춰주세요.');
            return;
        }

        if (!confirm('수정된 내역을 저장하시겠습니까?')) return

        const hasNegativeUsage = items.some(i => i.is_modified && (i.usage_bw < 0 || i.usage_col < 0 || i.usage_bw_a3 < 0 || i.usage_col_a3 < 0));
        if (hasNegativeUsage) {
            if (!confirm('⚠️ 일부 사용량이 마이너스(-)입니다. 이대로 저장하시겠습니까?')) return;
        }

        const updates = items.filter(i => i.is_modified)
        const res = await updateBulkSettlementHistoryAction(updates)

        if (res.success) {
            alert(res.message)
            setHasChanges(false)
            setIsEditMode(false) 
            fetchHistory()
        } else {
            alert(res.message)
        }
    }

    const handleDeleteRow = async (item: HistoryItem) => {
        if (!confirm(`[${item.inventory?.model_name}]의 ${item.settlement.billing_month}월 내역을 정말 삭제하시겠습니까?`)) return
        const res = await deleteSettlementDetailAction(
            (item.settlement as any).id, 
            item.id, 
            item.calculated_amount
        )
        if (res.success) {
            alert(res.message)
            fetchHistory()
        } else {
            alert('삭제 실패: ' + res.message)
        }
    }

    const handleRebillRow = async (item: HistoryItem) => {
        if (!confirm(`[${item.inventory?.model_name}] 건을 재청구(삭제) 하시겠습니까?`)) return
        const res = await rebillSettlementDetailAction(
            (item.settlement as any).id,
            item.id,
            item.inventory_id,
            false,
            selectedClient!.id
        )
        if (res.success) {
            alert(res.message)
            fetchHistory()
        } else {
            alert('재청구 실패: ' + res.message)
        }
    }

    const handleStatement = (item: HistoryItem) => {
        if (!selectedClient) return
        const sameSettlementItems = items.filter(i => i.settlement_id === item.settlement_id)
        const tempSettlement: Settlement = {
            id: item.settlement_id,
            billing_year: item.settlement.billing_year,
            billing_month: item.settlement.billing_month,
            client_id: selectedClient.id,
            client: selectedClient,
            organization_id: '',
            total_amount: sameSettlementItems.reduce((sum, i) => sum + i.calculated_amount, 0),
            // @ts-ignore
            details: sameSettlementItems.map(i => ({ ...i, inventory: i.inventory }))
        } as unknown as Settlement
        setStatementData(tempSettlement)
        setIsStatementOpen(true)
    }

    const handleSelectClient = (client: Client) => {
        setSelectedClient(client)
        setSearchTerm(client.name)
        fetchHistory(client)
        setShowSuggestions(false)
    }

    return (
        <div style={{ width: '100%', padding: '20px', fontFamily: 'sans-serif' }}>
            
            <HistoryFilter
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                showSuggestions={showSuggestions}
                setShowSuggestions={setShowSuggestions}
                filteredClients={filteredClients}
                onSelectClient={handleSelectClient}
                onSearchTrigger={handleSearchTrigger}
                startMonth={startMonth}
                setStartMonth={setStartMonth}
                endMonth={endMonth}
                setEndMonth={setEndMonth}
                viewMode={viewMode}
                setViewMode={setViewMode}
                isEditMode={isEditMode}
                onToggleEditMode={handleToggleEditMode}
                // setIsEditMode 제거됨 (에러 해결)
                hasChanges={hasChanges}
                onSave={handleSave}
                totalCount={items.length}
            />

            {selectedClient ? (
                <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #ddd', overflow: 'hidden', minHeight: '600px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                    
                    <div style={{ padding: '20px 24px', borderBottom: '1px solid #eee', backgroundColor: '#fafafa' }}>
                        <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#111', marginRight: '12px' }}>🏢 {selectedClient.name}</span>
                        <span style={{ color: '#666', fontSize: '0.95rem' }}>| {selectedClient.representative_name} ({selectedClient.phone})</span>
                    </div>

                    <HistoryTable
                        loading={loading}
                        items={items}
                        viewMode={viewMode}
                        isEditMode={isEditMode}
                        errorMap={errorMap}
                        onInputChange={handleInputChange}
                        onStatement={handleStatement}
                        onRebill={handleRebillRow}
                        onDelete={handleDeleteRow}
                    />
                </div>
            ) : (
                <div style={{ textAlign: 'center', padding: '100px 20px', color: '#999', border: '2px dashed #e0e0e0', borderRadius: '12px', backgroundColor: '#fafafa' }}>
                    <div style={{ fontSize: '3.5rem', marginBottom: '16px' }}>🔍</div>
                    <p style={{ fontSize: '1.1rem' }}>상단에서 <b>거래처를 검색</b>하여 청구 이력을 조회하세요.</p>
                </div>
            )}

            {isStatementOpen && statementData && (
                <StatementModal 
                    settlement={statementData}
                    supplier={myOrg}
                    onClose={() => setIsStatementOpen(false)}
                />
            )}
        </div>
    )
}