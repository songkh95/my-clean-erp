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

  // 계약일 검증 헬퍼 함수
  const isContractActive = (asset: CalculatedAsset | Inventory) => {
    // @ts-ignore
    const contractDateStr = asset.contract_start_date || asset.inv?.contract_start_date;
    if (!contractDateStr) return true;

    const contractDate = new Date(contractDateStr);
    // 비교: (입력 년 * 12 + 입력 월) < (계약 년 * 12 + 계약 월)
    // 해당 월의 1일 기준으로 비교 (계약 시작월부터 표시)
    const targetTotalMonth = regYear * 12 + (regMonth - 1);
    const contractTotalMonth = contractDate.getFullYear() * 12 + contractDate.getMonth();
    
    return targetTotalMonth >= contractTotalMonth;
  };

  // 화면에 표시될 ID 목록 (계약일 이전 기계 제외)
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
        if (selectedInventories.has(d.inventory_id) && isContractActive(d) && d.isGroupLeader) {
          sum += d.rowCost.total;
        }
      });
    });
    return sum;
  };

  const totalSupplyValue = calculateVisibleTotal();
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
              <label htmlFor="unreg" style={{ fontSize: '0.85rem', cursor: 'pointer', color: 'var(--notion-sub-text)' }}>미등록만 보기</label>
            </div>
            <button onClick={onSearch} className={styles.saveBtn}>조회</button>
          </div>

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
                  <th className={styles.th} style={{ width: '160px' }}>실사용 (분배됨)</th>
                  <th className={styles.th} style={{ width: '130px' }}>기계별 금액</th>
                  <th className={styles.th} style={{ width: '150px' }}>총 청구 합계</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} className={styles.td} style={{ padding: '60px' }}>데이터 로딩 중...</td></tr>
                ) : filteredClients.length === 0 ? (
                  <tr><td colSpan={9} style={{ padding: '60px', textAlign: 'center' }}>데이터가 없습니다.</td></tr>
                ) : filteredClients.map(client => {
                  const billData = calculateClientBill(client);
                  
                  // ✅ [수정] 계약일 이전 기계 필터링
                  const validDetails = billData.details.filter(d => isContractActive(d));
                  
                  // 필터링 후 표시할 기계가 없으면 거래처 행 자체를 숨김
                  if (validDetails.length === 0) return null;

                  // ✅ [수정] 필터링된 기계 기준으로 그룹핑 정보(rowSpan, isGroupLeader) 재계산
                  // (그룹 멤버 중 일부가 숨겨졌을 때 테이블 깨짐 방지)
                  const groupCounts: {[key: string]: number} = {};
                  validDetails.forEach(d => {
                    if (d.billing_group_id) {
                      groupCounts[d.billing_group_id] = (groupCounts[d.billing_group_id] || 0) + 1;
                    }
                  });

                  const processedDetails = validDetails.map((d, idx, arr) => {
                    if (!d.billing_group_id) return d; // 단독 기계는 그대로
                    
                    // 현재 보이는 리스트 내에서 해당 그룹의 첫 번째 아이템인지 확인
                    const firstIdx = arr.findIndex(x => x.billing_group_id === d.billing_group_id);
                    const isLeader = firstIdx === idx;
                    
                    return {
                      ...d,
                      isGroupLeader: isLeader,
                      groupSpan: isLeader ? groupCounts[d.billing_group_id] : 0
                    };
                  });

                  // ✅ [수정] 필터링된 기계 기준으로 합계 재계산
                  const clientSupply = processedDetails.reduce((sum, d) => sum + (d.isGroupLeader ? d.rowCost.total : 0), 0);
                  const clientVat = Math.floor(clientSupply * 0.1);
                  const clientTotal = clientSupply + clientVat;
                  
                  const rowSpan = processedDetails.length;

                  return processedDetails.map((calc, idx) => {
                    const isItemSelected = selectedInventories.has(calc.inventory_id);
                    const isWithdrawn = calc.is_replacement_before || calc.is_withdrawal; 
                    const showExcludeBtn = calc.is_replacement_before || calc.is_withdrawal;

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
                          </td>
                        )}

                        <td className={styles.td} style={{ textAlign: 'left', padding: '12px' }}>
                           <div style={{ marginBottom: '6px', display:'flex', gap:'4px' }}>
                             <span className={styles.badge} style={badgeStyle}>{badgeLabel}</span>
                             {calc.billing_group_id && <span className={styles.badge} style={{ backgroundColor: '#f9f0ff', color: '#9065b0' }}>🔗 합산</span>}
                           </div>
                           <div style={{ fontWeight: '600' }}>{calc.model_name}</div>
                           <div style={{ fontSize: '0.75rem', color: '#999' }}>{calc.serial_number}</div>
                           {showExcludeBtn && <button onClick={(e) => { e.stopPropagation(); handleExcludeAsset(calc); }} style={{ marginTop: '6px', fontSize: '0.7rem' }}>🚫 제외</button>}
                        </td>

                        <td className={styles.td}>
                          <div className={styles.splitCellContainer}>
                            <div className={styles.rowGray}>흑백</div><div className={styles.rowBlue}>칼라</div><div className={styles.rowGray}>흑A3</div><div className={`${styles.rowBlue} ${styles.rowLast}`}>칼A3</div>
                          </div>
                        </td>

                        <td className={styles.td}>
                          <div className={styles.splitCellContainer}>
                            <div className={styles.rowGray}>{calc.prev?.bw ?? 0}</div><div className={styles.rowBlue}>{calc.prev?.col ?? 0}</div><div className={styles.rowGray}>{calc.prev?.bw_a3 ?? 0}</div><div className={`${styles.rowBlue} ${styles.rowLast}`}>{calc.prev?.col_a3 ?? 0}</div>
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
                        
                        {/* 실사용량 컬럼: 그룹합산 / 단독 기계 분기 처리 */}
                        {shouldRenderUsageCell && (
                          <td className={styles.td} rowSpan={calc.isGroupLeader ? calc.groupSpan : 1} style={{ padding: '12px', textAlign: 'left', verticalAlign: 'top', backgroundColor: calc.billing_group_id ? '#fbfbff' : 'inherit' }}>
                            {calc.billing_group_id && calc.groupUsageBreakdown ? (
                              // 그룹 합산 표시
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
                              // 단독 기계
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

                        {/* 기계별 금액 컬럼 */}
                        <td className={styles.td} style={{ padding: '12px', textAlign: 'right', verticalAlign: 'bottom' }}>
                          <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '8px' }}>
                            <div>기본: {(calc.rowCost?.basic ?? 0).toLocaleString()}</div>
                            <div>추가: {(calc.rowCost?.extra ?? 0).toLocaleString()}</div>
                          </div>
                          <div style={{ fontWeight: 'bold', fontSize:'0.9rem', borderTop:'1px solid #eee', paddingTop:'6px' }}>
                            {(calc.rowCost?.total ?? 0).toLocaleString()}원
                          </div>
                        </td>

                        {/* 거래처 총계 */}
                        {idx === 0 && (
                          <td className={styles.td} rowSpan={rowSpan} style={{ padding: '16px 12px', backgroundColor: '#fff', verticalAlign: 'bottom', textAlign: 'right' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#666' }}><span>공급</span> <span>{clientSupply.toLocaleString()}</span></div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#666' }}><span>VAT</span> <span>{clientVat.toLocaleString()}</span></div>
                              <div style={{ borderTop: '1px solid #ddd', marginTop: '6px', paddingTop: '6px', display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: '0.9rem', color: '#0070f3', fontWeight: 'bold' }}>합계</span>
                                <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#d93025' }}>{clientTotal.toLocaleString()}</span>
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
      )}
    </div>
  )
}