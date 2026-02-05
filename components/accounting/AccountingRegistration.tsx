'use client'

import React, { useMemo } from 'react'
import styles from '@/app/accounting/accounting.module.css'
import { 
  Client, 
  Inventory, 
  CounterData, 
  CalculatedAsset, 
  BillCalculationResult 
} from '@/app/types'

interface Props {
  isRegOpen: boolean
  setIsRegOpen: (open: boolean) => void
  regYear: number
  setRegYear: (year: number) => void
  regMonth: number
  setRegMonth: (month: number) => void
  targetDay: string
  setTargetDay: (day: string) => void
  searchTerm: string
  setSearchTerm: (term: string) => void
  showUnregistered: boolean
  setShowUnregistered: (show: boolean) => void
  loading: boolean
  filteredClients: Client[]
  inventoryMap: { [key: string]: Inventory[] }
  inputData: { [key: string]: CounterData }
  prevData: { [key: string]: CounterData }
  selectedInventories: Set<string>
  handleInputChange: (invId: string, field: keyof CounterData, value: string) => void
  toggleInventorySelection: (invId: string) => void
  setSelectedInventoriesBulk: (ids: string[], action: 'add' | 'remove') => void
  calculateClientBill: (client: Client) => BillCalculationResult
  calculateSelectedTotal: (targetClients?: Client[]) => number
  handlePreSave: () => void
  onSearch: () => void
  handleExcludeAsset: (asset: CalculatedAsset) => void
}

