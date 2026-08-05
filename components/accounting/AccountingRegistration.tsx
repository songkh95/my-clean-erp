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
import { calcVat, calcGrandTotal } from '@/utils/billingAmounts'

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
  prevSourceMap?: { [key: string]: 'settlement' | 'initial' }
  selectedInventories: Set<string>
  handleInputChange: (invId: string, field: keyof CounterData, value: string) => void
  toggleInventorySelection: (invId: string) => void
  setSelectedInventoriesBulk: (ids: string[], action: 'add' | 'remove') => void
  calculateClientBill: (client: Client) => BillCalculationResult
  calculateSelectedTotal: (targetClients?: Client[]) => number
  handlePreSave: () => void
  onSearch: () => void
}

export default function AccountingRegistration({
  isRegOpen, setIsRegOpen, regYear, setRegYear, regMonth, setRegMonth,
  targetDay, setTargetDay, searchTerm, setSearchTerm, showUnregistered, setShowUnregistered,
  loading, filteredClients, inventoryMap, inputData, prevData, prevSourceMap = {}, selectedInventories,
  handleInputChange, toggleInventorySelection, setSelectedInventoriesBulk, 
  calculateClientBill, calculateSelectedTotal, handlePreSave, onSearch
}: Props) {

  // 계약일 검증 헬퍼 함수
  const isContractActive = (asset: CalculatedAsset | Inventory) => {
    // @ts-ignore
    const contractDateStr = asset.contract_start_date || asset.inv?.contract_start_date;
    if (!contractDateStr) return true;

    const contractDate = new Date(contractDateStr);
    const targetTotalMonth = regYear * 12 + (regMonth - 1);
    const contractTotalMonth = contractDate.getFullYear() * 12 + contractDate.getMonth();
    
    return targetTotalMonth >= contractTotalMonth;
  };

  // 화면에 표시될 ID 목록
  const currentVisibleIds = useMemo(() => {
    return filteredClients.flatMap(client => {
      const billData = calculateClientBill(client);
      return billData.details
        .filter(d => isContractActive(d))
        .map(d => d.inventory_id);
    });
  }, [filteredClients, calculateClientBill, regYear, regMonth]);

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

  // 선택된 항목의 총합 계산 (화면에 안 보이는 항목 제외)
  const calculateVisibleTotal = () => {
    let sum = 0;
    filteredClients.forEach(client => {
      const billData = calculateClientBill(client);
      billData.details.forEach(d => {
        // 리더 여부 상관없이 선택된 모든 기계의 비용 합산
        if (selectedInventories.has(d.inventory_id) && isContractActive(d)) {
          sum += d.rowCost.total;
        }
      });
    });
    return sum;
  };

  const totalSupplyValue = calculateVisibleTotal();
  const totalVat = calcVat(totalSupplyValue);
  const grandTotal = calcGrandTotal(totalSupplyValue); 

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

      {/* ✅ [수정] 아코디언 기능 삭제 (onClick 제거, 화살표 제거, cursor: default 적용) */}
      <div className={styles.header} style={{ cursor: 'default' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            사용매수·청구 ({regYear}.{regMonth})
          </span>
        </span>
      </div>

      {/* ✅ [수정] 조건부 렌더링 삭제 (항상 표시) */}
      <div className={styles.content}>
        <div className={styles.controls}>
          {/* 상단 컨트롤 영역 */}
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
            <label htmlFor="unreg" style={{ fontSize: '0.85rem', cursor: 'pointer', color: 'var(--notion-sub-text)' }} title="해당 월에 한 대도 정산되지 않은 거래처만">미등록만 보기</label>
          </div>
          <button onClick={onSearch} className={styles.saveBtn}>조회</button>
        </div>

        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th} style={{ width: '3%' }}><input type="checkbox" checked={isAllSelected} onChange={handleToggleAll} /></th>
                <th className={styles.th} style={{ width: '11%' }}>거래처</th>
                <th className={styles.th} style={{ width: '15%' }}>기계 (모델/S.N)</th>
                <th className={styles.th} style={{ width: '5%' }}>구분</th>
                <th className={styles.th} style={{ width: '8%' }}>전월</th>
                <th className={styles.th} style={{ width: '8%' }}>당월(입력)</th>
                <th className={styles.th} style={{ width: '16%' }}>실사용 (분배됨)</th>
                <th className={styles.th} style={{ width: '14%' }}>기계별 금액</th>
                <th className={styles.th} style={{ width: '20%' }}>총 청구 합계</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className={styles.td} style={{ padding: '24px' }}>데이터 로딩 중...</td></tr>
              ) : filteredClients.length === 0 ? (
                <tr><td colSpan={9} style={{ padding: '24px', textAlign: 'center' }}>데이터가 없습니다.</td></tr>
              ) : filteredClients.map(client => {
                const billData = calculateClientBill(client);
                
                const validDetails = billData.details.filter(d => isContractActive(d));
                if (validDetails.length === 0) return null;

                const groupCounts: {[key: string]: number} = {};
                validDetails.forEach(d => {
                  if (d.billing_group_id) {
                    groupCounts[d.billing_group_id] = (groupCounts[d.billing_group_id] || 0) + 1;
                  }
                });

                const processedDetails = validDetails.map((d, idx, arr) => {
                  if (!d.billing_group_id) return d;
                  
                  const firstIdx = arr.findIndex(x => x.billing_group_id === d.billing_group_id);
                  const isLeader = firstIdx === idx;
                  
                  return {
                    ...d,
                    isGroupLeader: isLeader,
                    groupSpan: isLeader ? groupCounts[d.billing_group_id] : 0
                  };
                });

                const clientSupply = processedDetails.reduce((sum, d) => sum + d.rowCost.total, 0);
                const clientVat = calcVat(clientSupply);
                const clientGrandTotal = calcGrandTotal(clientSupply);
                
                const rowSpan = processedDetails.length;

                return processedDetails.map((calc, idx) => {
                  const isItemSelected = selectedInventories.has(calc.inventory_id);
                  const isWithdrawn = calc.is_replacement_before || calc.is_withdrawal; 

                  let badgeLabel = calc.status;
                  let badgeStyle = { backgroundColor: '#f1f1f0', color: '#37352f' };
                  if (calc.is_replacement_before) { badgeLabel = "교체(철수)"; badgeStyle = { backgroundColor: '#ffe2dd', color: '#d93025' }; }
                  else if (calc.status === '설치') { badgeLabel = "설치"; badgeStyle = { backgroundColor: '#dbeddb', color: '#2eaadc' }; }

                  const shouldRenderUsageCell = calc.isGroupLeader || !calc.billing_group_id;

                  return (
                    <tr key={calc.inventory_id} style={{ 
                      backgroundColor: isWithdrawn ? '#fff9f9' : (isItemSelected ? 'var(--notion-blue-light)' : 'transparent')
                    }}>
                      <td className={styles.td}>
                        <input 
                          type="checkbox" 
                          checked={isItemSelected} 
                          onChange={() => toggleInventorySelection(calc.inventory_id)} 
                        />
                      </td>

                      {idx === 0 && (
                        <td className={styles.clientInfoCell} rowSpan={rowSpan}>
                          <div className={styles.clientName}>{client.name}</div>
                          <div className={styles.clientMeta}>청구일: {calc.billing_date}</div>
                        </td>
                      )}

                      <td className={styles.td} style={{ textAlign: 'left', padding: '8px' }}>
                         <div style={{ marginBottom: '6px', display:'flex', gap:'4px' }}>
                           <span className={styles.badge} style={badgeStyle}>{badgeLabel}</span>
                           {calc.billing_group_id && <span className={styles.badge} style={{ backgroundColor: '#f9f0ff', color: '#9065b0' }}>🔗 합산</span>}
                         </div>
                         <div style={{ fontWeight: '600' }}>{calc.model_name}</div>
                         <div style={{ fontSize: '0.75rem', color: '#999' }}>{calc.serial_number}</div>
                      </td>

                      <td className={styles.td}>
                        <div className={styles.splitCellContainer}>
                          <div className={styles.rowGray}>흑백</div><div className={styles.rowBlue}>칼라</div><div className={styles.rowGray}>흑A3</div><div className={`${styles.rowBlue} ${styles.rowLast}`}>칼A3</div>
                        </div>
                      </td>

                      <td className={styles.td} title={prevSourceMap[calc.inventory_id] === 'initial' ? '전월 정산 없음 → 설치 초기 카운터 사용' : '전월 정산 당월 지침'}>
                        <div className={styles.splitCellContainer}>
                          <div className={styles.rowGray} style={prevSourceMap[calc.inventory_id] === 'initial' ? { color: '#b45309' } : undefined}>{calc.prev?.bw ?? 0}</div>
                          <div className={styles.rowBlue} style={prevSourceMap[calc.inventory_id] === 'initial' ? { color: '#b45309' } : undefined}>{calc.prev?.col ?? 0}</div>
                          <div className={styles.rowGray} style={prevSourceMap[calc.inventory_id] === 'initial' ? { color: '#b45309' } : undefined}>{calc.prev?.bw_a3 ?? 0}</div>
                          <div className={`${styles.rowBlue} ${styles.rowLast}`} style={prevSourceMap[calc.inventory_id] === 'initial' ? { color: '#b45309' } : undefined}>{calc.prev?.col_a3 ?? 0}</div>
                        </div>
                      </td>

                      <td className={styles.td}>
                        <div className={styles.splitCellContainer}>
                          <div className={styles.rowGray}><input type="number" className={styles.numberInput} value={inputData[calc.inventory_id]?.bw ?? ''} onChange={e => onNumberChange(calc.inventory_id, 'bw', e.target.value)} /></div>
                          <div className={styles.rowBlue}><input type="number" className={styles.numberInput} value={inputData[calc.inventory_id]?.col ?? ''} onChange={e => onNumberChange(calc.inventory_id, 'col', e.target.value)} /></div>
                          <div className={styles.rowGray}><input type="number" className={styles.numberInput} value={inputData[calc.inventory_id]?.bw_a3 ?? ''} onChange={e => onNumberChange(calc.inventory_id, 'bw_a3', e.target.value)} /></div>
                          <div className={`${styles.rowBlue} ${styles.rowLast}`}><input type="number" className={styles.numberInput} value={inputData[calc.inventory_id]?.col_a3 ?? ''} onChange={e => onNumberChange(calc.inventory_id, 'col_a3', e.target.value)} /></div>
                        </div>
                      </td>
                      
                      {shouldRenderUsageCell && (
                        <td className={styles.td} rowSpan={calc.isGroupLeader ? calc.groupSpan : 1} style={{ padding: '8px', textAlign: 'left', verticalAlign: 'top', backgroundColor: calc.billing_group_id ? '#fbfbff' : 'inherit' }}>
                          {calc.billing_group_id && calc.groupUsageBreakdown ? (
                            <>
                              <div style={{ fontSize:'0.85rem', fontWeight: '700', color: '#0070f3', marginBottom: '6px', textAlign:'center', borderBottom:'1px dashed #e0e0e0', paddingBottom:'4px' }}>
                                합산 기본 매수 ({calc.groupUsageBreakdown.poolBasicBW.toLocaleString()}/{calc.groupUsageBreakdown.poolBasicCol.toLocaleString()})
                              </div>
                              <div style={{ fontSize:'0.75rem', color: '#555', marginBottom:'2px', fontWeight:'600' }}>기본 매수</div>
                              <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.75rem', color: '#666', marginBottom:'2px' }}><span>흑백:</span> <b>{calc.groupUsageBreakdown.basicBW.toLocaleString()}</b></div>
                              <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.75rem', color: '#0070f3', marginBottom:'4px' }}><span>칼라:</span> <b>{calc.groupUsageBreakdown.basicCol.toLocaleString()}</b></div>
                              <div style={{ borderTop: '1px solid #eee', margin: '4px 0' }}></div>
                              <div style={{ fontSize:'0.75rem', color: '#d93025', marginBottom:'2px', fontWeight:'600' }}>추가 매수</div>
                              <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.75rem', color: '#d93025', marginBottom:'2px' }}><span>흑백:</span> <b>{calc.groupUsageBreakdown.extraBW.toLocaleString()}</b></div>
                              <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.75rem', color: '#d93025' }}><span>칼라:</span> <b>{calc.groupUsageBreakdown.extraCol.toLocaleString()}</b></div>
                            </>
                          ) : (
                            <>
                              <div style={{ fontWeight: '600', color: '#555', marginBottom: '2px' }}>기본 매수</div>
                              <div style={{ display:'flex', justifyContent:'space-between', color: '#666', marginBottom:'2px' }}><span>흑백:</span> <span>{calc.usageBreakdown.basicBW.toLocaleString()}</span></div>
                              <div style={{ display:'flex', justifyContent:'space-between', color: '#0070f3', marginBottom:'4px' }}><span>칼라:</span> <span>{calc.usageBreakdown.basicCol.toLocaleString()}</span></div>
                              {(calc.usageBreakdown.extraBW > 0 || calc.usageBreakdown.extraCol > 0) && (
                                <>
                                  <div style={{ borderTop: '1px solid #eee', margin: '4px 0' }}></div>
                                  <div style={{ fontWeight: '600', color: '#d93025', marginBottom: '2px' }}>추가 매수</div>
                                  <div style={{ display:'flex', justifyContent:'space-between', color: '#d93025', marginBottom:'2px' }}><span>흑백:</span> <span>{calc.usageBreakdown.extraBW.toLocaleString()}</span></div>
                                  <div style={{ display:'flex', justifyContent:'space-between', color: '#d93025' }}><span>칼라:</span> <span>{calc.usageBreakdown.extraCol.toLocaleString()}</span></div>
                                </>
                              )}
                            </>
                          )}
                        </td>
                      )}

                      <td className={styles.td} style={{ textAlign: 'right', verticalAlign: 'bottom', padding:'8px' }}>
                        <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '8px' }}>
                          <div>기본: {(calc.rowCost?.basic ?? 0).toLocaleString()}</div>
                          <div>추가: {(calc.rowCost?.extra ?? 0).toLocaleString()}</div>
                        </div>
                        <div style={{ fontWeight: 'bold', fontSize:'0.9rem', borderTop:'1px solid #eee', paddingTop:'6px' }}>
                          {(calc.rowCost?.total ?? 0).toLocaleString()}원
                        </div>
                      </td>

                      {idx === 0 && (
                        <td className={styles.td} rowSpan={rowSpan} style={{ padding: '8px', backgroundColor: '#fff', verticalAlign: 'bottom', textAlign: 'right' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#666' }}><span>공급</span> <span>{clientSupply.toLocaleString()}</span></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#666' }}><span>VAT</span> <span>{clientVat.toLocaleString()}</span></div>
                            <div style={{ borderTop: '1px solid #ddd', marginTop: '6px', paddingTop: '6px', display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: '0.9rem', color: '#0070f3', fontWeight: 'bold' }}>합계</span>
                              <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#d93025' }}>{clientGrandTotal.toLocaleString()}</span>
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
            공급가: <b>{totalSupplyValue.toLocaleString()}</b>원 (+VAT {totalVat.toLocaleString()}) = 
            <span className={styles.totalAmount}>{grandTotal.toLocaleString()} 원</span>
          </div>
          <button onClick={handlePreSave} disabled={selectedInventories.size === 0} className={styles.saveBtn}>🚀 청구서 확정 및 저장</button>
        </div>
      </div>
    </div>
  )
}