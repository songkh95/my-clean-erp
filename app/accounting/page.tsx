'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase'
import styles from './accounting.module.css'

type AssetCalculation = {
  inv: any
  inventory_id: string
  model_name: string
  serial_number: string
  billing_group_id: string | null
  
  prev: { bw: number, col: number, bw_a3: number, col_a3: number }
  curr: { bw: number, col: number, bw_a3: number, col_a3: number }
  
  usage: { bw: number, col: number, bw_a3: number, col_a3: number }
  converted: { bw: number, col: number } 
  
  usageBreakdown: {
    basicBW: number, extraBW: number
    basicCol: number, extraCol: number
  }
  
  plan: {
    basic_fee: number
    free_bw: number
    free_col: number
    price_bw: number
    price_col: number
  }

  rowCost: {
    basic: number
    extra: number
    total: number
  }
  isGroupLeader: boolean
  groupSpan: number
}

export default function AccountingPage() {
  const supabase = createClient()
  
  const [loading, setLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  
  const [regYear, setRegYear] = useState(new Date().getFullYear())
  const [regMonth, setRegMonth] = useState(new Date().getMonth() + 1)
  const [targetDay, setTargetDay] = useState('all') 

  const [isRegOpen, setIsRegOpen] = useState(true)
  const [clients, setClients] = useState<any[]>([])
  const [inventoryMap, setInventoryMap] = useState<{[key: string]: any[]}>({}) 
  
  const [inputData, setInputData] = useState<{[key: string]: any}>({}) 
  const [prevData, setPrevData] = useState<{[key: string]: any}>({})
  
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set()) 
  const [searchTerm, setSearchTerm] = useState('')
  const [showUnregistered, setShowUnregistered] = useState(false)

  const [isHistOpen, setIsHistOpen] = useState(true)
  const [historyList, setHistoryList] = useState<any[]>([])
  const [histYear, setHistYear] = useState(new Date().getFullYear())
  const [histMonth, setHistMonth] = useState(new Date().getMonth() + 1)

  useEffect(() => { fetchRegistrationData() }, [regYear, regMonth])
  useEffect(() => { fetchHistoryData() }, [histYear, histMonth])

  const fetchRegistrationData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user?.id).single()
    const orgId = profile?.organization_id

    if (!orgId) return

    const { data: clientData } = await supabase.from('clients').select('*').eq('organization_id', orgId).eq('status', '정상').order('name')
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

    let prevY = regYear, prevM = regMonth - 1
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

  const toggleClientSelection = (clientId: string) => {
    const newSet = new Set(selectedClients)
    if (newSet.has(clientId)) newSet.delete(clientId)
    else newSet.add(clientId)
    setSelectedClients(newSet)
  }

  const calculateClientBill = (client: any) => {
    const assets = inventoryMap[client.id] || []
    
    let tempCalculations: AssetCalculation[] = assets.map(inv => {
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

    const groups: {[key: string]: typeof tempCalculations} = {}
    tempCalculations.forEach(calc => {
      const groupKey = calc.billing_group_id || `INDIVIDUAL_${calc.inventory_id}`
      if (!groups[groupKey]) groups[groupKey] = []
      groups[groupKey].push(calc)
    })

    let totalBasicFee = 0
    let totalExtraFee = 0
    let grandTotalUsageBW = 0
    let grandTotalUsageCol = 0

    Object.values(groups).forEach(groupAssets => {
      const groupBasicFee = groupAssets.reduce((sum, item) => sum + item.plan.basic_fee, 0)
      const groupFreeBW = groupAssets.reduce((sum, item) => sum + item.plan.free_bw, 0)
      const groupFreeCol = groupAssets.reduce((sum, item) => sum + item.plan.free_col, 0)
      
      const groupUsageBW = groupAssets.reduce((sum, item) => sum + item.converted.bw, 0)
      const groupUsageCol = groupAssets.reduce((sum, item) => sum + item.converted.col, 0)

      grandTotalUsageBW += groupUsageBW
      grandTotalUsageCol += groupUsageCol

      const usedBasicBW = Math.min(groupUsageBW, groupFreeBW)
      const usedExtraBW = Math.max(0, groupUsageBW - groupFreeBW)
      
      const usedBasicCol = Math.min(groupUsageCol, groupFreeCol)
      const usedExtraCol = Math.max(0, groupUsageCol - groupFreeCol)

      const unitPriceBW = groupAssets[0].plan.price_bw
      const unitPriceCol = groupAssets[0].plan.price_col

      const groupExtraFee = (usedExtraBW * unitPriceBW) + (usedExtraCol * unitPriceCol)
      const groupTotal = groupBasicFee + groupExtraFee

      totalBasicFee += groupBasicFee
      totalExtraFee += groupExtraFee

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

    const totalAmount = totalBasicFee + totalExtraFee

    return {
      details: tempCalculations,
      totalBasicFee,
      totalExtraFee,
      totalAmount,
      grandTotalUsageBW,
      grandTotalUsageCol
    }
  }

  const calculateSelectedTotal = () => {
    let sum = 0
    Array.from(selectedClients).forEach(cid => {
      const client = clients.find(c => c.id === cid)
      if (client) sum += calculateClientBill(client).totalAmount
    })
    return sum
  }

  const handlePreSave = () => {
    if (selectedClients.size === 0) return alert('선택된 거래처가 없습니다.')
    setIsModalOpen(true)
  }

  const handleFinalSave = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user?.id).single()
    const orgId = profile?.organization_id

    for (const clientId of Array.from(selectedClients)) {
      const client = clients.find(c => c.id === clientId)
      if (!client) continue
      const billData = calculateClientBill(client)

      const { data: settlement, error: sErr } = await supabase.from('settlements').insert({
        organization_id: orgId, client_id: clientId,
        billing_year: regYear, billing_month: regMonth, billing_date: client.billing_date,
        total_amount: billData.totalAmount, 
        basic_fee_snapshot: billData.totalBasicFee, 
        extra_fee: billData.totalExtraFee,
        total_usage_bw: billData.grandTotalUsageBW, 
        total_usage_col: billData.grandTotalUsageCol,
        is_paid: false
      }).select().single()

      if (sErr || !settlement) { console.error('Error', sErr); continue }

      const detailsPayload = billData.details.map((d) => ({
        settlement_id: settlement.id, inventory_id: d.inventory_id,
        prev_count_bw: d.prev.bw, curr_count_bw: d.curr.bw, prev_count_col: d.prev.col, curr_count_col: d.curr.col,
        prev_count_bw_a3: d.prev.bw_a3, curr_count_bw_a3: d.curr.bw_a3, prev_count_col_a3: d.prev.col_a3, curr_count_col_a3: d.curr.col_a3,
        usage_bw: d.usage.bw, usage_col: d.usage.col, usage_bw_a3: d.usage.bw_a3, usage_col_a3: d.usage.col_a3,
        converted_usage_bw: d.converted.bw, converted_usage_col: d.converted.col,
        calculated_amount: d.rowCost.total
      }))
      await supabase.from('settlement_details').insert(detailsPayload)
    }
    alert('저장되었습니다!')
    setIsModalOpen(false)
    setSelectedClients(new Set())
    setInputData({}) 
    fetchHistoryData() 
  }

  const handleDeleteHistory = async (id: string) => {
    if (confirm('정말 삭제하시겠습니까?')) {
      await supabase.from('settlements').delete().eq('id', id)
      fetchHistoryData()
    }
  }

  const filteredClients = clients.filter(c => {
    const matchName = c.name.includes(searchTerm)
    if (!matchName) return false
    if (targetDay !== 'all' && c.billing_date !== targetDay) return false
    if (showUnregistered) {
      const alreadyRegistered = historyList.some(h => h.client_id === c.id)
      return !alreadyRegistered
    }
    return true
  })

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>💰 정산 및 회계 관리</h1>

      <div className={styles.section}>
        <div onClick={() => setIsRegOpen(!isRegOpen)} className={`${styles.header} ${!isRegOpen ? styles.headerClosed : ''}`}>
          <span>📝 사용매수 등록 및 청구 ({regYear}년 {regMonth}월)</span>
          <span>{isRegOpen ? '▲' : '▼'}</span>
        </div>

        {isRegOpen && (
          <div className={styles.content}>
            <div className={styles.controls}>
              <div className={styles.controlItem}>
                <input type="number" value={regYear} onChange={e => setRegYear(Number(e.target.value))} className={styles.input} style={{width:'80px'}} />
                <span>년</span>
                <input type="number" value={regMonth} onChange={e => setRegMonth(Number(e.target.value))} className={styles.input} style={{width:'60px'}} />
                <span>월</span>
              </div>
              <div className={styles.controlItem}>
                <select value={targetDay} onChange={e => setTargetDay(e.target.value)} className={styles.input}>
                  <option value="all">전체 납기일</option>
                  <option value="말일">말일</option>
                  {Array.from({length: 31}, (_, i) => i + 1).map(d => (<option key={d} value={String(d)}>{d}일</option>))}
                </select>
              </div>
              <div className={styles.controlItem}>
                <input placeholder="거래처 검색..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={styles.input} />
              </div>
              <div className={styles.controlItem}>
                <input type="checkbox" id="unreg" checked={showUnregistered} onChange={e => setShowUnregistered(e.target.checked)} />
                <label htmlFor="unreg" style={{fontSize:'0.9rem', cursor:'pointer'}}>미등록 거래처만 보기</label>
              </div>
            </div>

            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.th} style={{width:'40px'}}>V</th>
                    {/* 🔴 [수정] 거래처 너비 축소 */}
                    <th className={styles.th} style={{width:'80px'}}>거래처</th>
                    {/* 🔴 [수정] 기계 너비 축소 */}
                    <th className={styles.th} style={{width:'180px'}}>기계 (모델/S.N)</th>
                    <th className={styles.th} style={{width:'60px'}}>구분</th>
                    <th className={styles.th} style={{width:'80px'}}>전월</th>
                    <th className={styles.th} style={{width:'80px'}}>당월(입력)</th>
                    <th className={styles.th} style={{width:'160px'}}>실사용량 (가중치)</th>
                    <th className={styles.th} style={{width:'140px'}}>기계별 청구액</th>
                    <th className={styles.th} style={{width:'120px', backgroundColor:'#fff9db'}}>총 합계</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (<tr><td colSpan={9} className={styles.td}>데이터 로딩 중...</td></tr>) : filteredClients.map(client => {
                    const assets = inventoryMap[client.id] || []
                    if (assets.length === 0) return null 

                    const billData = calculateClientBill(client)
                    const isSelected = selectedClients.has(client.id)
                    const rowSpan = assets.length

                    return billData.details.map((calc, idx) => {
                      const p = calc.prev
                      const isReplaced = calc.inv.status.includes('철수') || calc.inv.status.includes('교체전')
                      const isLastRow = idx === assets.length - 1
                      const borderStyle = isLastRow ? '2px solid #b0b0b0' : '1px solid #e0e0e0'

                      return (
                        <tr key={calc.inventory_id} style={{
                            backgroundColor: isSelected ? '#f0f9ff' : (isReplaced ? '#fff5f5' : 'transparent'),
                            borderBottom: borderStyle 
                        }}>
                          
                          {idx === 0 && (
                            <>
                              <td className={styles.td} rowSpan={rowSpan}>
                                <input type="checkbox" checked={isSelected} onChange={() => toggleClientSelection(client.id)} />
                              </td>
                              <td className={styles.clientInfoCell} rowSpan={rowSpan}>
                                <div className={styles.clientName}>{client.name}</div>
                                <div className={styles.clientMeta}>{client.billing_date}일</div>
                              </td>
                            </>
                          )}

                          <td className={styles.td} style={{textAlign: 'left'}}>
                             {isReplaced && <span className={`${styles.badge} ${styles.badgeReplaced}`}>교체전</span>}
                             <div style={{fontWeight:'bold', color:'#555'}}>{calc.model_name}</div>
                             <div style={{fontSize:'0.75rem', color:'#999'}}>{calc.serial_number}</div>
                             {calc.billing_group_id && <div style={{fontSize:'0.7rem', color:'#0070f3', marginTop:'2px'}}>🔗 합산그룹</div>}
                          </td>

                          {/* 🔴 [디자인 수정] 구분, 전월, 당월 컬럼을 Flexbox 컨테이너로 감싸서 높이 100% 채움 */}
                          <td className={styles.td} style={{padding:0, height:'1px'}}>
                            <div className={styles.splitCellContainer}>
                              <div className={styles.rowGray} style={{fontSize:'0.8rem', fontWeight:'bold', color:'#666'}}>흑백A4</div>
                              <div className={styles.rowBlue} style={{fontSize:'0.8rem', fontWeight:'bold', color:'#0070f3'}}>칼라A4</div>
                              <div className={styles.rowGray} style={{fontSize:'0.8rem', fontWeight:'bold', color:'#666'}}>흑백A3</div>
                              <div className={`${styles.rowBlue} ${styles.rowLast}`} style={{fontSize:'0.8rem', fontWeight:'bold', color:'#0070f3'}}>칼라A3</div>
                            </div>
                          </td>

                          <td className={styles.td} style={{padding: 0, height:'1px'}}>
                             <div className={styles.splitCellContainer}>
                               <div className={styles.rowGray}><span className={styles.readOnlyValue}>{p.bw}</span></div>
                               <div className={styles.rowBlue}><span className={styles.readOnlyValue}>{p.col}</span></div>
                               <div className={styles.rowGray}><span className={styles.readOnlyValue}>{p.bw_a3}</span></div>
                               <div className={`${styles.rowBlue} ${styles.rowLast}`}><span className={styles.readOnlyValue}>{p.col_a3}</span></div>
                             </div>
                          </td>

                          <td className={styles.td} style={{padding: 0, height:'1px'}}>
                             <div className={styles.splitCellContainer}>
                               <div className={styles.rowGray}>
                                 <input type="number" className={styles.numberInput} placeholder={String(p.bw)} value={inputData[calc.inventory_id]?.bw ?? ''} onChange={e => handleInputChange(calc.inventory_id, 'bw', e.target.value)} />
                               </div>
                               <div className={styles.rowBlue}>
                                 <input type="number" className={styles.numberInput} placeholder={String(p.col)} value={inputData[calc.inventory_id]?.col ?? ''} onChange={e => handleInputChange(calc.inventory_id, 'col', e.target.value)} />
                               </div>
                               <div className={styles.rowGray}>
                                 <input type="number" className={styles.numberInput} placeholder={String(p.bw_a3)} value={inputData[calc.inventory_id]?.bw_a3 ?? ''} onChange={e => handleInputChange(calc.inventory_id, 'bw_a3', e.target.value)} />
                               </div>
                               <div className={`${styles.rowBlue} ${styles.rowLast}`}>
                                 <input type="number" className={styles.numberInput} placeholder={String(p.col_a3)} value={inputData[calc.inventory_id]?.col_a3 ?? ''} onChange={e => handleInputChange(calc.inventory_id, 'col_a3', e.target.value)} />
                               </div>
                             </div>
                          </td>
                          
                          <td className={styles.td}>
                            <div className={styles.billSection}>
                               <span className={styles.billTitle}>- 기본매수</span>
                               <div className={styles.billRow}><span>흑백</span> <span>{calc.usageBreakdown.basicBW.toLocaleString()}장</span></div>
                               <div className={styles.billRow}><span>칼라</span> <span>{calc.usageBreakdown.basicCol.toLocaleString()}장</span></div>
                             </div>
                             <div className={styles.billSection}>
                               <span className={styles.billTitle}>- 추가매수</span>
                               <div className={styles.billRow}><span>흑백</span> <span>{calc.usageBreakdown.extraBW.toLocaleString()}장</span></div>
                               <div className={styles.billRow}><span>칼라</span> <span>{calc.usageBreakdown.extraCol.toLocaleString()}장</span></div>
                             </div>
                          </td>
                          
                          {/* 🔴 [디자인 수정] 하단 정렬 적용 */}
                          {calc.isGroupLeader ? (
                            <td className={styles.td} rowSpan={calc.groupSpan} style={{textAlign:'right', verticalAlign:'bottom', paddingBottom:'20px', borderLeft:'1px solid #e0e0e0'}}>
                              <div className={styles.billRow}>
                                <span>기본금액:</span> <span>{calc.rowCost.basic.toLocaleString()}원</span>
                              </div>
                              <div className={styles.billRow}>
                                <span>추가금액:</span> <span>{calc.rowCost.extra.toLocaleString()}원</span>
                              </div>
                              <div className={styles.billRowTotal}>
                                <span>총합:</span> <span>{calc.rowCost.total.toLocaleString()}원</span>
                              </div>
                            </td>
                          ) : null}

                          {/* 🔴 [디자인 수정] 하단 정렬 적용 */}
                          {idx === 0 && (
                            <td className={styles.td} rowSpan={rowSpan} style={{backgroundColor:'#fffdf0', borderLeft:'2px solid #ddd', verticalAlign:'bottom', textAlign:'right', paddingBottom:'20px'}}>
                              <div style={{minHeight:'80px', display:'flex', flexDirection:'column', justifyContent:'flex-end', height:'100%'}}>
                                <div style={{marginBottom:'10px'}}>
                                  {billData.details.filter(d => d.isGroupLeader).map((d, i) => (
                                    <div key={i} style={{marginBottom:'4px', color:'#555', fontSize:'0.85rem'}}>
                                      {d.rowCost.total.toLocaleString()}원
                                    </div>
                                  ))}
                                </div>
                                <div>
                                  <div style={{borderTop:'2px solid #333', margin:'5px 0'}}></div>
                                  <div style={{fontWeight:'bold', color:'#d93025', fontSize:'1.1rem'}}>
                                    총합 {billData.totalAmount.toLocaleString()}원
                                  </div>
                                </div>
                              </div>
                            </td>
                          )}

                        </tr>
                      )
                    })
                  })}
                </tbody>
              </table>
            </div>
            
            <div className={styles.actionBar}>
              <div className={styles.totalLabel}>
                선택된 거래처 합계 ({selectedClients.size}곳):
                <span className={styles.totalAmount}>{calculateSelectedTotal().toLocaleString()} 원</span>
              </div>
              <button onClick={handlePreSave} disabled={selectedClients.size === 0} className={styles.saveBtn}>
                청구서 확정 및 저장
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 내역 조회 및 모달 (기존 동일) */}
      <div className={styles.section}>
        <div onClick={() => setIsHistOpen(!isHistOpen)} className={styles.header}>
          <span>📋 청구 내역 조회 및 관리</span>
          <span>{isHistOpen ? '▲' : '▼'}</span>
        </div>
        {isHistOpen && (
          <div className={styles.content}>
            <div className={styles.controls}>
              <div className={styles.controlItem}>
                <input type="number" value={histYear} onChange={e => setHistYear(Number(e.target.value))} className={styles.input} style={{width:'80px'}} />
                <span>년</span>
                <input type="number" value={histMonth} onChange={e => setHistMonth(Number(e.target.value))} className={styles.input} style={{width:'60px'}} />
                <span>월 내역 조회</span>
              </div>
            </div>
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.th}>청구월</th>
                    <th className={styles.th}>거래처명</th>
                    <th className={styles.th}>청구 기준일</th>
                    <th className={styles.th}>총 사용량 (흑/칼)</th>
                    <th className={styles.th}>최종 청구액</th>
                    <th className={styles.th}>작성일</th>
                    <th className={styles.th}>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {historyList.length === 0 ? (<tr><td colSpan={7} className={styles.td} style={{color:'#999', padding:'30px'}}>조회된 내역이 없습니다.</td></tr>) : historyList.map(hist => (
                    <tr key={hist.id}>
                      <td className={styles.td}>{hist.billing_year}-{hist.billing_month}</td>
                      <td className={styles.td} style={{fontWeight:'bold'}}>{hist.client?.name}</td>
                      <td className={styles.td}>{hist.billing_date}일</td>
                      <td className={styles.td}>{hist.total_usage_bw.toLocaleString()} / {hist.total_usage_col.toLocaleString()}</td>
                      <td className={styles.td} style={{color:'#0070f3', fontWeight:'bold'}}>{hist.total_amount.toLocaleString()}원</td>
                      <td className={styles.td} style={{fontSize:'0.8rem', color:'#888'}}>{new Date(hist.created_at).toLocaleDateString()}</td>
                      <td className={styles.td}><button onClick={() => handleDeleteHistory(hist.id)} style={{color:'red', border:'1px solid #eee', background:'white', cursor:'pointer', padding:'4px 8px', borderRadius:'4px'}}>삭제</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalTitle}>🧾 청구서 최종 확인</div>
            <div className={styles.modalSummary}>
              총 청구 금액: {calculateSelectedTotal().toLocaleString()} 원 ({selectedClients.size}곳)
            </div>
            {Array.from(selectedClients).map(cid => {
              const client = clients.find(c => c.id === cid)
              const bill = calculateClientBill(client)
              return (
                <div key={cid} style={{marginBottom:'30px'}}>
                  <h3 style={{color:'#0070f3', borderBottom:'1px solid #eee', paddingBottom:'5px'}}>{client.name} ({client.billing_date}일 청구)</h3>
                  <table className={styles.modalTable}>
                    <thead>
                      <tr><th>기계명</th><th>전월(흑/칼)</th><th>당월(흑/칼)</th><th>실사용(가중치)</th><th>금액</th></tr>
                    </thead>
                    <tbody>
                      {bill.details.map((d, idx) => (
                         <tr key={idx}>
                           <td>{d.model_name}</td>
                           <td>{d.prev.bw} / {d.prev.col}</td>
                           <td>{d.curr.bw} / {d.curr.col}</td>
                           <td>흑:{d.converted.bw.toLocaleString()} / 칼:{d.converted.col.toLocaleString()}</td>
                           {d.isGroupLeader ? (
                             <td rowSpan={d.groupSpan} style={{fontWeight:'bold'}}>{d.rowCost.total.toLocaleString()}원</td>
                           ) : null}
                         </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{textAlign:'right', fontSize:'0.9rem'}}>
                     기본료: <b>{bill.totalBasicFee.toLocaleString()}</b> + 추가요금: <b>{bill.totalExtraFee.toLocaleString()}</b> = 
                     <span style={{color:'#d93025', fontWeight:'bold', fontSize:'1.1rem', marginLeft:'10px'}}>합계: {bill.totalAmount.toLocaleString()} 원</span>
                  </div>
                </div>
              )
            })}
            <div className={styles.modalActions}>
              <button onClick={() => setIsModalOpen(false)} className={styles.btnCancel}>취소</button>
              <button onClick={handleFinalSave} className={styles.btnConfirm}>확인 및 저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}