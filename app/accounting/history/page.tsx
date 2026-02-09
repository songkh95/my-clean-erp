'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/utils/supabase'
import { updateBulkSettlementHistoryAction } from '@/app/actions/accounting'
import { Client } from '@/app/types'

interface HistoryItem {
    id: string
    inventory_id: string
    prev_count_bw: number
    curr_count_bw: number
    prev_count_col: number
    curr_count_col: number
    prev_count_bw_a3: number
    curr_count_bw_a3: number
    prev_count_col_a3: number
    curr_count_col_a3: number

    usage_bw: number
    usage_col: number
    usage_bw_a3: number
    usage_col_a3: number
    calculated_amount: number

    is_modified?: boolean

    settlement: {
        billing_year: number
        billing_month: number
        is_paid: boolean
    }
    inventory: {
        model_name: string
        serial_number: string
        plan_basic_fee: number
        plan_price_bw: number
        plan_price_col: number
        plan_basic_cnt_bw: number
        plan_basic_cnt_col: number
        plan_weight_a3_bw: number
        plan_weight_a3_col: number
    } | null
}

export default function AccountingHistoryPage() {
    const supabase = createClient()

    const [clients, setClients] = useState<Client[]>([])
    const [searchTerm, setSearchTerm] = useState('')
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [selectedClient, setSelectedClient] = useState<Client | null>(null)

    const currentYear = new Date().getFullYear()
    const [startMonth, setStartMonth] = useState(`${currentYear}-01`)
    const [endMonth, setEndMonth] = useState(`${currentYear}-12`)
    const [viewMode, setViewMode] = useState<'all' | 'machine'>('all')

    const [loading, setLoading] = useState(false)
    const [items, setItems] = useState<HistoryItem[]>([])
    const [hasChanges, setHasChanges] = useState(false)

    const searchRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const fetchClients = async () => {
            const { data } = await supabase.from('clients').select('*').order('name')
            if (data) setClients(data)
        }
        fetchClients()

        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowSuggestions(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const filteredClients = useMemo(() => {
        if (!searchTerm) return []
        return clients.filter(c =>
            c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.representative_name?.toLowerCase().includes(searchTerm.toLowerCase())
        )
    }, [searchTerm, clients])

    useEffect(() => {
        if (selectedClient) {
            fetchHistory()
        } else {
            setItems([])
        }
    }, [selectedClient, startMonth, endMonth])

    const fetchHistory = async () => {
        if (!selectedClient) return
        setLoading(true)

        const [sYear, sMonth] = startMonth.split('-').map(Number)
        const [eYear, eMonth] = endMonth.split('-').map(Number)

        const { data } = await supabase
            .from('settlement_details')
            .select(`
        *,
        settlement:settlements!inner(billing_year, billing_month, is_paid),
        inventory:inventory(
          model_name, serial_number, 
          plan_basic_fee, plan_price_bw, plan_price_col, 
          plan_basic_cnt_bw, plan_basic_cnt_col,
          plan_weight_a3_bw, plan_weight_a3_col
        )
      `)
            .eq('settlement.client_id', selectedClient.id)
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
        }
        setLoading(false)
    }

    const sortedItems = useMemo(() => {
        const list = [...items]
        if (viewMode === 'all') {
            return list.sort((a, b) => {
                const da = a.settlement.billing_year * 100 + a.settlement.billing_month
                const db = b.settlement.billing_year * 100 + b.settlement.billing_month
                return db - da
            })
        } else {
            return list.sort((a, b) => {
                if (!a.inventory || !b.inventory) return 0
                if (a.inventory.serial_number !== b.inventory.serial_number) {
                    return a.inventory.serial_number.localeCompare(b.inventory.serial_number)
                }
                const da = a.settlement.billing_year * 100 + a.settlement.billing_month
                const db = b.settlement.billing_year * 100 + b.settlement.billing_month
                return da - db
            })
        }
    }, [items, viewMode])

    const handleInputChange = (id: string, field: keyof HistoryItem, val: string) => {
        const numVal = Number(val.replace(/[^0-9]/g, ''))

        setItems(prev => prev.map(item => {
            if (item.id === id) {
                const newItem = { ...item, [field]: numVal, is_modified: true }

                if (field.includes('count')) {
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

    const handleSave = async () => {
        if (!confirm('수정된 내역을 저장하시겠습니까?')) return

        const hasNegativeUsage = items.some(i => i.is_modified && (i.usage_bw < 0 || i.usage_col < 0 || i.usage_bw_a3 < 0 || i.usage_col_a3 < 0));
        if (hasNegativeUsage) {
            if (!confirm('⚠️ 일부 사용량이 마이너스(-)입니다. 이대로 저장하시겠습니까? (요금은 0원으로 계산됩니다)')) return;
        }

        const updates = items.filter(i => i.is_modified)
        const res = await updateBulkSettlementHistoryAction(updates)

        if (res.success) {
            alert(res.message)
            setHasChanges(false)
            fetchHistory()
        } else {
            alert(res.message)
        }
    }

    return (
        <div style={{ width: '100%', padding: '20px', fontFamily: 'sans-serif' }}>

            {/* 상단 필터 영역 */}
            <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #e5e5e5', marginBottom: '24px', display: 'flex', gap: '24px', alignItems: 'flex-end', flexWrap: 'wrap', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>

                {/* 거래처 검색 */}
                <div style={{ position: 'relative', width: '300px' }} ref={searchRef}>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#555', marginBottom: '8px' }}>거래처 검색</label>
                    <input
                        type="text"
                        placeholder="거래처명 입력..."
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setShowSuggestions(true); }}
                        onFocus={() => setShowSuggestions(true)}
                        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ccc', fontSize: '0.95rem' }}
                    />
                    {showSuggestions && filteredClients.length > 0 && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: 'white', border: '1px solid #ccc', borderRadius: '8px', maxHeight: '300px', overflowY: 'auto', zIndex: 1000, boxShadow: '0 4px 15px rgba(0,0,0,0.1)', marginTop: '4px' }}>
                            {filteredClients.map(client => (
                                <div
                                    key={client.id}
                                    onClick={() => { setSelectedClient(client); setSearchTerm(client.name); setShowSuggestions(false); }}
                                    style={{ padding: '12px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0' }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9f9f9'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                                >
                                    <div style={{ fontWeight: '600', fontSize: '0.95rem', color: '#333' }}>{client.name}</div>
                                    <div style={{ fontSize: '0.85rem', color: '#888', marginTop: '2px' }}>{client.representative_name}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 기간 및 보기 방식 */}
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#555', marginBottom: '8px' }}>시작월</label>
                        <input type="month" value={startMonth} onChange={(e) => setStartMonth(e.target.value)} style={{ padding: '11px', borderRadius: '8px', border: '1px solid #ccc', fontSize: '0.9rem' }} />
                    </div>
                    <span style={{ paddingTop: '28px', color: '#888' }}>~</span>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#555', marginBottom: '8px' }}>종료월</label>
                        <input type="month" value={endMonth} onChange={(e) => setEndMonth(e.target.value)} style={{ padding: '11px', borderRadius: '8px', border: '1px solid #ccc', fontSize: '0.9rem' }} />
                    </div>
                </div>

                <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#555', marginBottom: '8px' }}>보기 방식</label>
                    <div style={{ display: 'flex', border: '1px solid #ccc', borderRadius: '8px', overflow: 'hidden' }}>
                        <button onClick={() => setViewMode('all')} style={{ padding: '11px 20px', backgroundColor: viewMode === 'all' ? '#0070f3' : '#fff', color: viewMode === 'all' ? '#fff' : '#333', border: 'none', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '500' }}>전체 (날짜순)</button>
                        <button onClick={() => setViewMode('machine')} style={{ padding: '11px 20px', backgroundColor: viewMode === 'machine' ? '#0070f3' : '#fff', color: viewMode === 'machine' ? '#fff' : '#333', border: 'none', cursor: 'pointer', borderLeft: '1px solid #ccc', fontSize: '0.9rem', fontWeight: '500' }}>기계별 (타임라인)</button>
                    </div>
                </div>

                {hasChanges && (
                    <div style={{ marginLeft: 'auto' }}>
                        <button onClick={handleSave} style={{ padding: '12px 28px', backgroundColor: '#d93025', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 6px rgba(217,48,37,0.2)', fontSize: '0.95rem' }}>💾 변경사항 저장</button>
                    </div>
                )}
            </div>

            {/* 하단 컨텐츠 */}
            {selectedClient ? (
                <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #ddd', overflow: 'hidden', minHeight: '600px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>

                    <div style={{ padding: '20px 24px', borderBottom: '1px solid #eee', backgroundColor: '#fafafa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#111', marginRight: '12px' }}>🏢 {selectedClient.name}</span>
                            <span style={{ color: '#666', fontSize: '0.95rem' }}>| {selectedClient.representative_name} ({selectedClient.phone})</span>
                        </div>
                        <div style={{ fontSize: '0.95rem', color: '#555' }}>조회 건수: <b>{items.length}</b>건</div>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                            <thead style={{ backgroundColor: '#f5f5f5', borderBottom: '2px solid #ccc', color: '#444' }}>
                                <tr>
                                    <th rowSpan={2} style={{ padding: '10px', width: '10px', borderRight: '1px solid #ddd' }}>No.</th>
                                    {/* 기계명 컬럼 */}
                                    <th rowSpan={2} style={{ padding: '10px', width: '200px', borderRight: '1px solid #ddd', textAlign: 'left' }}>기계명 (S/N)</th>
                                    <th rowSpan={2} style={{ padding: '10px', width: '80px', borderRight: '1px solid #ddd' }}>청구월</th>

                                    {/* 입력 섹션 헤더 - 넓이 조절 */}
                                    <th colSpan={4} style={{ padding: '8px', borderRight: '2px solid #bbb', borderBottom: '1px solid #ddd', backgroundColor: '#f0f0f0' }}>전월 지침 (Editable)</th>
                                    <th colSpan={4} style={{ padding: '8px', borderRight: '2px solid #bbb', borderBottom: '1px solid #ddd', backgroundColor: '#e3f2fd' }}>당월 지침 (Editable)</th>

                                    <th colSpan={2} style={{ padding: '8px', borderRight: '1px solid #ddd', borderBottom: '1px solid #ddd', width: '110px' }}>실사용 / 추가</th>
                                    <th rowSpan={2} style={{ padding: '10px', width: '100px', textAlign: 'right' }}>청구금액<br />(VAT포함)</th>
                                </tr>
                                <tr>
                                    {/* 입력창 헤더: 65px 정도로 여유 있게 설정 */}
                                    <th style={{ fontSize: '0.75rem', padding: '6px', width: '90px', backgroundColor: '#fafafa' }}>흑백</th>
                                    <th style={{ fontSize: '0.75rem', padding: '6px', width: '90px', color: '#0070f3', backgroundColor: '#fafafa' }}>칼라</th>
                                    <th style={{ fontSize: '0.75rem', padding: '6px', width: '90px', backgroundColor: '#fafafa' }}>흑A3</th>
                                    <th style={{ fontSize: '0.75rem', padding: '6px', width: '90px', color: '#0070f3', backgroundColor: '#fafafa', borderRight: '2px solid #bbb' }}>칼A3</th>

                                    {/* 당월 지침 하위 칸도 동일하게 조절 */}
                                    <th style={{ fontSize: '0.75rem', padding: '6px', width: '90px', backgroundColor: '#f0f8ff' }}>흑백</th>
                                    <th style={{ fontSize: '0.75rem', padding: '6px', width: '90px', color: '#0070f3', backgroundColor: '#f0f8ff' }}>칼라</th>
                                    <th style={{ fontSize: '0.75rem', padding: '6px', width: '90px', backgroundColor: '#f0f8ff' }}>흑A3</th>
                                    <th style={{ fontSize: '0.75rem', padding: '6px', width: '90px', color: '#0070f3', backgroundColor: '#f0f8ff', borderRight: '2px solid #bbb' }}>칼A3</th>
                                    
                                    <th style={{ fontSize: '0.75rem', padding: '6px' }}>기본매수</th>
                                    <th style={{ fontSize: '0.75rem', padding: '6px', borderRight: '1px solid #ddd', color: '#d93025' }}>추가매수</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={14} style={{ padding: '60px', textAlign: 'center' }}>데이터를 불러오는 중입니다...</td></tr>
                                ) : items.length === 0 ? (
                                    <tr><td colSpan={14} style={{ padding: '60px', textAlign: 'center', color: '#888' }}>조회된 청구 이력이 없습니다.</td></tr>
                                ) : (
                                    sortedItems.map((item, idx) => {
                                        const isPaid = item.settlement.is_paid
                                        const inventory = item.inventory
                                        const isNewGroup = viewMode === 'machine' && idx > 0 && sortedItems[idx - 1].inventory?.serial_number !== item.inventory?.serial_number

                                        const wBw = inventory?.plan_weight_a3_bw || 1
                                        const wCol = inventory?.plan_weight_a3_col || 1

                                        const pureTotalBw = item.usage_bw + (item.usage_bw_a3 * wBw)
                                        const pureTotalCol = item.usage_col + (item.usage_col_a3 * wCol)

                                        const extraBw = Math.max(0, pureTotalBw - (inventory?.plan_basic_cnt_bw || 0))
                                        const extraCol = Math.max(0, pureTotalCol - (inventory?.plan_basic_cnt_col || 0))

                                        return (
                                            <React.Fragment key={item.id}>
                                                {isNewGroup && (
                                                    <tr><td colSpan={14} style={{ height: '30px', backgroundColor: '#f4f4f4', borderTop: '2px solid #ccc', borderBottom: '1px solid #ccc' }}></td></tr>
                                                )}
                                                <tr style={{ backgroundColor: item.is_modified ? '#fffbe6' : '#fff', borderBottom: '1px solid #eee', opacity: isPaid ? 0.7 : 1 }}>
                                                    <td style={{ textAlign: 'center', color: '#888' }}>{idx + 1}</td>
                                                    <td style={{ padding: '12px' }}>
                                                        <div style={{ fontWeight: 'bold', color: '#333', fontSize: '0.9rem' }}>{inventory?.model_name || '-'}</div>
                                                        <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '2px' }}>{inventory?.serial_number || '-'}</div>
                                                    </td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>{item.settlement.billing_year}-{String(item.settlement.billing_month).padStart(2, '0')}</div>
                                                        {isPaid && <div style={{ fontSize: '0.75rem', color: '#2e7d32', fontWeight: 'bold', marginTop: '2px' }}>[완료]</div>}
                                                    </td>

                                                    {/* [수정] 입력창 셀의 padding을 조절하여 간격 확보 */}
                                                    <td style={{ padding: '6px 4px' }}><InputCell value={item.prev_count_bw} disabled={isPaid} onChange={(v) => handleInputChange(item.id, 'prev_count_bw', v)} /></td>
                                                    <td style={{ padding: '6px 4px' }}><InputCell value={item.prev_count_col} disabled={isPaid} color="#0070f3" onChange={(v) => handleInputChange(item.id, 'prev_count_col', v)} /></td>
                                                    <td style={{ padding: '6px 4px' }}><InputCell value={item.prev_count_bw_a3} disabled={isPaid} onChange={(v) => handleInputChange(item.id, 'prev_count_bw_a3', v)} /></td>
                                                    <td style={{ padding: '6px 4px', borderRight: '2px solid #bbb' }}><InputCell value={item.prev_count_col_a3} disabled={isPaid} color="#0070f3" onChange={(v) => handleInputChange(item.id, 'prev_count_col_a3', v)} /></td>

                                                    <td style={{ padding: '6px 4px', backgroundColor: '#f9fcff' }}><InputCell value={item.curr_count_bw} disabled={isPaid} bold onChange={(v) => handleInputChange(item.id, 'curr_count_bw', v)} /></td>
                                                    <td style={{ padding: '6px 4px', backgroundColor: '#f9fcff' }}><InputCell value={item.curr_count_col} disabled={isPaid} bold color="#0070f3" onChange={(v) => handleInputChange(item.id, 'curr_count_col', v)} /></td>
                                                    <td style={{ padding: '6px 4px', backgroundColor: '#f9fcff' }}><InputCell value={item.curr_count_bw_a3} disabled={isPaid} bold onChange={(v) => handleInputChange(item.id, 'curr_count_bw_a3', v)} /></td>
                                                    <td style={{ padding: '6px 4px', backgroundColor: '#f9fcff', borderRight: '2px solid #bbb' }}><InputCell value={item.curr_count_col_a3} disabled={isPaid} bold color="#0070f3" onChange={(v) => handleInputChange(item.id, 'curr_count_col_a3', v)} /></td>

                                                    <td style={{ fontSize: '0.8rem', padding: '10px', lineHeight: '1.5' }}>
                                                        <div style={{ color: item.usage_bw < 0 ? '#d93025' : 'inherit' }}>흑: {item.usage_bw.toLocaleString()}</div>
                                                        <div style={{ color: item.usage_col < 0 ? '#d93025' : '#0070f3' }}>칼: {item.usage_col.toLocaleString()}</div>
                                                        {(item.usage_bw_a3 !== 0 || item.usage_col_a3 !== 0) && (
                                                            <>
                                                                <div style={{ color: item.usage_bw_a3 < 0 ? '#d93025' : '#666', fontSize: '0.75rem' }}>흑A3: {item.usage_bw_a3.toLocaleString()}</div>
                                                                <div style={{ color: item.usage_col_a3 < 0 ? '#d93025' : '#4dabf7', fontSize: '0.75rem' }}>칼A3: {item.usage_col_a3.toLocaleString()}</div>
                                                            </>
                                                        )}
                                                    </td>

                                                    <td style={{ fontSize: '0.8rem', padding: '10px', lineHeight: '1.5', borderRight: '1px solid #ddd', color: '#d93025' }}>
                                                        {extraBw > 0 && <div>흑: +{extraBw.toLocaleString()}</div>}
                                                        {extraCol > 0 && <div>칼: +{extraCol.toLocaleString()}</div>}
                                                        {extraBw === 0 && extraCol === 0 && <div style={{ color: '#ccc' }}>-</div>}
                                                    </td>

                                                    <td style={{ textAlign: 'right', padding: '12px', fontWeight: 'bold', color: '#171717', fontSize: '0.9rem' }}>
                                                        {Math.floor(item.calculated_amount * 1.1).toLocaleString()}원
                                                    </td>
                                                </tr>
                                            </React.Fragment>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div style={{ textAlign: 'center', padding: '100px 20px', color: '#999', border: '2px dashed #e0e0e0', borderRadius: '12px', backgroundColor: '#fafafa' }}>
                    <div style={{ fontSize: '3.5rem', marginBottom: '16px' }}>🔍</div>
                    <p style={{ fontSize: '1.1rem' }}>상단에서 <b>거래처를 검색</b>하여 청구 이력을 조회하세요.</p>
                </div>
            )}
        </div>
    )
}

function InputCell({ value, onChange, disabled, color = '#333', bold = false }: { value: number, onChange: (val: string) => void, disabled?: boolean, color?: string, bold?: boolean }) {
    return (
        <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            style={{
                width: '100%',
                minWidth: '50px', // [수정] 최소 너비를 줄임
                border: '1px solid #d1d1d1',
                borderRadius: '4px',
                padding: '5px 4px', // [수정] 패딩 축소 (컴팩트하게)
                textAlign: 'right',
                fontSize: '0.85rem', // [수정] 폰트 크기 축소 (가장 중요)
                color: color,
                fontWeight: bold ? '600' : '400', // 두께 조절
                backgroundColor: disabled ? '#f5f5f5' : '#fff',
                transition: 'all 0.1s',
                outline: 'none',
                boxShadow: disabled ? 'none' : '0 1px 1px rgba(0,0,0,0.05)',
                boxSizing: 'border-box' // [중요] 테두리 포함 크기 계산
            }}
            onFocus={(e) => {
                e.target.style.border = '1px solid #0070f3';
                e.target.style.boxShadow = '0 0 0 2px rgba(0,112,243,0.1)';
            }}
            onBlur={(e) => {
                e.target.style.border = '1px solid #d1d1d1';
                e.target.style.boxShadow = '0 1px 1px rgba(0,0,0,0.05)';
            }}
        />
    )
}