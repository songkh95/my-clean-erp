'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase'
import styles from './accounting.module.css'

export default function AccountingPage() {
  const supabase = createClient()
  
  // --- 상태 관리 ---
  const [loading, setLoading] = useState(false)
  
  // 1. 등록 탭 상태
  const [regYear, setRegYear] = useState(new Date().getFullYear())
  const [regMonth, setRegMonth] = useState(new Date().getMonth() + 1)
  const [isRegOpen, setIsRegOpen] = useState(true)
  const [clients, setClients] = useState<any[]>([])
  const [inventoryMap, setInventoryMap] = useState<{[key: string]: any[]}>({}) // client_id -> inventory[]
  
  // 입력 데이터 (기계별 ID -> 당월 카운터 값)
  const [inputData, setInputData] = useState<{[key: string]: any}>({}) 
  // 전월 데이터 (기계별 ID -> 전월 카운터 값)
  const [prevData, setPrevData] = useState<{[key: string]: any}>({})
  
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set()) // 체크박스 선택된 client_id
  const [searchTerm, setSearchTerm] = useState('')
  const [showUnregistered, setShowUnregistered] = useState(false)

  // 2. 조회 탭 상태
  const [isHistOpen, setIsHistOpen] = useState(true)
  const [historyList, setHistoryList] = useState<any[]>([])
  const [histYear, setHistYear] = useState(new Date().getFullYear())
  const [histMonth, setHistMonth] = useState(new Date().getMonth() + 1)

  // --- 데이터 불러오기 ---
  useEffect(() => {
    fetchRegistrationData()
  }, [regYear, regMonth])

  useEffect(() => {
    fetchHistoryData()
  }, [histYear, histMonth])

  // 등록 탭 데이터 가져오기 (거래처, 기계, 전월 데이터)
  const fetchRegistrationData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user?.id).single()
    const orgId = profile?.organization_id

    if (!orgId) return

    // 1. 거래처 목록 가져오기 (요금제 포함)
    const { data: clientData } = await supabase
      .from('clients')
      .select('*')
      .eq('organization_id', orgId)
      .eq('status', '정상') // 정상 거래처만
      .order('name')
    
    if (clientData) setClients(clientData)

    // 2. 자산(기계) 목록 가져오기 (교체전 포함)
    const { data: invData } = await supabase
      .from('inventory')
      .select('*')
      .eq('organization_id', orgId)
      .not('client_id', 'is', null) // 설치된 것만
      .order('created_at', { ascending: true })

    // 기계를 거래처별로 묶기
    const invMap: {[key: string]: any[]} = {}
    if (invData) {
      invData.forEach(inv => {
        if (!invMap[inv.client_id]) invMap[inv.client_id] = []
        invMap[inv.client_id].push(inv)
      })
    }
    setInventoryMap(invMap)

    // 3. 전월 정산 데이터 가져오기 (자동 채우기용)
    // 조회할 '전월' 계산
    let prevY = regYear
    let prevM = regMonth - 1
    if (prevM === 0) { prevM = 12; prevY -= 1 }

    const { data: prevSettlements } = await supabase
      .from('settlements')
      .select('id, client_id')
      .eq('organization_id', orgId)
      .eq('billing_year', prevY)
      .eq('billing_month', prevM)
    
    const prevMap: {[key: string]: any} = {}
    
    // 전월 정산이 있으면 그 상세 내역(당월값)을 이번달 전월값으로 씀
    if (prevSettlements && prevSettlements.length > 0) {
      const settlementIds = prevSettlements.map(s => s.id)
      const { data: details } = await supabase
        .from('settlement_details')
        .select('inventory_id, curr_count_bw, curr_count_col, curr_count_bw_a3, curr_count_col_a3')
        .in('settlement_id', settlementIds)
      
      if (details) {
        details.forEach(d => {
          if (d.inventory_id) {
            prevMap[d.inventory_id] = {
              bw: d.curr_count_bw,
              col: d.curr_count_col,
              bw_a3: d.curr_count_bw_a3,
              col_a3: d.curr_count_col_a3
            }
          }
        })
      }
    }

    // 전월 데이터가 없는 기계(신규/첫정산)는 inventory의 initial_count 사용
    if (invData) {
      invData.forEach(inv => {
        if (!prevMap[inv.id]) {
          prevMap[inv.id] = {
            bw: inv.initial_count_bw || 0,
            col: inv.initial_count_col || 0,
            bw_a3: inv.initial_count_bw_a3 || 0,
            col_a3: inv.initial_count_col_a3 || 0
          }
        }
      })
    }
    setPrevData(prevMap)
    setLoading(false)
  }

  // 조회 탭 데이터 가져오기
  const fetchHistoryData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user?.id).single()
    
    const { data } = await supabase
      .from('settlements')
      .select('*, client:client_id(name)')
      .eq('organization_id', profile?.organization_id)
      .eq('billing_year', histYear)
      .eq('billing_month', histMonth)
      .order('created_at', { ascending: false })
    
    if (data) setHistoryList(data)
  }

  // --- 핸들러 ---
  
  // 입력값 변경
  const handleInputChange = (invId: string, field: string, value: string) => {
    setInputData((prev: any) => ({
      ...prev,
      [invId]: {
        ...prev[invId],
        [field]: Number(value)
      }
    }))
  }

  // 거래처 체크박스
  const toggleClientSelection = (clientId: string) => {
    const newSet = new Set(selectedClients)
    if (newSet.has(clientId)) newSet.delete(clientId)
    else newSet.add(clientId)
    setSelectedClients(newSet)
  }

  // --- 🧮 핵심 계산 로직 (기계 교체 합산 포함) ---
  const calculateClientBill = (client: any) => {
    const assets = inventoryMap[client.id] || []
    
    let totalUsageBW = 0
    let totalUsageCol = 0
    let details: any[] = []

    // 1. 각 기계별 사용량 계산 (가중치 적용)
    assets.forEach(inv => {
      const p = prevData[inv.id] || { bw:0, col:0, bw_a3:0, col_a3:0 }
      const c = inputData[inv.id] || { bw:0, col:0, bw_a3:0, col_a3:0 }

      // 단순 차감 (음수 방지)
      const usageRawBW = Math.max(0, c.bw - p.bw)
      const usageRawCol = Math.max(0, c.col - p.col)
      const usageRawBW_A3 = Math.max(0, c.bw_a3 - p.bw_a3)
      const usageRawCol_A3 = Math.max(0, c.col_a3 - p.col_a3)

      // 가중치 적용 (A4 환산)
      const convertedBW = usageRawBW + (usageRawBW_A3 * (client.weight_a3_bw || 1))
      const convertedCol = usageRawCol + (usageRawCol_A3 * (client.weight_a3_col || 2))

      totalUsageBW += convertedBW
      totalUsageCol += convertedCol

      details.push({
        inventory_id: inv.id,
        prev: p, curr: c,
        usage: { bw: usageRawBW, col: usageRawCol, bw_a3: usageRawBW_A3, col_a3: usageRawCol_A3 },
        converted: { bw: convertedBW, col: convertedCol }
      })
    })

    // 2. 요금 계산 (기본료 + 추가요금)
    const basicFee = client.basic_fee || 0
    const basicCntBW = client.basic_cnt_bw || 0
    const basicCntCol = client.basic_cnt_col || 0
    const extraCostBW = client.extra_cost_bw || 0
    const extraCostCol = client.extra_cost_col || 0

    const extraBW = Math.max(0, totalUsageBW - basicCntBW)
    const extraCol = Math.max(0, totalUsageCol - basicCntCol)
    
    const extraFee = (extraBW * extraCostBW) + (extraCol * extraCostCol)
    const totalAmount = basicFee + extraFee

    return {
      totalUsageBW, totalUsageCol,
      basicFee, extraFee, totalAmount,
      details
    }
  }

  // 선택된 거래처 총 청구액
  const calculateSelectedTotal = () => {
    let sum = 0
    Array.from(selectedClients).forEach(cid => {
      const client = clients.find(c => c.id === cid)
      if (client) sum += calculateClientBill(client).totalAmount
    })
    return sum
  }

  // 저장하기 (청구 확정)
  const handleSave = async () => {
    if (selectedClients.size === 0) return alert('선택된 거래처가 없습니다.')
    
    const totalBill = calculateSelectedTotal()
    if (!confirm(`${selectedClients.size}개 거래처, 총 ${totalBill.toLocaleString()}원을 청구 확정하시겠습니까?`)) return

    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user?.id).single()
    const orgId = profile?.organization_id

    // 거래처별 저장 (반복문)
    for (const clientId of Array.from(selectedClients)) {
      const client = clients.find(c => c.id === clientId)
      if (!client) continue
      const billData = calculateClientBill(client)

      // 1. Settlements 저장
      const { data: settlement, error: sErr } = await supabase.from('settlements').insert({
        organization_id: orgId,
        client_id: clientId,
        billing_year: regYear,
        billing_month: regMonth,
        billing_date: client.billing_date,
        total_amount: billData.totalAmount,
        basic_fee_snapshot: billData.basicFee,
        extra_fee: billData.extraFee,
        total_usage_bw: billData.totalUsageBW,
        total_usage_col: billData.totalUsageCol,
        is_paid: false
      }).select().single()

      if (sErr || !settlement) {
        console.error('Error saving settlement', sErr); continue
      }

      // 2. Details 저장
      const detailsPayload = billData.details.map((d: any) => ({
        settlement_id: settlement.id,
        inventory_id: d.inventory_id,
        prev_count_bw: d.prev.bw, curr_count_bw: d.curr.bw,
        prev_count_col: d.prev.col, curr_count_col: d.curr.col,
        prev_count_bw_a3: d.prev.bw_a3, curr_count_bw_a3: d.curr.bw_a3,
        prev_count_col_a3: d.prev.col_a3, curr_count_col_a3: d.curr.col_a3,
        usage_bw: d.usage.bw, usage_col: d.usage.col,
        usage_bw_a3: d.usage.bw_a3, usage_col_a3: d.usage.col_a3,
        converted_usage_bw: d.converted.bw, converted_usage_col: d.converted.col
      }))

      await supabase.from('settlement_details').insert(detailsPayload)
    }

    alert('저장되었습니다!')
    setSelectedClients(new Set())
    setInputData({}) // 입력 초기화
    fetchHistoryData() // 하단 조회 목록 갱신
  }

  // 내역 삭제
  const handleDeleteHistory = async (id: string) => {
    if (confirm('정말 삭제하시겠습니까?')) {
      await supabase.from('settlements').delete().eq('id', id)
      fetchHistoryData()
    }
  }

  // --- 필터링 (검색 & 미등록 보기) ---
  const filteredClients = clients.filter(c => {
    const matchName = c.name.includes(searchTerm)
    if (!matchName) return false
    // 미등록만 보기 로직: 이번달 내역(historyList)에 없는 애들만
    if (showUnregistered) {
      const alreadyRegistered = historyList.some(h => h.client_id === c.id)
      return !alreadyRegistered
    }
    return true
  })

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>💰 정산 및 회계 관리</h1>

      {/* ========== 상단: 사용매수 등록 ========== */}
      <div className={styles.section}>
        <div onClick={() => setIsRegOpen(!isRegOpen)} className={`${styles.header} ${!isRegOpen ? styles.headerClosed : ''}`}>
          <span>📝 사용매수 등록 및 청구 ({regYear}년 {regMonth}월)</span>
          <span>{isRegOpen ? '▲' : '▼'}</span>
        </div>

        {isRegOpen && (
          <div className={styles.content}>
            {/* 컨트롤 바 */}
            <div className={styles.controls}>
              <div className={styles.controlItem}>
                <input type="number" value={regYear} onChange={e => setRegYear(Number(e.target.value))} className={styles.input} style={{width:'80px'}} />
                <span>년</span>
                <input type="number" value={regMonth} onChange={e => setRegMonth(Number(e.target.value))} className={styles.input} style={{width:'60px'}} />
                <span>월</span>
              </div>
              <div className={styles.controlItem}>
                <input placeholder="거래처 검색..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={styles.input} />
              </div>
              <div className={styles.controlItem}>
                <input type="checkbox" id="unreg" checked={showUnregistered} onChange={e => setShowUnregistered(e.target.checked)} />
                <label htmlFor="unreg" className={styles.checkboxLabel}>미등록 거래처만 보기</label>
              </div>
            </div>

            {/* 등록 테이블 */}
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.th} style={{width:'50px'}}>선택</th>
                    <th className={styles.th} style={{textAlign:'left'}}>거래처 정보</th>
                    <th className={styles.th}>기계 (모델/S.N)</th>
                    <th className={styles.th}>전월 카운터</th>
                    <th className={styles.th}>당월 카운터 (입력)</th>
                    <th className={styles.th}>실사용량 (가중치)</th>
                    <th className={styles.th}>청구 금액</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7} className={styles.td}>데이터 로딩 중...</td></tr>
                  ) : filteredClients.map(client => {
                    const assets = inventoryMap[client.id] || []
                    if (assets.length === 0) return null // 자산 없는 거래처는 스킵

                    const billData = calculateClientBill(client)
                    const isSelected = selectedClients.has(client.id)

                    return (
                      <tr key={client.id} className={styles.clientGroup}>
                        {/* 1. 체크박스 */}
                        <td className={styles.td}>
                          <input type="checkbox" checked={isSelected} onChange={() => toggleClientSelection(client.id)} />
                        </td>
                        
                        {/* 2. 거래처 정보 (Rowspan 대신 내부 div 사용) */}
                        <td className={styles.clientInfoCell}>
                          <div className={styles.clientName}>{client.name}</div>
                          <div className={styles.clientMeta}>청구일: {client.billing_date}일</div>
                          <div className={styles.clientMeta}>기본료: {client.basic_fee?.toLocaleString()}원</div>
                        </td>

                        {/* 3. 기계 목록 및 입력창 (중첩 테이블 느낌) */}
                        <td colSpan={3} style={{padding:0}}>
                          <table style={{width:'100%', borderCollapse:'collapse'}}>
                            <tbody>
                              {assets.map((inv, idx) => {
                                const p = prevData[inv.id] || {bw:0, col:0, bw_a3:0, col_a3:0}
                                const c = inputData[inv.id] || {bw:0, col:0, bw_a3:0, col_a3:0} // 입력값이 없으면 0으로 시작하지만 placeholder로 유도
                                const isReplaced = inv.status.includes('철수') || inv.status.includes('교체전')
                                
                                return (
                                  <tr key={inv.id} style={{borderBottom: idx === assets.length-1 ? 'none' : '1px solid #eee', backgroundColor: isReplaced ? '#fff5f5' : 'transparent'}}>
                                    {/* 기계명 */}
                                    <td style={{padding:'8px', fontSize:'0.85rem', color:'#555', width:'30%'}}>
                                      {isReplaced && <span className={`${styles.badge} ${styles.badgeReplaced}`}>교체전</span>}
                                      <b>{inv.model_name}</b> <br/>
                                      <span style={{fontSize:'0.75rem', color:'#999'}}>{inv.serial_number}</span>
                                    </td>
                                    
                                    {/* 전월 (Read Only) */}
                                    <td style={{padding:'8px', width:'35%'}}>
                                      <div className={styles.counterInputGroup}>
                                        <div className={styles.counterRow}><span className={styles.counterLabel}>흑백</span> <span className={styles.readOnlyValue}>{p.bw}</span></div>
                                        <div className={styles.counterRow}><span className={styles.counterLabel}>칼라</span> <span className={styles.readOnlyValue}>{p.col}</span></div>
                                        <div className={styles.counterRow}><span className={styles.counterLabel}>A3흑</span> <span className={styles.readOnlyValue}>{p.bw_a3}</span></div>
                                        <div className={styles.counterRow}><span className={styles.counterLabel}>A3칼</span> <span className={styles.readOnlyValue}>{p.col_a3}</span></div>
                                      </div>
                                    </td>

                                    {/* 당월 (Input) */}
                                    <td style={{padding:'8px', width:'35%'}}>
                                      <div className={styles.counterInputGroup}>
                                        <div className={styles.counterRow}>
                                          <span className={styles.counterLabel}>흑백</span> 
                                          <input type="number" className={styles.numberInput} placeholder={String(p.bw)} 
                                            value={inputData[inv.id]?.bw ?? ''} 
                                            onChange={e => handleInputChange(inv.id, 'bw', e.target.value)} 
                                          />
                                        </div>
                                        <div className={styles.counterRow}>
                                          <span className={styles.counterLabel}>칼라</span> 
                                          <input type="number" className={styles.numberInput} placeholder={String(p.col)} 
                                            value={inputData[inv.id]?.col ?? ''} 
                                            onChange={e => handleInputChange(inv.id, 'col', e.target.value)} 
                                          />
                                        </div>
                                        <div className={styles.counterRow}>
                                          <span className={styles.counterLabel}>A3흑</span> 
                                          <input type="number" className={styles.numberInput} placeholder={String(p.bw_a3)} 
                                            value={inputData[inv.id]?.bw_a3 ?? ''} 
                                            onChange={e => handleInputChange(inv.id, 'bw_a3', e.target.value)} 
                                          />
                                        </div>
                                        <div className={styles.counterRow}>
                                          <span className={styles.counterLabel}>A3칼</span> 
                                          <input type="number" className={styles.numberInput} placeholder={String(p.col_a3)} 
                                            value={inputData[inv.id]?.col_a3 ?? ''} 
                                            onChange={e => handleInputChange(inv.id, 'col_a3', e.target.value)} 
                                          />
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </td>

                        {/* 4. 사용량 결과 (합산) */}
                        <td className={styles.td}>
                          <div style={{fontSize:'0.9rem'}}>흑백: <span className={styles.usageValue}>{billData.totalUsageBW.toLocaleString()}</span></div>
                          <div style={{fontSize:'0.9rem'}}>칼라: <span className={styles.usageValue}>{billData.totalUsageCol.toLocaleString()}</span></div>
                          {assets.length > 1 && <div style={{fontSize:'0.7rem', color:'#d93025', marginTop:'4px'}}>*기계합산됨</div>}
                        </td>

                        {/* 5. 청구 금액 */}
                        <td className={styles.td}>
                          <div style={{fontSize:'1.1rem'}} className={styles.feeValue}>{billData.totalAmount.toLocaleString()}원</div>
                          <div style={{fontSize:'0.75rem', color:'#888'}}>
                            (추가: {billData.extraFee.toLocaleString()})
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            
            {/* 하단 액션 바 */}
            <div className={styles.actionBar}>
              <div className={styles.totalLabel}>
                선택된 거래처 합계 ({selectedClients.size}곳):
                <span className={styles.totalAmount}>{calculateSelectedTotal().toLocaleString()} 원</span>
              </div>
              <button onClick={handleSave} disabled={selectedClients.size === 0} className={styles.saveBtn}>
                청구서 확정 및 저장
              </button>
            </div>

          </div>
        )}
      </div>

      {/* ========== 하단: 청구 이력 조회 ========== */}
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
                  {historyList.length === 0 ? (
                    <tr><td colSpan={7} className={styles.td} style={{color:'#999', padding:'30px'}}>조회된 내역이 없습니다.</td></tr>
                  ) : historyList.map(hist => (
                    <tr key={hist.id} className={styles.historyRow}>
                      <td className={styles.td}>{hist.billing_year}-{hist.billing_month}</td>
                      <td className={styles.td} style={{fontWeight:'bold'}}>{hist.client?.name}</td>
                      <td className={styles.td}>{hist.billing_date}일</td>
                      <td className={styles.td}>
                        {hist.total_usage_bw.toLocaleString()} / {hist.total_usage_col.toLocaleString()}
                      </td>
                      <td className={styles.td} style={{color:'#0070f3', fontWeight:'bold'}}>
                        {hist.total_amount.toLocaleString()}원
                      </td>
                      <td className={styles.td} style={{fontSize:'0.8rem', color:'#888'}}>
                        {new Date(hist.created_at).toLocaleDateString()}
                      </td>
                      <td className={styles.td}>
                        <button onClick={() => handleDeleteHistory(hist.id)} className={styles.deleteBtn}>삭제</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}