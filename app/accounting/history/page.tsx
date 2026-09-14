'use client'

import React, { useState, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase'
import {
  updateBulkSettlementHistoryAction,
  deleteSettlementDetailAction,
  rebillSettlementDetailAction,
  getBillingDashboardAction,
  getHometaxUploadDataForSettlementsAction,
  type BillingDashboardRow,
} from '@/app/actions/accounting'
import { getOrgBusinessInfoAction } from '@/app/actions/auth'
import { downloadHometaxBulkUploadExcel } from '@/utils/hometaxBulkExcel'
import { Client, Settlement, Organization, HistoryItem } from '@/app/types'
import StatementModal from '@/components/accounting/StatementModal'
import TaxInvoiceModal from '@/components/accounting/TaxInvoiceModal'
import HistoryFilter from '@/components/accounting/HistoryFilter'
import HistoryTable from '@/components/accounting/HistoryTable'
import HistoryDefaultList from '@/components/accounting/HistoryDefaultList'
import { calculateSingleDetailAmount } from '@/utils/billingCalculator'
import { calcGrandTotal, nextYearMonth } from '@/utils/billingAmounts'
import styles from '@/app/accounting/accounting.module.css'

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

    // 체크박스로 고른 항목(기계×청구월 단위): 수정은 1건만, 삭제·재청구는 여러 건 한번에
    const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set())
    const [editingItemId, setEditingItemId] = useState<string | null>(null)

    const [isStatementOpen, setIsStatementOpen] = useState(false)
    const [statementData, setStatementData] = useState<Settlement | null>(null)

    const [isTaxInvoiceOpen, setIsTaxInvoiceOpen] = useState(false)
    const [taxInvoiceTarget, setTaxInvoiceTarget] = useState<{ settlementId: string; clientName: string; amount: number } | null>(null)

    // 검색 전 첫 화면: 이번 달(선택한 연/월) 월 정산 등록 완료 목록 + 체크박스 일괄 홈택스 엑셀
    const [dashYear, setDashYear] = useState(new Date().getFullYear())
    const [dashMonth, setDashMonth] = useState(new Date().getMonth() + 1)
    const [dashRows, setDashRows] = useState<BillingDashboardRow[]>([])
    const [dashLoading, setDashLoading] = useState(false)
    const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
    const [bulkDownloading, setBulkDownloading] = useState(false)
    // 아코디언으로 펼쳐진 행 (없으면 null)
    const [openSettlementId, setOpenSettlementId] = useState<string | null>(null)

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

    // 거래처 미선택(검색 전) 상태일 때만 해당 연/월의 등록 완료 목록을 불러온다
    useEffect(() => {
        if (selectedClient) return
        let cancelled = false
        ;(async () => {
            setDashLoading(true)
            const res = await getBillingDashboardAction(dashYear, dashMonth)
            if (cancelled) return
            setDashLoading(false)
            if (res.success) setDashRows(res.data)
            setCheckedIds(new Set())
        })()
        return () => { cancelled = true }
    }, [selectedClient, dashYear, dashMonth])

    const handleToggleCheckOne = (settlementId: string) => {
        setCheckedIds(prev => {
            const next = new Set(prev)
            if (next.has(settlementId)) next.delete(settlementId)
            else next.add(settlementId)
            return next
        })
    }

    const handleToggleCheckAll = () => {
        setCheckedIds(prev => {
            if (dashRows.length > 0 && dashRows.every(r => prev.has(r.settlement_id))) {
                return new Set()
            }
            return new Set(dashRows.map(r => r.settlement_id))
        })
    }

    const handleOpenDashRow = (row: BillingDashboardRow) => {
        // 이미 펼쳐진 행을 다시 누르면 아코디언을 접는다
        if (openSettlementId === row.settlement_id) {
            handleCloseDetail()
            return
        }
        const client = clients.find(c => c.id === row.client_id)
        if (!client) return
        setOpenSettlementId(row.settlement_id)
        setSelectedClient(client)
        setSearchTerm(client.name)
        const pad = (n: number) => String(n).padStart(2, '0')
        const ym = `${row.billing_year}-${pad(row.billing_month)}`
        setStartMonth(ym)
        setEndMonth(ym)
        fetchHistory(client, ym, ym)
    }

    const handleBulkHometaxDownload = async () => {
        if (checkedIds.size === 0) return
        setBulkDownloading(true)
        try {
            const orgRes = await getOrgBusinessInfoAction()
            if (!orgRes.success || !orgRes.data) {
                alert(orgRes.message || '사업자 정보를 불러오지 못했습니다.')
                return
            }
            const org = orgRes.data
            if (!org.business_number || !org.representative_name || !org.address) {
                alert('설정 > 계정 탭에서 우리 회사 사업자 정보(사업자번호·대표자명·주소)를 먼저 입력해 주세요.')
                return
            }

            const rowsRes = await getHometaxUploadDataForSettlementsAction(Array.from(checkedIds))
            if (!rowsRes.success) {
                alert(rowsRes.message || '정산 데이터를 불러오지 못했습니다.')
                return
            }
            if (rowsRes.rows.length === 0) {
                alert('선택한 건 중 엑셀로 생성할 청구 데이터가 없습니다.')
                return
            }

            const missingBuyerInfo = rowsRes.rows.filter(r => !r.buyerBizNo || !r.buyerName)
            if (missingBuyerInfo.length > 0) {
                alert(`다음 거래처는 사업자번호가 없어 제외됩니다: ${missingBuyerInfo.map(r => r.buyerName || '(이름없음)').join(', ')}\n거래처 정보에서 사업자번호를 먼저 입력해 주세요.`)
            }
            const usableRows = rowsRes.rows.filter(r => r.buyerBizNo && r.buyerName)
            if (usableRows.length === 0) return

            downloadHometaxBulkUploadExcel(
                {
                    name: org.name,
                    businessNumber: org.business_number || '',
                    representativeName: org.representative_name || '',
                    address: org.address || '',
                    businessType: org.business_type || '',
                    businessItem: org.business_item || '',
                    email: org.email || '',
                },
                usableRows,
                `홈택스_일괄등록_선택건_${dashYear}${String(dashMonth).padStart(2, '0')}.xlsx`
            )
        } finally {
            setBulkDownloading(false)
        }
    }

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
        setEditingItemId(null)
        setSelectedItemIds(new Set())
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
                setOpenSettlementId(null)
                setSelectedClient(exactMatch)
                fetchHistory(exactMatch)
                setShowSuggestions(false)
            } else {
                const partialMatch = clients.find(c => c.name.includes(searchTerm))
                if (partialMatch) {
                    setOpenSettlementId(null)
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

    const handleToggleSelectItem = (id: string) => {
        setSelectedItemIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    // ✏️ 수정 — 체크박스로 정확히 1건 골랐을 때만 그 건 하나만 입력 가능해진다
    const handleStartEdit = () => {
        if (selectedItemIds.size !== 1) {
            alert('수정할 항목을 1개만 선택해 주세요.')
            return
        }
        setEditingItemId(Array.from(selectedItemIds)[0])
    }

    const handleCancelEdit = () => {
        if (hasChanges) {
            if (!confirm('수정을 취소하시겠습니까? 입력한 내용은 저장되지 않고 이전 상태로 돌아갑니다.')) return
            setItems(JSON.parse(JSON.stringify(originalItems)))
            setHasChanges(false)
        }
        setEditingItemId(null)
        setSelectedItemIds(new Set())
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
            setEditingItemId(null)
            setSelectedItemIds(new Set())
            fetchHistory()
        } else {
            alert(res.message)
        }
    }

    // 🗑️ 삭제 — 체크박스로 고른 건 여러 개를 한 번에
    const handleBulkDelete = async () => {
        if (selectedItemIds.size === 0) return
        const targets = items.filter(i => selectedItemIds.has(i.id))
        if (!confirm(`선택한 ${targets.length}건을 정말 삭제하시겠습니까?`)) return

        let failCount = 0
        for (const item of targets) {
            const res = await deleteSettlementDetailAction(
                (item.settlement as any).id || item.settlement_id,
                item.id,
                item.calculated_amount
            )
            if (!res.success) failCount++
        }

        alert(failCount === 0 ? `${targets.length}건 삭제했습니다.` : `${targets.length}건 중 ${failCount}건 삭제에 실패했습니다.`)
        setSelectedItemIds(new Set())
        fetchHistory()
    }

    // 🔄 재청구 — 체크박스로 고른 건 여러 개를 한 번에
    const handleBulkRebill = async () => {
        if (selectedItemIds.size === 0 || !selectedClient) return
        const targets = items.filter(i => selectedItemIds.has(i.id))
        if (!confirm(`선택한 ${targets.length}건을 재청구(삭제)하시겠습니까?`)) return

        let failCount = 0
        for (const item of targets) {
            const res = await rebillSettlementDetailAction(
                (item.settlement as any).id || item.settlement_id,
                item.id,
                item.inventory_id,
                false,
                selectedClient.id
            )
            if (!res.success) failCount++
        }

        alert(failCount === 0 ? `${targets.length}건 재청구했습니다.` : `${targets.length}건 중 ${failCount}건 재청구에 실패했습니다.`)
        setSelectedItemIds(new Set())
        fetchHistory()
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

    const handleTaxInvoice = (item: HistoryItem) => {
        if (!selectedClient) return
        const sameSettlementItems = items.filter(i => i.settlement_id === item.settlement_id)
        const supply = sameSettlementItems.reduce((sum, i) => sum + i.calculated_amount, 0)
        setTaxInvoiceTarget({
            settlementId: item.settlement_id,
            clientName: selectedClient.name,
            amount: calcGrandTotal(supply),
        })
        setIsTaxInvoiceOpen(true)
    }

    const handleSelectClient = (client: Client) => {
        setOpenSettlementId(null)
        setSelectedClient(client)
        setSearchTerm(client.name)
        fetchHistory(client)
        setShowSuggestions(false)
    }

    const handleCloseDetail = () => {
        setOpenSettlementId(null)
        setSelectedClient(null)
        setSearchTerm('')
        setStartMonth('')
        setEndMonth('')
        setItems([])
        setOriginalItems([])
        setEditingItemId(null)
        setSelectedItemIds(new Set())
        setHasChanges(false)
    }

    const displayItems = focusInventoryId
        ? items.filter(i => i.inventory_id === focusInventoryId)
        : items

    // 열기를 누른 거래처의 상세 내용 — 아코디언(행 바로 밑) 또는, 검색으로 들어온 경우(목록에 없는 달)엔
    // 목록 밑에 표시한다. 별도 컴포넌트로 빼지 않고 이 안에서 재사용한다.
    const detailPanel = selectedClient && (
        <>
            <div className={styles.header} style={{ cursor: 'default', flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span className={styles.cardTitle} style={{ fontSize: '1rem' }}>{selectedClient.name}</span>
                    <span style={{ color: 'var(--notion-sub-text)', fontSize: '0.85rem', fontWeight: 400 }}>| {selectedClient.representative_name} ({selectedClient.phone})</span>
                </span>

                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--notion-sub-text)' }}>
                        선택 {selectedItemIds.size}건
                    </span>
                    {editingItemId ? (
                        <>
                            <span style={{ fontSize: '0.8rem', color: '#b45309' }}>수정 중 — 당월을 바꾸면 다음 달 전월이 자동 반영됩니다</span>
                            {hasChanges && (
                                <button type="button" onClick={handleSave} className={styles.saveBtn} style={{ padding: '6px 14px', backgroundColor: '#d93025', fontSize: '0.8rem' }}>
                                    저장
                                </button>
                            )}
                            <button type="button" onClick={handleCancelEdit} className={styles.btnOutline} style={{ padding: '6px 14px', backgroundColor: '#666', color: '#fff', border: 'none' }}>
                                수정 취소
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                type="button"
                                onClick={handleStartEdit}
                                disabled={selectedItemIds.size !== 1}
                                className={styles.btnOutline}
                                style={selectedItemIds.size === 1 ? { color: 'var(--notion-blue)', borderColor: 'var(--notion-blue)' } : undefined}
                                title="체크박스에서 1건만 선택해야 수정할 수 있습니다"
                            >
                                수정
                            </button>
                            <button
                                type="button"
                                onClick={handleBulkRebill}
                                disabled={selectedItemIds.size === 0}
                                className={styles.btnOutline}
                                style={selectedItemIds.size > 0 ? { color: '#b45309', borderColor: '#ffa500' } : undefined}
                            >
                                재청구
                            </button>
                            <button
                                type="button"
                                onClick={handleBulkDelete}
                                disabled={selectedItemIds.size === 0}
                                className={styles.btnOutline}
                                style={selectedItemIds.size > 0 ? { color: '#d93025', borderColor: '#d93025' } : undefined}
                            >
                                삭제
                            </button>
                        </>
                    )}
                </div>
            </div>

            <HistoryTable
                loading={loading}
                items={displayItems}
                viewMode={viewMode}
                checkedIds={selectedItemIds}
                editingId={editingItemId}
                errorMap={errorMap}
                onInputChange={handleInputChange}
                onStatement={handleStatement}
                onTaxInvoice={handleTaxInvoice}
                onToggleCheck={handleToggleSelectItem}
            />
        </>
    )

    return (
        <div className="pageShell" style={{ fontFamily: 'sans-serif' }}>
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

            <HistoryDefaultList
                year={dashYear}
                month={dashMonth}
                setYear={setDashYear}
                setMonth={setDashMonth}
                rows={dashRows}
                loading={dashLoading}
                checkedIds={checkedIds}
                onToggleOne={handleToggleCheckOne}
                onToggleAll={handleToggleCheckAll}
                onRowOpen={handleOpenDashRow}
                bulkDownloading={bulkDownloading}
                onBulkDownload={handleBulkHometaxDownload}
                openSettlementId={openSettlementId}
                renderDetail={() => detailPanel}
            />

            {/* 검색으로 들어온 거래처가 이번 달 목록(아코디언)에 없을 때의 대체 표시 */}
            {selectedClient && !openSettlementId && (
                <div className={styles.section} style={{ marginTop: 16 }}>
                    {detailPanel}
                </div>
            )}

            {isStatementOpen && statementData && (
                <StatementModal
                    settlement={statementData}
                    supplier={myOrg}
                    onClose={() => setIsStatementOpen(false)}
                />
            )}

            {isTaxInvoiceOpen && taxInvoiceTarget && (
                <TaxInvoiceModal
                    isOpen={isTaxInvoiceOpen}
                    settlementId={taxInvoiceTarget.settlementId}
                    clientName={taxInvoiceTarget.clientName}
                    defaultAmount={taxInvoiceTarget.amount}
                    onClose={() => setIsTaxInvoiceOpen(false)}
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
