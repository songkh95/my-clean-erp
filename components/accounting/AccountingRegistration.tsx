'use client'

import React, { useMemo } from 'react'
import styles from '@/app/accounting/accounting.module.css'

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
  filteredClients: any[]
  inventoryMap: { [key: string]: any[] }
  inputData: { [key: string]: any }
  prevData: { [key: string]: any }
  selectedInventories: Set<string>
  handleInputChange: (invId: string, field: string, value: string) => void
  toggleInventorySelection: (invId: string) => void
  setSelectedInventoriesBulk: (ids: string[], action: 'add' | 'remove') => void
  calculateClientBill: (client: any) => any
  calculateSelectedTotal: (targetClients?: any[]) => number
  handlePreSave: () => void
  onSearch: () => void
  handleExcludeAsset: (asset: any) => void
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
      return billData.details.map((d: any) => d.inventory_id);
    });
  }, [filteredClients, calculateClientBill]);

  const isAllSelected = currentVisibleIds.length > 0 && 
    currentVisibleIds.every(id => selectedInventories.has(id));

  const handleToggleAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    if (checked) {
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

  const onNumberChange = (invId: string, field: string, value: string) => {
    const cleanValue = value.replace(/[^0-9]/g, '');
    handleInputChange(invId, field, cleanValue);
  };

  const hasInputError = useMemo(() => {
    return filteredClients.some(client => {
      const billData = calculateClientBill(client);
      return billData.details.some((calc: any) => {
        const rawInput = inputData[calc.inventory_id] || {};
        const isWithdrawn = calc.inv.is_withdrawn;
        if (isWithdrawn) return false;
        if (rawInput.bw !== undefined && rawInput.bw < (calc.prev?.bw ?? 0)) return true;
        if (rawInput.col !== undefined && rawInput.col < (calc.prev?.col ?? 0)) return true;
        if (rawInput.bw_a3 !== undefined && rawInput.bw_a3 < (calc.prev?.bw_a3 ?? 0)) return true;
        if (rawInput.col_a3 !== undefined && rawInput.col_a3 < (calc.prev?.col_a3 ?? 0)) return true;
        return false;
      });
    });
  }, [filteredClients, calculateClientBill, inputData]);

  return (
    <div className={styles.section}>
      <style dangerouslySetInnerHTML={{ __html: `
        input::-webkit-outer-spin-button,
        input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
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

          {hasInputError && (
            <div style={{ color: '#d93025', backgroundColor: '#fff1f0', padding: '12px 16px', borderBottom: '1px solid #ffa39e', fontWeight: '500', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              ⚠️ 전월보다 적은 사용매수를 입력할 수 없습니다. 입력값을 확인해주세요.
            </div>
          )}

          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th} style={{ width: '40px' }}><input type="checkbox" checked={isAllSelected} onChange={handleToggleAll} /></th>
                  <th className={styles.th} style={{ width: '140px' }}>거래처</th>
                  <th className={styles.th} style={{ width: '180px' }}>기계 (모델/S.N)</th>
                  <th className={styles.th} style={{ width: '60px' }}>구분</th>
                  <th className={styles.th} style={{ width: '90px' }}>전월</th>
                  <th className={styles.th} style={{ width: '90px' }}>당월(입력)</th>
                  <th className={styles.th} style={{ width: '160px' }}>실사용 (가중치)</th>
                  <th className={styles.th} style={{ width: '130px' }}>기계별 청구액</th>
                  <th className={styles.th} style={{ width: '120px' }}>총 합계</th>
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

                  return billData.details.map((calc: any, idx: number) => {
                    const isItemSelected = selectedInventories.has(calc.inventory_id)
                    const isWithdrawn = calc.inv.is_withdrawn; 
                    const isPlanMissing = calc.plan.basic_fee === 0 && calc.plan.price_bw === 0 && calc.plan.price_col === 0;
                    const isGroupMember = calc.billing_group_id && !calc.isGroupLeader;
                    const showExcludeBtn = calc.inv.is_replacement_before || calc.inv.is_withdrawal;

                    let badgeLabel = calc.inv.status;
                    let badgeStyle = { backgroundColor: '#f1f1f0', color: '#37352f' };

                    if (calc.inv.is_replacement_before) {
                      badgeLabel = "교체(철수)";
                      badgeStyle = { backgroundColor: '#ffe2dd', color: '#d93025' };
                    } else if (calc.inv.is_replacement_after) {
                      badgeLabel = "교체(설치)";
                      badgeStyle = { backgroundColor: '#d3e5ef', color: '#0070f3' };
                    } else if (calc.inv.is_withdrawal) {
                      badgeLabel = "회수";
                      badgeStyle = { backgroundColor: '#f1f1f0', color: '#787774' };
                    } else if (calc.inv.status === '설치') {
                      badgeLabel = "설치";
                      badgeStyle = { backgroundColor: '#dbeddb', color: '#2eaadc' };
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
                             <span className={styles.badge} style={badgeStyle}>
                                {badgeLabel}
                             </span>
                             {calc.billing_group_id && (
                               <span className={styles.badge} style={{ backgroundColor: '#f9f0ff', color: '#9065b0' }} title="합산 청구">
                                 🔗 합산
                               </span>
                             )}
                           </div>
                           <div style={{ fontWeight: '600', fontSize:'0.9rem' }}>{calc.model_name}</div>
                           <div style={{ fontSize: '0.75rem', color: '#999' }}>{calc.serial_number}</div>
                           {/* ✨ 청구일 표시 추가 */}
                           <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '4px' }}>청구일: {calc.inv.billing_date || '-'}</div>
                           
                           {isPlanMissing && <div style={{ fontSize: '0.7rem', color: '#d93025', marginTop: '4px' }}>(요금제 미등록)</div>}
                           {showExcludeBtn && (
                              <button onClick={(e) => { e.stopPropagation(); handleExcludeAsset(calc); }} style={{ marginTop: '6px', fontSize: '0.7rem', padding: '2px 6px', border: '1px solid #e5e5e5', borderRadius: '4px', backgroundColor: '#fff', color: '#666', cursor: 'pointer' }}>
                                🚫 제외
                              </button>
                           )}
                        </td>
                        <td className={styles.td}>
                          <div className={styles.splitCellContainer}>
                            <div className={styles.rowGray}>흑백</div><div className={styles.rowBlue}>칼라</div>
                            <div className={styles.rowGray}>흑백(A3)</div><div className={`${styles.rowBlue} ${styles.rowLast}`}>칼라(A3)</div>
                          </div>
                        </td>
                        <td className={styles.td}>
                          <div className={styles.splitCellContainer}>
                            <div className={styles.rowGray}>{calc.prev?.bw ?? 0}</div><div className={styles.rowBlue}>{calc.prev?.col ?? 0}</div>
                            <div className={styles.rowGray}>{calc.prev?.bw_a3 ?? 0}</div><div className={`${styles.rowBlue} ${styles.rowLast}`}>{calc.prev?.col_a3 ?? 0}</div>
                          </div>
                        </td>
                        <td className={styles.td}>
                          {isWithdrawn ? (
                            <div className={styles.splitCellContainer} style={{ backgroundColor: '#fff9f9' }}>
                              <div className={styles.rowGray} style={{fontWeight:'bold'}}>{calc.curr?.bw ?? 0}</div>
                              <div className={styles.rowBlue} style={{fontWeight:'bold'}}>{calc.curr?.col ?? 0}</div>
                              <div className={styles.rowGray} style={{fontWeight:'bold'}}>{calc.curr?.bw_a3 ?? 0}</div>
                              <div className={`${styles.rowBlue} ${styles.rowLast}`} style={{fontWeight:'bold'}}>{calc.curr?.col_a3 ?? 0}</div>
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
                              <div style={{ display:'flex', justifyContent:'space-between', color: '#666', marginBottom:'2px' }}>
                                <span>흑백:</span> <span>{(calc.usageBreakdown?.basicBW ?? 0).toLocaleString()}</span>
                              </div>
                              <div style={{ display:'flex', justifyContent:'space-between', color: '#0070f3', marginBottom:'4px' }}>
                                <span>칼라:</span> <span>{(calc.usageBreakdown?.basicCol ?? 0).toLocaleString()}</span>
                              </div>
                              
                              <div style={{ borderTop: '1px solid #eee', margin: '6px 0' }}></div>
                              
                              <div style={{ fontWeight: '600', color: '#d93025', marginBottom: '2px' }}>추가매수</div>
                              <div style={{ display:'flex', justifyContent:'space-between', color: '#d93025', marginBottom:'2px' }}>
                                <span>흑백:</span> <span>{(calc.usageBreakdown?.extraBW ?? 0).toLocaleString()}</span>
                              </div>
                              <div style={{ display:'flex', justifyContent:'space-between', color: '#d93025' }}>
                                <span>칼라:</span> <span>{(calc.usageBreakdown?.extraCol ?? 0).toLocaleString()}</span>
                              </div>
                            </>
                          )}
                        </td>

                        {calc.isGroupLeader && (
                          <td className={styles.td} rowSpan={calc.groupSpan} style={{ padding: '12px', textAlign: 'right', verticalAlign: 'bottom' }}>
                            <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '8px' }}>
                              <div>기본: {(calc.rowCost?.basic ?? 0).toLocaleString()}</div>
                              <div>추가: {(calc.rowCost?.extra ?? 0).toLocaleString()}</div>
                            </div>
                            <div style={{ fontWeight: 'bold', color: 'var(--notion-main-text)', fontSize:'0.9rem', borderTop:'1px solid #eee', paddingTop:'6px' }}>{(calc.rowCost?.total ?? 0).toLocaleString()}원</div>
                          </td>
                        )}

                        {idx === 0 && (
                          <td className={styles.td} rowSpan={rowSpan} style={{ padding: '12px', backgroundColor: '#fff', verticalAlign: 'bottom' }}>
                            <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '6px' }}>청구 예정액</div>
                            <div style={{ fontWeight: 'bold', color: '#d93025', fontSize: '1.1rem' }}>{billData.totalAmount.toLocaleString()}원</div>
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
            <div className={styles.totalLabel}>선택 합계 ({selectedInventories.size}대): <span className={styles.totalAmount}>{calculateSelectedTotal(filteredClients).toLocaleString()} 원</span></div>
            <button onClick={handlePreSave} disabled={selectedInventories.size === 0} className={styles.saveBtn}>🚀 청구서 확정 및 저장</button>
          </div>
        </div>
      )}
    </div>
  )
}