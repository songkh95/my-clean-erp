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

  // 숫자만 입력 허용 및 마이너스/문자 차단 핸들러
  const onNumberKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (['-', '+', 'e', 'E'].includes(e.key)) {
      e.preventDefault();
    }
  };

  const onNumberChange = (invId: string, field: string, value: string) => {
    const cleanValue = value.replace(/[^0-9]/g, '');
    handleInputChange(invId, field, cleanValue);
  };

  return (
    <div className={styles.section}>
      {/* 화살표 제거를 위한 인라인 스타일 */}
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
              <button 
                onClick={onSearch} 
                className={styles.saveBtn} 
                style={{ padding: '8px 16px', height: 'auto', backgroundColor: '#0070f3' }}
              >
                🔍 조회
              </button>
            </div>
          </div>

          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th} style={{ width: '40px' }}>
                    <input type="checkbox" checked={isAllSelected} onChange={handleToggleAll} />
                  </th>
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
                {loading && filteredClients.length === 0 ? (
                  <tr><td colSpan={9} className={styles.td}>데이터 로딩 중...</td></tr>
                ) : filteredClients.map(client => {
                  const billData = calculateClientBill(client)
                  const rowSpan = billData.details.length
                  if (rowSpan === 0) return null

                  return billData.details.map((calc: any, idx: number) => {
                    const isItemSelected = selectedInventories.has(calc.inventory_id)
                    const isLastRow = idx === rowSpan - 1
                    const hasExtra = (calc.usageBreakdown.extraBW + calc.usageBreakdown.extraCol) > 0;
                    
                    return (
                      <tr key={calc.inventory_id} style={{
                        backgroundColor: isItemSelected ? 'rgba(0, 112, 243, 0.05)' : 'transparent',
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
                           <div style={{ fontWeight: 'bold' }}>{calc.model_name}</div>
                           <div style={{ fontSize: '0.75rem', color: '#999' }}>{calc.serial_number}</div>
                        </td>
                        <td className={styles.td} style={{ padding: 0 }}>
                          <div className={styles.splitCellContainer}>
                            <div className={styles.rowGray}>흑A4</div><div className={styles.rowBlue}>칼A4</div>
                            <div className={styles.rowGray}>흑A3</div><div className={`${styles.rowBlue} ${styles.rowLast}`}>칼A3</div>
                          </div>
                        </td>
                        <td className={styles.td} style={{ padding: 0, backgroundColor: '#f9f9f9' }}>
                          <div className={styles.splitCellContainer}>
                            <div className={styles.rowGray}>{calc.prev.bw}</div><div className={styles.rowBlue}>{calc.prev.col}</div>
                            <div className={styles.rowGray}>{calc.prev.bw_a3}</div><div className={`${styles.rowBlue} ${styles.rowLast}`}>{calc.prev.col_a3}</div>
                          </div>
                        </td>
                        <td className={styles.td} style={{ padding: 0, backgroundColor: '#eff6ff' }}>
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
                                placeholder="당월 칼라 A4"
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
                                placeholder="당월 칼라 A3"
                                value={inputData[calc.inventory_id]?.col_a3 ?? ''} 
                                onKeyDown={onNumberKeyDown}
                                onChange={e => onNumberChange(calc.inventory_id, 'col_a3', e.target.value)} 
                              />
                            </div>
                          </div>
                        </td>
                        {/* 🔴 실사용량(가중치) 표시 - 추가 매수 색상 수정 */}
                        <td className={styles.td} style={{ textAlign: 'left', fontSize: '0.8rem', lineHeight: '1.4' }}>
                          <div style={{ fontWeight: '600', color: '#555' }}>기본매수</div>
                          <div style={{ paddingLeft: '4px', color: '#555' }}>
                            흑백: {calc.usageBreakdown.basicBW.toLocaleString()}장<br />
                            칼라: {calc.usageBreakdown.basicCol.toLocaleString()}장
                          </div>
                          <div style={{ borderTop: '1px solid #eee', margin: '4px 0' }}></div>
                          <div style={{ fontWeight: '600', color: '#d93025' }}>추가매수</div>
                          <div style={{ paddingLeft: '4px', color: '#d93025' }}>
                            흑백: {calc.usageBreakdown.extraBW.toLocaleString()}장<br />
                            칼라: {calc.usageBreakdown.extraCol.toLocaleString()}장
                          </div>
                        </td>
                        {calc.isGroupLeader ? (
                          <td className={styles.td} rowSpan={calc.groupSpan} style={{ textAlign: 'right', verticalAlign: 'bottom', paddingBottom: '10px' }}>
                            <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '4px' }}>
                              기본금액: {calc.rowCost.basic.toLocaleString()}원<br />
                              추가금액: {calc.rowCost.extra.toLocaleString()}원
                            </div>
                            <div style={{ fontWeight: 'bold', borderTop: '1px solid #eee', paddingTop: '4px', color: '#0070f3' }}>
                              {calc.rowCost.total.toLocaleString()}원
                            </div>
                          </td>
                        ) : (
                          <td className={styles.td} style={{ backgroundColor: '#fafafa', color: '#ccc', fontSize: '0.7rem' }}>
                            합산 그룹원
                          </td>
                        )}
                        {idx === 0 && (
                          <td className={styles.td} rowSpan={rowSpan} style={{ backgroundColor: '#fffdf0', textAlign: 'right', verticalAlign: 'bottom' }}>
                            <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '4px' }}>거래처 총액</div>
                            <div style={{ fontWeight: 'bold', color: '#d93025', fontSize: '1.1rem' }}>
                              {billData.totalAmount.toLocaleString()}원
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
              선택 합계 ({selectedInventories.size}대): 
              <span className={styles.totalAmount}>{calculateSelectedTotal().toLocaleString()} 원</span>
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