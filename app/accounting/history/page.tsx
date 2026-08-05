'use client'

import React, { useState, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
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
import { calculateSingleDetailAmount } from '@/utils/billingCalculator'
import { calcGrandTotal, nextYearMonth } from '@/utils/billingAmounts'

function AccountingHistoryContent() {
    const supabase = createClient()
    const searchParams = useSearchParams()

    const [clients, setClients] = useState<Client[]>([])
    const [searchTerm, setSearchTerm] = useState('')
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [selectedClient, setSelectedClient] = useState<Client | null>(null)
    const [myOrg, setMyOrg] = useState<Organization | null>(null)

    /** 빈 문자열 = 기간 미선택 → 해당 거래처 전체 이력 */
    const [startMonth, setStartMonth] = useState('')
    const [endMonth, setEndMonth] = useState('')
    const [viewMode, setViewMode] = useState<'all' | 'machine'>('all')
    const [focusInventoryId, setFocusInventoryId] = useState<string | null>(null)

    const [loading, setLoading] = useState(false)
    const [items, setItems] = useState<HistoryItem[]>([])
    const [originalItems, setOriginalItems] = useState<HistoryItem[]>([])
    const [hasChanges, setHasChanges] = useState(false)
    const [isEditMode, setIsEditMode] = useState(false)

    const [isStatementOpen, setIsStatementOpen] = useState(false)
    const [statementData, setStatementData] = useState<Settlement | null>(null)

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
            if (data) setClients(data as Client[])
        }
        fetchInitialData()
    }, [supabase])

    // 등록 페이지에서 넘어온 쿼리로 거래처·기간 자동 포커스
    useEffect(() => {
        if (clients.length === 0) return

        const clientId = searchParams.get('client_id')
        const inventoryId = searchParams.get('inventory_id')
        const focusYear = searchParams.get('focus_year')
        const focusMonth = searchParams.get('focus_month')

        const bootstrap = async () => {
            let targetClient: Client | null = null

            if (clientId) {
                targetClient = clients.find(c => c.id === clientId) || null
            }

            if (!targetClient && inventoryId) {
                const { data: inv } = await supabase
                    .from('inventory')
                    .select('client_id')
                    .eq('id', inventoryId)
                    .maybeSingle()
                if (inv?.client_id) {
                    targetClient = clients.find(c => c.id === inv.client_id) || null
                }
            }

            if (focusYear && focusMonth) {
                const y = Number(focusYear)
                const pad = (n: number) => String(n).padStart(2, '0')
                const m = pad(Number(focusMonth))
                setStartMonth(`${y}-${m}`)
                setEndMonth(`${y}-${m}`)
            }

            if (inventoryId) setFocusInventoryId(inventoryId)

            if (targetClient) {
                setSelectedClient(targetClient)
                setSearchTerm(targetClient.name)
                if (focusYear && focusMonth) {
                    const y = Number(focusYear)
                    const pad = (n: number) => String(n).padStart(2, '0')
                    const m = pad(Number(focusMonth))
                    await fetchHistory(targetClient, `${y}-${m}`, `${y}-${m}`)
                } else {
                    await fetchHistory(targetClient, '', '')
                }
                setIsEditMode(true)
            }
        }

        if (searchParams.get('mode') === 'timeline' || clientId || inventoryId) {
            bootstrap()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clients, searchParams])

    const filteredClients = useMemo(() => {
        if (!searchTerm) return []
        return clients.filter(c =>
            c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.representative_name?.toLowerCase().includes(searchTerm.toLowerCase())
        )
    }, [searchTerm, clients])

    const fetchHistory = async (
        targetClient: Client | null = selectedClient,
        sMonthStr = startMonth,
        eMonthStr = endMonth
    ) => {
        if (!targetClient) {
            alert('거래처를 선택하거나 입력해주세요.')
            return
        }
        
        setLoading(true)
        setIsEditMode(false) 
        setHasChanges(false)

        const hasStart = Boolean(sMonthStr)
        const hasEnd = Boolean(eMonthStr)

        let query = supabase
            .from('settlement_details')
            .select(`
                *,
                settlement:settlements!inner(id, billing_year, billing_month, is_paid, total_amount),
                inventory:inventory(
                    id, model_name, serial_number, billing_group_id,
                    plan_basic_fee, plan_price_bw, plan_price_col, 
                    plan_basic_cnt_bw, plan_basic_cnt_col,
                    plan_weight_a3_bw, plan_weight_a3_col
                )
            `)
            .eq('settlement.client_id', targetClient.id)

        // 기간이 있을 때만 연도 범위를 DB에서 좁힘 (미선택이면 전체)
        if (hasStart || hasEnd) {
            const sYear = hasStart ? Number(sMonthStr.split('-')[0]) : 2000
            const eYear = hasEnd ? Number(eMonthStr.split('-')[0]) : 2100
            query = query
                .gte('settlement.billing_year', Math.min(sYear, eYear))
                .lte('settlement.billing_year', Math.max(sYear, eYear))
        }

        const { data } = await query

        if (data) {
            const filtered = data.filter((d: any) => {
                if (!hasStart && !hasEnd) return true

                const dateVal = d.settlement.billing_year * 100 + d.settlement.billing_month
                const startVal = hasStart
                    ? (() => {
                        const [y, m] = sMonthStr.split('-').map(Number)
                        return y * 100 + m
                    })()
                    : 0
                const endVal = hasEnd
                    ? (() => {
                        const [y, m] = eMonthStr.split('-').map(Number)
                        return y * 100 + m
                    })()
                    : 999999

                return dateVal >= startVal && dateVal <= endVal
            }).map((d: any) => ({
                ...d,
                settlement_id: d.settlement_id || d.settlement?.id,
                usage_bw: d.usage_bw || 0,
                usage_col: d.usage_col || 0,
                usage_bw_a3: d.usage_bw_a3 || 0,
                usage_col_a3: d.usage_col_a3 || 0,
                calculated_amount: d.calculated_amount || 0,
                is_modified: false
            })) as HistoryItem[]

            // 최신 월이 위로 오도록 정렬
            filtered.sort((a, b) => {
                const av = a.settlement.billing_year * 100 + a.settlement.billing_month
                const bv = b.settlement.billing_year * 100 + b.settlement.billing_month
                return bv - av
            })

            setItems(filtered)
            setOriginalItems(JSON.parse(JSON.stringify(filtered)))
        } else {
            setItems([])
            setOriginalItems([])
        }
        setLoading(false)
    }

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

    const recalcItem = (item: HistoryItem): HistoryItem => {
        const prev = {
            bw: item.prev_count_bw || 0,
            col: item.prev_count_col || 0,
            bw_a3: item.prev_count_bw_a3 || 0,
            col_a3: item.prev_count_col_a3 || 0,
        }
        const curr = {
            bw: item.curr_count_bw || 0,
            col: item.curr_count_col || 0,
            bw_a3: item.curr_count_bw_a3 || 0,
            col_a3: item.curr_count_col_a3 || 0,
        }
        const inv = item.inventory
        const computed = calculateSingleDetailAmount({
            prev,
            curr,
            plan_basic_fee: inv?.plan_basic_fee,
            plan_basic_cnt_bw: inv?.plan_basic_cnt_bw,
            plan_basic_cnt_col: inv?.plan_basic_cnt_col,
            plan_price_bw: inv?.plan_price_bw,
            plan_price_col: inv?.plan_price_col,
            plan_weight_a3_bw: inv?.plan_weight_a3_bw,
            plan_weight_a3_col: inv?.plan_weight_a3_col,
        })
        return {
            ...item,
            usage_bw: computed.usage.bw,
            usage_col: computed.usage.col,
            usage_bw_a3: computed.usage.bw_a3,
            usage_col_a3: computed.usage.col_a3,
            calculated_amount: computed.amount,
            is_modified: true,
        }
    }

    const handleInputChange = (id: string, field: keyof HistoryItem, val: string) => {
        const numVal = Number(val.replace(/[^0-9]/g, ''))

        setItems(prevItems => {
            let next = prevItems.map(item => {
                if (item.id !== id) return item
                if (item.settlement?.is_paid) return item

                let updated = { ...item, [field]: numVal, is_modified: true } as HistoryItem
                updated = recalcItem(updated)
                return updated
            })

            // 당월(curr) 수정 시 → 다음 달 전월(prev) 자동 맞춤 (입금완료 제외)
            const edited = next.find(i => i.id === id)
            if (edited && String(field).startsWith('curr_count')) {
                const { year: nY, month: nM } = nextYearMonth(
                    edited.settlement.billing_year,
                    edited.settlement.billing_month
                )
                next = next.map(item => {
                    if (
                        item.inventory_id === edited.inventory_id &&
                        item.settlement.billing_year === nY &&
                        item.settlement.billing_month === nM &&
                        !item.settlement.is_paid
                    ) {
                        const cascaded = {
                            ...item,
                            prev_count_bw: edited.curr_count_bw,
                            prev_count_col: edited.curr_count_col,
                            prev_count_bw_a3: edited.curr_count_bw_a3,
                            prev_count_col_a3: edited.curr_count_col_a3,
                            is_modified: true,
                        } as HistoryItem
                        return recalcItem(cascaded)
                    }
                    return item
                })
            }

            return next
        })
        setHasChanges(true)
    }

    const handleToggleEditMode = () => {
        if (isEditMode) {
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
            setIsEditMode(true)
        }
    }

    const handleSave = async () => {
        if (errorMap.size > 0) {
            alert('⚠️ 데이터 불일치가 남아 있습니다.\n빨간색 칸은 [지난달 당월]과 [이번달 전월]이 다릅니다.\n지난달 당월을 수정하면 다음 달 전월이 자동으로 맞춰집니다.')
            return
        }

        if (!confirm('수정된 내역을 저장할까요?\n(다음 달 전월 지침·금액도 함께 반영됩니다)')) return

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
            (item.settlement as any).id || item.settlement_id, 
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
            (item.settlement as any).id || item.settlement_id,
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
        const supply = sameSettlementItems.reduce((sum, i) => sum + i.calculated_amount, 0)
        const tempSettlement: Settlement = {
            id: item.settlement_id,
            billing_year: item.settlement.billing_year,
            billing_month: item.settlement.billing_month,
            client_id: selectedClient.id,
            client: selectedClient,
            organization_id: '',
            total_amount: calcGrandTotal(supply),
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

    const displayItems = focusInventoryId
        ? items.filter(i => i.inventory_id === focusInventoryId)
        : items

    return (
        <div className="pageShell" style={{ fontFamily: 'sans-serif' }}>
            <h1 className="pageTitle">청구 이력 / 수정</h1>
            
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
                hasChanges={hasChanges}
                onSave={handleSave}
                totalCount={displayItems.length}
            />

            {focusInventoryId && (
                <div style={{ marginBottom: 10, fontSize: '0.85rem', color: '#666' }}>
                    특정 기기만 표시 중
                    <button
                        type="button"
                        onClick={() => setFocusInventoryId(null)}
                        style={{ marginLeft: 8, fontSize: '0.8rem', cursor: 'pointer' }}
                    >
                        전체 보기
                    </button>
                </div>
            )}

            {selectedClient ? (
                <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #ddd', overflow: 'hidden', minHeight: '600px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                    
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid #eee', backgroundColor: '#fafafa' }}>
                        <span style={{ fontSize: '1.15rem', fontWeight: 'bold', color: '#111', marginRight: '12px' }}>{selectedClient.name}</span>
                        <span style={{ color: '#666', fontSize: '0.9rem' }}>| {selectedClient.representative_name} ({selectedClient.phone})</span>
                        {isEditMode && (
                            <span style={{ marginLeft: 12, fontSize: '0.8rem', color: '#b45309' }}>
                                수정 모드 — 당월을 바꾸면 다음 달 전월이 자동 반영됩니다
                            </span>
                        )}
                    </div>

                    <HistoryTable
                        loading={loading}
                        items={displayItems}
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
                <div style={{ textAlign: 'center', padding: '80px 20px', color: '#999', border: '2px dashed #e0e0e0', borderRadius: '12px', backgroundColor: '#fafafa' }}>
                    <p style={{ fontSize: '1.05rem' }}>상단에서 <b>거래처를 검색</b>하여 청구 이력을 조회하세요.</p>
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

export default function AccountingHistoryPage() {
    return (
        <Suspense fallback={<div className="pageShell">불러오는 중…</div>}>
            <AccountingHistoryContent />
        </Suspense>
    )
}
