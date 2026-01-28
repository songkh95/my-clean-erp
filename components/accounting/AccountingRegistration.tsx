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
  calculateSelectedTotal: () => number
  handlePreSave: () => void
  onSearch: () => void
}

export default function AccountingRegistration({
  isRegOpen, setIsRegOpen, regYear, setRegYear, regMonth, setRegMonth,
  targetDay, setTargetDay, searchTerm, setSearchTerm, showUnregistered, setShowUnregistered,
  loading, filteredClients, inventoryMap, inputData, prevData, selectedInventories,
  handleInputChange, toggleInventorySelection, setSelectedInventoriesBulk, 
  calculateClientBill, calculateSelectedTotal, handlePreSave, onSearch
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

  // 🔴 전체 데이터 중 유효성 검사 에러가 있는지 확인 (전월 > 당월 입력)
  const hasInputError = useMemo(() => {
    return filteredClients.some(client => {
      const billData = calculateClientBill(client);
      return billData.details.some((calc: any) => {
        const rawInput = inputData[calc.inventory_id] || {};
        const isWithdrawn = calc.inv.is_withdrawn;
        
        // 회수된 기계는 입력 대상이 아니므로 제외
        if (isWithdrawn) return false;

        // 입력값이 있고, 전월보다 작은지 체크
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
        <span>📝 사용매수 등록 및 청구 ({regYear}년 {regMonth}월)</span>
        <span>{isRegOpen ? '▲' : '▼'}</span>
      </div>

      {isRegOpen && (
        <div className={styles.content}>
          <div className={styles.controls}>
            <div className={styles.controlItem}>
              <input type="number" value={regYear} onChange={e => setRegYear(Number(e.target.value))} className={styles.input} style={{ width: '80px' }} />
              <span>년</span>
              <input type="number" value={regMonth} onChange={e => setRegMonth(Number(e.target.value))} className={styles.input} style={{ width: '60px' }} />
              <span>월</span>
            </div>
            <div className={styles.controlItem}>
              <select value={targetDay} onChange={e => setTargetDay(e.target.value)} className={styles.input}>
                <option value="all">전체 납기일</option>
                <option value="말일">말일</option>
                {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (<option key={d} value={String(d)}>{d}일</option>))}
              </select>
            </div>
            <div className={styles.controlItem}>
              <input placeholder="거래처/기계 검색..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={styles.input} />
            </div>
            <div className={styles.controlItem}>
              <input type="checkbox" id="unreg" checked={showUnregistered} onChange={e => setShowUnregistered(e.target.checked)} />
              <label htmlFor="unreg" style={{ fontSize: '0.9rem', cursor: 'pointer' }}>미등록 거래처만 보기</label>
            </div>
            <div className={styles.controlItem}>
              <button onClick={onSearch} className={styles.saveBtn} style={{ padding: '8px 16px', height: 'auto', backgroundColor: '#0070f3' }}>🔍 조회</button>
            </div>
          </div>

          {/* 🔴 에러 메시지 표시 영역 (테이블 상단) */}
          {hasInputError && (
            <div style={{ 
              color: '#d93025', 
              backgroundColor: '#fff1f0', 
              padding: '12px 16px', 
              marginBottom: '15px', 
              borderRadius: '6px', 
              border: '1px solid #ffa39e',
              fontWeight: '600',
              fontSize: '0.95rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}>
              ⚠️ 전월보다 적은 사용매수를 입력할 수 없습니다. 입력값을 확인해주세요.
            </div>
          )}

          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th} style={{ width: '40px' }}><input type="checkbox" checked={isAllSelected} onChange={handleToggleAll} /></th>
                  <th className={styles.th} style={{ width: '100px' }}>거래처</th>
                  <th className={styles.th} style={{ width: '180px' }}>기계 (모델/S.N)</th>
                  <th className={styles.th} style={{ width: '60px' }}>구분</th>
                  <th className={styles.th} style={{ width: '80px', backgroundColor: '#f5f5f5' }}>전월</th>
                  <th className={styles.th} style={{ width: '80px', backgroundColor: '#e3f2fd' }}>당월(입력)</th>
                  <th className={styles.th} style={{ width: '160px' }}>실사용량 (가중치)</th>
                  <th className={styles.th} style={{ width: '140px' }}>기계별 청구액</th>
                  <th className={styles.th} style={{ width: '120px', backgroundColor: '#fff9db' }}>총 합계</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} className={styles.td}>데이터 로딩 중...</td></tr>
                ) : filteredClients.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: '60px', textAlign: 'center', color: '#888', backgroundColor: '#fafafa' }}>
                      <div style={{ fontSize: '1.2rem', marginBottom: '8px' }}>📭 청구할 거래처가 없습니다.</div>
                      <div style={{ fontSize: '0.9rem', color: '#aaa' }}>검색 조건을 변경하거나, 모든 정산이 완료되었는지 확인해주세요.</div>
                    </td>
                  </tr>
                ) : filteredClients.map(client => {
                  const billData = calculateClientBill(client)
                  const rowSpan = billData.details.length
                  if (rowSpan === 0) return null

                  return billData.details.map((calc: any, idx: number) => {
                    const isItemSelected = selectedInventories.has(calc.inventory_id)
                    const isLastRow = idx === rowSpan - 1
                    const isWithdrawn = calc.inv.is_withdrawn; 
                    
                    const isPlanMissing = calc.plan.basic_fee === 0 && calc.plan.price_bw === 0 && calc.plan.price_col === 0;

                    let badgeLabel = calc.inv.status;
                    let badgeStyle = { backgroundColor: '#f5f5f5', color: '#666', border: '1px solid #d9d9d9' };

                    if (calc.inv.is_replacement_before) {
                      badgeLabel = "교체(철수)";
                      badgeStyle = { backgroundColor: '#fff1f0', color: '#cf1322', border: '1px solid #ffa39e' };
                    } else if (calc.inv.is_replacement_after) {
                      badgeLabel = "교체(설치)";
                      badgeStyle = { backgroundColor: '#e6f7ff', color: '#096dd9', border: '1px solid #91d5ff' };
                    } else if (calc.inv.is_withdrawal) {
                      badgeLabel = "회수";
                      badgeStyle = { backgroundColor: '#fff1f0', color: '#595959', border: '1px solid #d9d9d9' };
                    } else if (calc.inv.status === '설치') {
                      badgeLabel = "설치";
                      badgeStyle = { backgroundColor: '#f6ffed', color: '#389e0d', border: '1px solid #b7eb8f' };
                    }

                    return (
                      <tr key={calc.inventory_id} style={{
                        backgroundColor: isWithdrawn ? '#fff1f0' : (isItemSelected ? 'rgba(0, 112, 243, 0.05)' : 'transparent'),
                        borderBottom: isLastRow ? '2px solid #ddd' : '1px solid #eee'
                      }}>
                        <td className={styles.td}>
                          <input type="checkbox" checked={isItemSelected} onChange={() => toggleInventorySelection(calc.inventory_id)} />
                        </td>
                        {idx === 0 && (
                          <td className={styles.clientInfoCell} rowSpan={rowSpan}>
                            <div className={styles.clientName}>{client.name}</div>
                            <div className={styles.clientMeta}>청구일: {calc.inv.billing_date}</div>
                          </td>
                        )}
                        <td className={styles.td} style={{ textAlign: 'left' }}>
                           <div style={{ marginBottom: '6px' }}>
                             <span className={styles.badge} style={{
                               ...badgeStyle,
                               marginRight: '0',
                               fontSize: '0.75rem',
                               padding: '2px 6px',
                               borderRadius: '4px',
                               fontWeight: '600'
                             }}>
                                {badgeLabel}
                             </span>
                           </div>

                           <div style={{ fontWeight: 'bold' }}>
                             {calc.model_name}
                           </div>
                           <div style={{ fontSize: '0.75rem', color: '#999' }}>{calc.serial_number}</div>
                           
                           {isPlanMissing && (
                             <div style={{ fontSize: '0.7rem', color: '#ff4d4f', marginTop: '4px', fontWeight: '500' }}>
                               (요금제가 등록되어 있지 않음)
                             </div>
                           )}
                        </td>
                        <td className={styles.td} style={{ padding: 0 }}>
                          <div className={styles.splitCellContainer}>
                            <div className={styles.rowGray}>흑A4</div><div className={styles.rowBlue}>칼A4</div>
                            <div className={styles.rowGray}>흑A3</div><div className={`${styles.rowBlue} ${styles.rowLast}`}>칼A3</div>
                          </div>
                        </td>
                        <td className={styles.td} style={{ padding: 0, backgroundColor: '#f9f9f9' }}>
                          <div className={styles.splitCellContainer}>
                            <div className={styles.rowGray}>{calc.prev?.bw ?? 0}</div><div className={styles.rowBlue}>{calc.prev?.col ?? 0}</div>
                            <div className={styles.rowGray}>{calc.prev?.bw_a3 ?? 0}</div><div className={`${styles.rowBlue} ${styles.rowLast}`}>{calc.prev?.col_a3 ?? 0}</div>
                          </div>
                        </td>
                        <td className={styles.td} style={{ padding: 0, backgroundColor: isWithdrawn ? '#fff1f0' : '#eff6ff' }}>
                          {isWithdrawn ? (
                            <div className={styles.splitCellContainer}>
                              <div className={styles.rowGray} style={{fontWeight:'bold'}}>{calc.curr?.bw ?? 0}</div>
                              <div className={styles.rowBlue} style={{fontWeight:'bold'}}>{calc.curr?.col ?? 0}</div>
                              <div className={styles.rowGray} style={{fontWeight:'bold'}}>{calc.curr?.bw_a3 ?? 0}</div>
                              <div className={`${styles.rowBlue} ${styles.rowLast}`} style={{fontWeight:'bold'}}>{calc.curr?.col_a3 ?? 0}</div>
                            </div>
                          ) : (
                            <div className={styles.splitCellContainer}>
                              <div className={styles.rowGray}>
                                <input 
                                  type="number" 
                                  className={styles.numberInput} 
                                  placeholder="당월 흑백 A4" 
                                  value={inputData[calc.inventory_id]?.bw ?? ''} 
                                  onKeyDown={onNumberKeyDown} 
                                  onChange={e => onNumberChange(calc.inventory_id, 'bw', e.target.value)} 
                                />
                              </div>
                              <div className={styles.rowBlue}>
                                <input 
                                  type="number" 
                                  className={styles.numberInput} 
                                  placeholder="당월 컬러 A4" 
                                  value={inputData[calc.inventory_id]?.col ?? ''} 
                                  onKeyDown={onNumberKeyDown} 
                                  onChange={e => onNumberChange(calc.inventory_id, 'col', e.target.value)} 
                                />
                              </div>
                              <div className={styles.rowGray}>
                                <input 
                                  type="number" 
                                  className={styles.numberInput} 
                                  placeholder="당월 흑백 A3" 
                                  value={inputData[calc.inventory_id]?.bw_a3 ?? ''} 
                                  onKeyDown={onNumberKeyDown} 
                                  onChange={e => onNumberChange(calc.inventory_id, 'bw_a3', e.target.value)} 
                                />
                              </div>
                              <div className={`${styles.rowBlue} ${styles.rowLast}`}>
                                <input 
                                  type="number" 
                                  className={styles.numberInput} 
                                  placeholder="당월 컬러 A3" 
                                  value={inputData[calc.inventory_id]?.col_a3 ?? ''} 
                                  onKeyDown={onNumberKeyDown} 
                                  onChange={e => onNumberChange(calc.inventory_id, 'col_a3', e.target.value)} 
                                />
                              </div>
                            </div>
                          )}
                        </td>
                        <td className={styles.td} style={{ textAlign: 'left', fontSize: '0.8rem', lineHeight: '1.4' }}>
                          <div style={{ fontWeight: '600', color: '#555' }}>기본매수</div>
                          <div style={{ paddingLeft: '4px', color: '#555' }}>
                            흑백: {(calc.usageBreakdown?.basicBW ?? 0).toLocaleString()}장<br />
                            컬러: {(calc.usageBreakdown?.basicCol ?? 0).toLocaleString()}장
                          </div>
                          <div style={{ borderTop: '1px solid #eee', margin: '4px 0' }}></div>
                          <div style={{ fontWeight: '600', color: '#d93025' }}>추가매수</div>
                          <div style={{ paddingLeft: '4px', color: '#d93025' }}>
                            흑백: {(calc.usageBreakdown?.extraBW ?? 0).toLocaleString()}장<br />
                            컬러: {(calc.usageBreakdown?.extraCol ?? 0).toLocaleString()}장
                          </div>
                        </td>
                        {calc.isGroupLeader ? (
                          <td className={styles.td} rowSpan={calc.groupSpan} style={{ textAlign: 'right', verticalAlign: 'bottom', paddingBottom: '10px' }}>
                            <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '4px' }}>
                              기본금액: {(calc.rowCost?.basic ?? 0).toLocaleString()}원<br />
                              추가금액: {(calc.rowCost?.extra ?? 0).toLocaleString()}원
                            </div>
                            <div style={{ fontWeight: 'bold', borderTop: '1px solid #eee', paddingTop: '4px', color: '#0070f3' }}>{(calc.rowCost?.total ?? 0).toLocaleString()}원</div>
                          </td>
                        ) : (
                          <td className={styles.td} style={{ backgroundColor: '#fafafa', color: '#ccc', fontSize: '0.7rem' }}>합산 그룹원</td>
                        )}
                        {idx === 0 && (
                          <td className={styles.td} rowSpan={rowSpan} style={{ backgroundColor: '#fffdf0', textAlign: 'right', verticalAlign: 'bottom' }}>
                            <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '4px' }}>거래처 총액</div>
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
            <div className={styles.totalLabel}>선택 합계 ({selectedInventories.size}대): <span className={styles.totalAmount}>{calculateSelectedTotal().toLocaleString()} 원</span></div>
            <button onClick={handlePreSave} disabled={selectedInventories.size === 0} className={styles.saveBtn}>🚀 청구서 확정 및 저장</button>
          </div>
        </div>
      )}
    </div>
  )
}