export default function AccountingRegistration({
  isRegOpen, setIsRegOpen, regYear, setRegYear, regMonth, setRegMonth,
  targetDay, setTargetDay, searchTerm, setSearchTerm, showUnregistered, setShowUnregistered,
  loading, filteredClients, inventoryMap, inputData, prevData, selectedInventories,
  handleInputChange, toggleInventorySelection, setSelectedInventoriesBulk, 
  calculateClientBill, calculateSelectedTotal, handlePreSave, onSearch,
  handleExcludeAsset
}: Props) {

  const currentVisibleIds = useMemo(() => {
    return filteredClients.flatMap(client => {
      const billData = calculateClientBill(client);
      return billData.details.map(d => d.inventory_id);
    });
  }, [filteredClients, calculateClientBill]);

  const isAllSelected = currentVisibleIds.length > 0 && 
    currentVisibleIds.every(id => selectedInventories.has(id));

  const handleToggleAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedInventoriesBulk(currentVisibleIds, 'add');
    } else {
      setSelectedInventoriesBulk(currentVisibleIds, 'remove');
    }
  };

  const onNumberKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (['-', '+', 'e', 'E'].includes(e.key)) {
      e.preventDefault();
    }
  };

  const onNumberChange = (invId: string, field: keyof CounterData, value: string) => {
    const cleanValue = value.replace(/[^0-9]/g, '');
    handleInputChange(invId, field, cleanValue);
  };

  // 하단 선택 합계 계산
  const totalSupplyValue = calculateSelectedTotal(filteredClients);
  const totalVat = Math.floor(totalSupplyValue * 0.1);
  const grandTotal = totalSupplyValue + totalVat;

  return (
    <div className={styles.section}>
      <style dangerouslySetInnerHTML={{ __html: `
        input::-webkit-outer-spin-button,
        input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type=number] {
          -moz-appearance: textfield;
        }
      `}} />

      <div onClick={() => setIsRegOpen(!isRegOpen)} className={`${styles.header} ${!isRegOpen ? styles.headerClosed : ''}`}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>{isRegOpen ? '▼' : '▶'}</span>
          <span>📝 사용매수 등록 및 청구 ({regYear}년 {regMonth}월)</span>
        </span>
      </div>

      {isRegOpen && (
        <div className={styles.content}>
          <div className={styles.controls}>
            <div className={styles.controlItem}>
              <input type="number" value={regYear} onChange={e => setRegYear(Number(e.target.value))} className={styles.input} style={{ width: '60px', textAlign: 'center' }} />
              <span>년</span>
              <input type="number" value={regMonth} onChange={e => setRegMonth(Number(e.target.value))} className={styles.input} style={{ width: '40px', textAlign: 'center' }} />
              <span>월</span>
            </div>
            <div className={styles.controlItem}>
              <select value={targetDay} onChange={e => setTargetDay(e.target.value)} className={styles.input} style={{ width: '100px' }}>
                <option value="all">전체 납기일</option>
                <option value="말일">말일</option>
                {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (<option key={d} value={String(d)}>{d}일</option>))}
              </select>
            </div>
            <div className={styles.controlItem} style={{ flex: 1 }}>
              <input placeholder="거래처명, 모델명 검색..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={styles.input} style={{ width: '100%' }} />
            </div>
            <div className={styles.controlItem}>
              <input type="checkbox" id="unreg" checked={showUnregistered} onChange={e => setShowUnregistered(e.target.checked)} />
              <label htmlFor="unreg" style={{ fontSize: '0.85rem', cursor: 'pointer', color: 'var(--notion-sub-text)' }}>미등록만 보기</label>
            </div>
            <button onClick={onSearch} className={styles.saveBtn}>조회</button>
          </div>

          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th} style={{ width: '40px' }}>
                    <input type="checkbox" checked={isAllSelected} onChange={handleToggleAll} />
                  </th>
                  <th className={styles.th} style={{ width: '140px' }}>거래처</th>
                  <th className={styles.th} style={{ width: '180px' }}>기계 (모델/S.N)</th>
                  <th className={styles.th} style={{ width: '60px' }}>구분</th>
                  <th className={styles.th} style={{ width: '90px' }}>전월</th>
                  <th className={styles.th} style={{ width: '90px' }}>당월(입력)</th>
                  <th className={styles.th} style={{ width: '160px' }}>실사용 (가중치)</th>
                  <th className={styles.th} style={{ width: '130px' }}>기계별 금액</th>
                  <th className={styles.th} style={{ width: '150px' }}>총 청구 합계</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} className={styles.td} style={{ padding: '60px' }}>데이터 로딩 중...</td></tr>
                ) : filteredClients.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: '60px', textAlign: 'center', color: 'var(--notion-sub-text)' }}>
                      <div style={{ fontSize: '1rem', marginBottom: '8px' }}>📭 청구할 거래처가 없습니다.</div>
                    </td>
                  </tr>
                ) : filteredClients.map(client => {
                  const billData = calculateClientBill(client)
                  const rowSpan = billData.details.length
                  if (rowSpan === 0) return null

                  // 거래처별 합계 계산 (공급가, 부가세, 합계)
                  const clientSupply = billData.totalAmount;
                  const clientVat = Math.floor(clientSupply * 0.1);
                  const clientTotal = clientSupply + clientVat;

                  return billData.details.map((calc, idx) => {
                    const isItemSelected = selectedInventories.has(calc.inventory_id)
                    const isWithdrawn = calc.is_replacement_before || calc.is_withdrawal; 
                    const isPlanMissing = calc.plan.basic_fee === 0 && calc.plan.price_bw === 0 && calc.plan.price_col === 0;
                    const isGroupMember = calc.billing_group_id && !calc.isGroupLeader;
                    const showExcludeBtn = calc.is_replacement_before || calc.is_withdrawal;

                    let badgeLabel = calc.status;
                    let badgeStyle = { backgroundColor: '#f1f1f0', color: '#37352f' };

                    if (calc.is_replacement_before) {
                      badgeLabel = "교체(철수)"; badgeStyle = { backgroundColor: '#ffe2dd', color: '#d93025' };
                    } else if (calc.is_replacement_after) {
                      badgeLabel = "교체(설치)"; badgeStyle = { backgroundColor: '#d3e5ef', color: '#0070f3' };
                    } else if (calc.is_withdrawal) {
                      badgeLabel = "회수"; badgeStyle = { backgroundColor: '#f1f1f0', color: '#787774' };
                    } else if (calc.status === '설치') {
                      badgeLabel = "설치"; badgeStyle = { backgroundColor: '#dbeddb', color: '#2eaadc' };
                    }

                    return (
                      <tr key={calc.inventory_id} style={{
                        backgroundColor: isWithdrawn ? '#fff9f9' : (isItemSelected ? 'var(--notion-blue-light)' : 'transparent')
                      }}>
                        <td className={styles.td}>
                          <input type="checkbox" checked={isItemSelected} onChange={() => toggleInventorySelection(calc.inventory_id)} />
                        </td>

                        {idx === 0 && (
                          <td className={styles.clientInfoCell} rowSpan={rowSpan}>
                            <div className={styles.clientName}>{client.name}</div>
                          </td>
                        )}

                        <td className={styles.td} style={{ textAlign: 'left', padding: '12px' }}>
                           <div style={{ marginBottom: '6px', display:'flex', gap:'4px' }}>
                             <span className={styles.badge} style={badgeStyle}>{badgeLabel}</span>
                             {calc.billing_group_id && (
                               <span className={styles.badge} style={{ backgroundColor: '#f9f0ff', color: '#9065b0' }} title="합산 청구">🔗 합산</span>
                             )}
                           </div>
                           <div style={{ fontWeight: '600', fontSize:'0.9rem' }}>{calc.model_name}</div>
                           <div style={{ fontSize: '0.75rem', color: '#999' }}>{calc.serial_number}</div>
                           <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '4px' }}>청구일: {calc.billing_date || '-'}</div>
                           {isPlanMissing && <div style={{ fontSize: '0.7rem', color: '#d93025', marginTop: '4px' }}>(요금제 미등록)</div>}
                           {showExcludeBtn && (
                              <button onClick={(e) => { e.stopPropagation(); handleExcludeAsset(calc); }} style={{ marginTop: '6px', fontSize: '0.7rem', padding: '2px 6px', border: '1px solid #e5e5e5', borderRadius: '4px', backgroundColor: '#fff', color: '#666', cursor: 'pointer' }}>🚫 제외</button>
                           )}
                        </td>

                        <td className={styles.td}>
                          <div className={styles.splitCellContainer}>
                            <div className={styles.rowGray}>흑백</div><div className={styles.rowBlue}>칼라</div><div className={styles.rowGray}>흑백(A3)</div><div className={`${styles.rowBlue} ${styles.rowLast}`}>칼라(A3)</div>
                          </div>
                        </td>

                        <td className={styles.td}>
                          <div className={styles.splitCellContainer}>
                            <div className={styles.rowGray}>{calc.prev?.bw ?? 0}</div><div className={styles.rowBlue}>{calc.prev?.col ?? 0}</div><div className={styles.rowGray}>{calc.prev?.bw_a3 ?? 0}</div><div className={`${styles.rowBlue} ${styles.rowLast}`}>{calc.prev?.col_a3 ?? 0}</div>
                          </div>
                        </td>

                        <td className={styles.td}>
                          {isWithdrawn ? (
                            <div className={styles.splitCellContainer} style={{ backgroundColor: '#fff9f9' }}>
                              <div className={styles.rowGray} style={{fontWeight:'bold'}}>{calc.curr?.bw ?? 0}</div><div className={styles.rowBlue} style={{fontWeight:'bold'}}>{calc.curr?.col ?? 0}</div><div className={styles.rowGray} style={{fontWeight:'bold'}}>{calc.curr?.bw_a3 ?? 0}</div><div className={`${styles.rowBlue} ${styles.rowLast}`} style={{fontWeight:'bold'}}>{calc.curr?.col_a3 ?? 0}</div>
                            </div>
                          ) : (
                            <div className={styles.splitCellContainer}>
                              <div className={styles.rowGray}><input type="number" className={styles.numberInput} placeholder="0" value={inputData[calc.inventory_id]?.bw ?? ''} onKeyDown={onNumberKeyDown} onChange={e => onNumberChange(calc.inventory_id, 'bw', e.target.value)} /></div>
                              <div className={styles.rowBlue}><input type="number" className={styles.numberInput} placeholder="0" value={inputData[calc.inventory_id]?.col ?? ''} onKeyDown={onNumberKeyDown} onChange={e => onNumberChange(calc.inventory_id, 'col', e.target.value)} /></div>
                              <div className={styles.rowGray}><input type="number" className={styles.numberInput} placeholder="0" value={inputData[calc.inventory_id]?.bw_a3 ?? ''} onKeyDown={onNumberKeyDown} onChange={e => onNumberChange(calc.inventory_id, 'bw_a3', e.target.value)} /></div>
                              <div className={`${styles.rowBlue} ${styles.rowLast}`}><input type="number" className={styles.numberInput} placeholder="0" value={inputData[calc.inventory_id]?.col_a3 ?? ''} onKeyDown={onNumberKeyDown} onChange={e => onNumberChange(calc.inventory_id, 'col_a3', e.target.value)} /></div>
                            </div>
                          )}
                        </td>
                        
                        <td className={styles.td} style={{ padding: '12px', textAlign: 'left', fontSize: '0.8rem', lineHeight: '1.6', verticalAlign: 'top' }}>
                          {isGroupMember ? (
                            <div style={{ color: '#aaa', textAlign: 'center', padding: '30px 0' }}>그룹 합산</div>
                          ) : (
                            <>
                              <div style={{ fontWeight: '600', color: '#555', marginBottom: '2px' }}>기본매수</div>
                              <div style={{ display:'flex', justifyContent:'space-between', color: '#666', marginBottom:'2px' }}><span>흑:</span> <span>{(calc.usageBreakdown?.basicBW ?? 0).toLocaleString()}</span></div>
                              <div style={{ display:'flex', justifyContent:'space-between', color: '#0070f3', marginBottom:'4px' }}><span>칼:</span> <span>{(calc.usageBreakdown?.basicCol ?? 0).toLocaleString()}</span></div>
                              <div style={{ borderTop: '1px solid #eee', margin: '6px 0' }}></div>
                              <div style={{ fontWeight: '600', color: '#d93025', marginBottom: '2px' }}>추가매수</div>
                              <div style={{ display:'flex', justifyContent:'space-between', color: '#d93025', marginBottom:'2px' }}><span>흑:</span> <span>{(calc.usageBreakdown?.extraBW ?? 0).toLocaleString()}</span></div>
                              <div style={{ display:'flex', justifyContent:'space-between', color: '#d93025' }}><span>칼:</span> <span>{(calc.usageBreakdown?.extraCol ?? 0).toLocaleString()}</span></div>
                            </>
                          )}
                        </td>

                        {/* 기계별 청구액 (공급가) */}
                        {calc.isGroupLeader && (
                          <td className={styles.td} rowSpan={calc.groupSpan} style={{ padding: '12px', textAlign: 'right', verticalAlign: 'bottom' }}>
                            <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '8px' }}>
                              <div>기본: {(calc.rowCost?.basic ?? 0).toLocaleString()}</div>
                              <div>추가: {(calc.rowCost?.extra ?? 0).toLocaleString()}</div>
                            </div>
                            <div style={{ fontWeight: 'bold', color: 'var(--notion-main-text)', fontSize:'0.9rem', borderTop:'1px solid #eee', paddingTop:'6px' }}>
                              {(calc.rowCost?.total ?? 0).toLocaleString()}원
                            </div>
                          </td>
                        )}

                        {/* ✅ [수정] 거래처 총 합계 (하단 정렬 + 좌우 배치) */}
                        {idx === 0 && (
                          <td className={styles.td} rowSpan={rowSpan} style={{ padding: '16px 12px', backgroundColor: '#fff', verticalAlign: 'bottom', textAlign: 'right' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              
                              {/* 공급가액 */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#666' }}>
                                <span>공급</span>
                                <span>{clientSupply.toLocaleString()}</span>
                              </div>

                              {/* 부가세 */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#666' }}>
                                <span>VAT</span>
                                <span>{clientVat.toLocaleString()}</span>
                              </div>

                              {/* 구분선 및 합계 */}
                              <div style={{ borderTop: '1px solid #ddd', marginTop: '6px', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.9rem', color: '#0070f3', fontWeight: 'bold' }}>합계</span>
                                <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#d93025' }}>
                                  {clientTotal.toLocaleString()}
                                </span>
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
              <span style={{ fontSize: '0.9rem', color: '#666', marginRight: '16px' }}>
                공급가: <b>{totalSupplyValue.toLocaleString()}</b>원
              </span>
              <span style={{ fontSize: '0.9rem', color: '#666', marginRight: '16px' }}>
                부가세: <b>{totalVat.toLocaleString()}</b>원
              </span>
              <span style={{ fontSize: '1.1rem', fontWeight:'bold' }}>
                총 합계: <span className={styles.totalAmount}>{grandTotal.toLocaleString()} 원</span>
              </span>
            </div>
            <button onClick={handlePreSave} disabled={selectedInventories.size === 0} className={styles.saveBtn}>
              🚀 청구서 확정 및 저장
            </button>
          </div>
        </div>
      )}
    </div>
  )
}