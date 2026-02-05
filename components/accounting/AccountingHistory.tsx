'use client'

import React, { useState } from 'react'
import styles from '@/app/accounting/accounting.module.css'
import { exportHistoryToExcel } from '@/utils/excelExporter'
import { Settlement, MachineHistory, SettlementDetail } from '@/app/types'

interface Props {
  isHistOpen: boolean
  setIsHistOpen: (open: boolean) => void
  histYear: number
  setHistYear: (year: number) => void
  histMonth: number
  setHistMonth: (month: number) => void
  historyList: Settlement[]
  handleDeleteHistory: (id: string) => void
  monthMachineHistory: MachineHistory[]
  handleDeleteDetail: (settlementId: string, detailId: string, inventoryId: string, amount: number, isReplacement: boolean) => void 
  handleDetailRebill: (settlementId: string, detailId: string, inventoryId: string, isReplacement: boolean, clientId: string) => void
  handleRebillHistory: (id: string) => void
  targetDay: string
  setTargetDay: (day: string) => void
  searchTerm: string
  setSearchTerm: (term: string) => void
  onSearch: () => void
  togglePaymentStatus: (id: string, currentStatus: boolean) => void
  toggleDetailPaymentStatus: (settlementId: string, detailId: string, currentStatus: boolean) => void
  
  handleBatchDeleteHistory: (ids: string[]) => void
  handleBatchRebillHistory: (ids: string[]) => void
}

export default function AccountingHistory({
  isHistOpen, setIsHistOpen, histYear, setHistYear, histMonth, setHistMonth, historyList, 
  handleDeleteHistory, monthMachineHistory, handleDeleteDetail, handleDetailRebill,
  handleRebillHistory,
  targetDay, setTargetDay, searchTerm, setSearchTerm, onSearch, togglePaymentStatus, toggleDetailPaymentStatus,
  handleBatchDeleteHistory, handleBatchRebillHistory
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedSettlementIds, setSelectedSettlementIds] = useState<Set<string>>(new Set());
  const [selectedExportItems, setSelectedExportItems] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => setExpandedId(expandedId === id ? null : id);
  
  const toggleDetailSelection = (detailId: string) => {
    const newSet = new Set(selectedExportItems);
    if (newSet.has(detailId)) newSet.delete(detailId); else newSet.add(detailId);
    setSelectedExportItems(newSet);
  };

  const toggleClientSelection = (hist: Settlement) => {
    const newSettlementSet = new Set(selectedSettlementIds);
    const newDetailSet = new Set(selectedExportItems);
    const detailIds = hist.details?.map(d => d.id) || [];
    
    if (newSettlementSet.has(hist.id)) {
        newSettlementSet.delete(hist.id);
        detailIds.forEach(id => newDetailSet.delete(id));
    } else {
        newSettlementSet.add(hist.id);
        detailIds.forEach(id => newDetailSet.add(id));
    }
    setSelectedSettlementIds(newSettlementSet);
    setSelectedExportItems(newDetailSet);
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSettlementSet = new Set<string>();
    const newDetailSet = new Set<string>();
    
    if (e.target.checked) {
        historyList.forEach(hist => {
            newSettlementSet.add(hist.id);
            hist.details?.forEach(d => newDetailSet.add(d.id));
        });
    }
    setSelectedSettlementIds(newSettlementSet);
    setSelectedExportItems(newDetailSet);
  };

  const isAllSelected = historyList.length > 0 && historyList.every(h => selectedSettlementIds.has(h.id));

  const onBatchRebill = () => {
    handleBatchRebillHistory(Array.from(selectedSettlementIds));
    setSelectedSettlementIds(new Set()); setSelectedExportItems(new Set());
  };
  
  const onBatchDelete = () => {
    handleBatchDeleteHistory(Array.from(selectedSettlementIds));
    setSelectedSettlementIds(new Set()); setSelectedExportItems(new Set());
  };

  const handleExcelDownload = () => {
    if (selectedExportItems.size === 0) { alert('엑셀로 다운로드할 항목을 선택해주세요.'); return; }
    const exportData = historyList.map((hist): Settlement | null => {
      const currentDetails = hist.details || [];
      const selectedDetails = currentDetails.filter((d: SettlementDetail) => selectedExportItems.has(d.id));
      if (selectedDetails.length === 0) return null;
      return { ...hist, details: selectedDetails };
    }).filter((item): item is Settlement => item !== null);
    exportHistoryToExcel(exportData);
  };

  const handlePaymentClick = (e: React.MouseEvent, id: string, currentStatus: boolean | null) => {
    e.stopPropagation(); 
    const safeStatus = currentStatus ?? false;
    if (confirm(!safeStatus ? "입금이 확인되었습니까?" : "입금 완료 상태를 취소하시겠습니까?")) togglePaymentStatus(id, safeStatus);
  };
  const handleDetailPaymentClick = (settlementId: string, detailId: string, currentStatus: boolean | null) => {
    const safeStatus = currentStatus ?? false;
    if (confirm(!safeStatus ? "이 기계의 입금이 확인되었습니까?" : "이 기계의 입금 상태를 취소하시겠습니까?")) toggleDetailPaymentStatus(settlementId, detailId, safeStatus);
  }

  return (
    <div className={styles.section} style={{ marginTop: '30px' }}>
      <div onClick={() => setIsHistOpen(!isHistOpen)} className={styles.header}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>{isHistOpen ? '▼' : '▶'}</span>
          <span>📋 청구 내역 조회 및 관리</span>
        </span>
      </div>
      
      {isHistOpen && (
        <div className={styles.content}>
          <div className={styles.controls}>
            <div className={styles.controlItem}>
              <input type="number" value={histYear} onChange={e => setHistYear(Number(e.target.value))} className={styles.input} style={{ width: '70px', textAlign: 'center' }} />
              <span>년</span>
              <input type="number" value={histMonth} onChange={e => setHistMonth(Number(e.target.value))} className={styles.input} style={{ width: '50px', textAlign: 'center' }} />
              <span>월 조회</span>
            </div>
            <div className={styles.controlItem}>
              <select value={targetDay} onChange={e => setTargetDay(e.target.value)} className={styles.input} style={{ width: '100px' }}>
                <option value="all">전체 납기일</option><option value="말일">말일</option>
                {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (<option key={d} value={String(d)}>{d}일</option>))}
              </select>
            </div>
            <div className={styles.controlItem} style={{ flex: 1 }}>
              <input placeholder="거래처명, 모델명 검색..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={styles.input} style={{ width: '100%' }} />
            </div>
            <button onClick={onSearch} className={styles.saveBtn}>조회</button>
            <button onClick={handleExcelDownload} className={styles.saveBtn} style={{ backgroundColor: '#217346', marginLeft: '8px' }}>📥 엑셀</button>
            
            {selectedSettlementIds.size > 0 && (
              <>
                <button onClick={onBatchRebill} className={styles.saveBtn} style={{ backgroundColor: '#0070f3', marginLeft: '8px' }}>전체 재청구</button>
                <button onClick={onBatchDelete} className={styles.saveBtn} style={{ backgroundColor: '#d93025', marginLeft: '8px' }}>전체 삭제</button>
              </>
            )}
          </div>

          <div className={styles.tableContainer}>
            <table className={styles.table} style={{ tableLayout: 'fixed' }}>
              {/* ✅ 주석 제거됨: Hydration Error 해결 */}
              <colgroup>
                <col style={{ width: '50px' }} />
                <col style={{ width: '30%' }} />
                <col style={{ width: '80px' }} />
                <col style={{ width: '220px' }} />
                <col style={{ width: '90px' }} />
                <col style={{ width: '140px' }} />
              </colgroup>
              <thead>
                <tr>
                  <th className={styles.th}>
                    <input type="checkbox" checked={isAllSelected} onChange={handleSelectAll} style={{ cursor: 'pointer', transform: 'scale(1.2)' }} />
                  </th>
                  {['거래처명', '기기수', '청구 금액 (VAT포함)', '입금상태', '관리'].map((title, idx) => (
                    <th key={idx + 1} className={styles.th}>
                      {title}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {historyList.length === 0 ? (
                  <tr><td colSpan={6} className={styles.td} style={{ color: 'var(--notion-sub-text)', padding: '40px' }}>조회된 내역이 없습니다.</td></tr>
                ) : historyList.map(hist => {
                  const supply = hist.total_amount ?? 0;
                  const vat = Math.floor(supply * 0.1);
                  const total = supply + vat;

                  return (
                    <React.Fragment key={hist.id}>
                      <tr 
                        onClick={() => toggleExpand(hist.id)} 
                        style={{ 
                          cursor: 'pointer', 
                          backgroundColor: expandedId === hist.id ? 'var(--notion-soft-bg)' : '#fafafa',
                          borderBottom: '1px solid #e0e0e0' 
                        }}
                      >
                        <td className={styles.td} onClick={(e) => e.stopPropagation()} style={{ backgroundColor: 'inherit' }}>
                          <input type="checkbox" checked={selectedSettlementIds.has(hist.id)} onChange={() => toggleClientSelection(hist)} style={{ cursor: 'pointer', transform: 'scale(1.2)' }} />
                        </td>
                        <td className={styles.td} style={{ textAlign: 'left', padding: '12px 16px', fontWeight: '600', color: '#171717', backgroundColor: 'inherit' }}>
                          <span style={{ marginRight: '8px', fontSize:'0.7rem', color:'#888' }}>{expandedId === hist.id ? '▼' : '▶'}</span>
                          {hist.client?.name || '(거래처 미상)'}
                        </td>
                        <td className={styles.td} style={{ padding: '12px', fontSize: '0.9rem', backgroundColor: 'inherit' }}>{hist.details?.length || 0}대</td>
                        
                        <td className={styles.td} style={{ padding: '8px 16px', backgroundColor: 'inherit' }}>
                          <div style={{ color: '#0070f3', fontWeight: '700', fontSize: '0.95rem' }}>
                            {total.toLocaleString()}원
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '2px' }}>
                            (공급 {supply.toLocaleString()} / 세액 {vat.toLocaleString()})
                          </div>
                        </td>
                        
                        <td className={styles.td} style={{ padding: '8px', backgroundColor: 'inherit' }}>
                          <span onClick={(e) => handlePaymentClick(e, hist.id, hist.is_paid)} style={{ fontSize: '0.75rem', padding: '4px 8px', borderRadius: '4px', backgroundColor: hist.is_paid ? '#dbeddb' : '#ffe2dd', color: hist.is_paid ? '#2eaadc' : '#d93025', cursor: 'pointer', fontWeight: '600' }}>{hist.is_paid ? '입금완료' : '미입금'}</span>
                        </td>
                        <td className={styles.td} style={{ padding: '8px', backgroundColor: 'inherit' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                            <button onClick={(e) => { e.stopPropagation(); handleRebillHistory(hist.id); }} style={{ color: 'var(--notion-blue)', border: '1px solid #d3e5ef', background: 'white', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem' }}>전체 재청구</button>
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteHistory(hist.id); }} style={{ color: '#d93025', border: '1px solid #ffe2dd', background: 'white', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem' }}>전체 삭제</button>
                          </div>
                        </td>
                      </tr>
                      
                      {expandedId === hist.id && (
                        <tr>
                          <td colSpan={6} style={{ padding: '0', backgroundColor: '#fff' }}>
                            <div style={{ borderTop: '1px solid var(--notion-border)', borderBottom: '1px solid var(--notion-border)' }}>
                              <table className={styles.table} style={{ tableLayout: 'fixed', backgroundColor: '#fff' }}>
                                {/* ✅ 주석 제거됨: Hydration Error 해결 */}
                                <colgroup>
                                  <col style={{ width: '50px' }} />
                                  <col style={{ width: '25%' }} />
                                  <col style={{ width: '80px' }} />
                                  <col style={{ width: '15%' }} />
                                  <col style={{ width: '15%' }} />
                                  <col style={{ width: '15%' }} />
                                  <col style={{ width: '90px' }} />
                                  <col style={{ width: '140px' }} />
                                </colgroup>
                                <thead>
                                  <tr>
                                    <th className={styles.th} style={{backgroundColor: '#f1f1f1'}}>선택</th>
                                    <th className={styles.th} style={{backgroundColor: '#f1f1f1'}}>기계 모델 (S/N)</th>
                                    <th className={styles.th} style={{backgroundColor: '#f1f1f1'}}>구분</th>
                                    <th className={styles.th} style={{backgroundColor: '#f1f1f1'}}>전월 / 당월</th>
                                    <th className={styles.th} style={{backgroundColor: '#f1f1f1'}}>실사용량</th>
                                    <th className={styles.th} style={{backgroundColor: '#f1f1f1'}}>상세 금액 (VAT포함)</th>
                                    <th className={styles.th} style={{backgroundColor: '#f1f1f1'}}>입금</th>
                                    <th className={styles.th} style={{backgroundColor: '#f1f1f1'}}>관리</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {hist.details?.map((detail: SettlementDetail) => {
                                    let badgeLabel = detail.inventory?.status || '설치';
                                    let badgeStyle = { backgroundColor: '#f1f1f0', color: '#37352f' };
                                    let isComplexCase = false;
                                    if (detail.inventory?.status === '교체전(철수)') { badgeLabel = "교체(철수)"; badgeStyle = { backgroundColor: '#ffe2dd', color: '#d93025' }; isComplexCase = true; }
                                    
                                    const rowSupply = detail.calculated_amount ?? 0;
                                    const rowVat = Math.floor(rowSupply * 0.1);
                                    const rowTotal = rowSupply + rowVat;

                                    return (
                                      <tr key={detail.id} style={{ borderBottom: '1px solid #eee' }}>
                                        <td className={styles.td} style={{ verticalAlign: 'middle' }}>
                                          <input type="checkbox" checked={selectedExportItems.has(detail.id)} onChange={() => toggleDetailSelection(detail.id)} style={{ cursor: 'pointer' }} />
                                        </td>
                                        <td className={styles.td} style={{ textAlign: 'left', padding: '8px 12px', verticalAlign: 'middle' }}>
                                          <div style={{ marginBottom: '2px' }}><span style={{ ...badgeStyle, fontSize: '0.65rem', padding: '2px 4px', borderRadius: '3px', fontWeight: '500' }}>{badgeLabel}</span></div>
                                          <div style={{ fontWeight: '600', fontSize:'0.9rem', marginBottom: '2px' }}>{detail.inventory?.model_name}</div>
                                          <div style={{ fontSize: '0.75rem', color: '#999' }}>{detail.inventory?.serial_number}</div>
                                        </td>
                                        
                                        <td className={styles.td} style={{ padding: '0', fontSize:'0.8rem' }}>
                                            <div style={{ padding:'4px', borderBottom:'1px solid #eee', color:'#666' }}>흑백</div>
                                            <div style={{ padding:'4px', borderBottom:'1px solid #eee', color:'#0070f3' }}>칼라</div>
                                            <div style={{ padding:'4px', borderBottom:'1px solid #eee', color:'#666' }}>흑(A3)</div>
                                            <div style={{ padding:'4px', color:'#0070f3' }}>칼(A3)</div>
                                        </td>

                                        <td className={styles.td} style={{ padding: '0', fontSize:'0.8rem' }}>
                                            <div style={{ padding:'4px', borderBottom:'1px solid #eee' }}>{detail.prev_count_bw?.toLocaleString()} / <b>{detail.curr_count_bw?.toLocaleString()}</b></div>
                                            <div style={{ padding:'4px', borderBottom:'1px solid #eee' }}>{detail.prev_count_col?.toLocaleString()} / <b>{detail.curr_count_col?.toLocaleString()}</b></div>
                                            <div style={{ padding:'4px', borderBottom:'1px solid #eee' }}>{detail.prev_count_bw_a3?.toLocaleString()} / <b>{detail.curr_count_bw_a3?.toLocaleString()}</b></div>
                                            <div style={{ padding:'4px' }}>{detail.prev_count_col_a3?.toLocaleString()} / <b>{detail.curr_count_col_a3?.toLocaleString()}</b></div>
                                        </td>

                                        <td className={styles.td} style={{ padding: '8px 12px', textAlign: 'left', fontSize: '0.8rem', lineHeight: '1.6', verticalAlign: 'middle' }}>
                                          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}><span>흑백:</span> <b>{(detail.usage_bw ?? 0).toLocaleString()}</b></div>
                                          <div style={{ display:'flex', justifyContent:'space-between', color: '#0070f3' }}><span>칼라:</span> <b>{(detail.usage_col ?? 0).toLocaleString()}</b></div>
                                        </td>
                                        
                                        <td className={styles.td} style={{ padding: '8px 12px', verticalAlign: 'middle', textAlign: 'right' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                <div style={{ fontSize: '0.75rem', color: '#666', display: 'flex', justifyContent: 'space-between' }}>
                                                    <span>공급</span> <span>{rowSupply.toLocaleString()}</span>
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: '#666', display: 'flex', justifyContent: 'space-between' }}>
                                                    <span>VAT</span> <span>{rowVat.toLocaleString()}</span>
                                                </div>
                                                <div style={{ borderTop: '1px solid #eee', paddingTop: '2px', marginTop: '2px', display: 'flex', justifyContent: 'space-between', color: '#333', fontWeight: 'bold' }}>
                                                    <span style={{ fontSize: '0.75rem' }}>합계</span> <span style={{fontSize:'0.9rem'}}>{rowTotal.toLocaleString()}</span>
                                                </div>
                                            </div>
                                        </td>

                                        <td className={styles.td} style={{ padding: '8px', verticalAlign: 'middle' }}>
                                          <span onClick={() => handleDetailPaymentClick(hist.id, detail.id, detail.is_paid)} style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: detail.is_paid ? '#dbeddb' : '#ffe2dd', color: detail.is_paid ? '#2eaadc' : '#d93025', cursor: 'pointer' }}>{detail.is_paid ? '완료' : '미납'}</span>
                                        </td>
                                        <td className={styles.td} style={{ padding: '8px', verticalAlign: 'middle' }}>
                                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                            <button onClick={() => handleDetailRebill(hist.id, detail.id, detail.inventory_id ?? '', false, hist.client?.id ?? '')} style={{ color: 'var(--notion-blue)', border: '1px solid #d3e5ef', background: 'white', cursor: 'pointer', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem' }}>재청구</button>
                                            {isComplexCase && <button onClick={() => handleDeleteDetail(hist.id, detail.id, detail.inventory_id ?? '', detail.calculated_amount ?? 0, false)} style={{ backgroundColor: '#fff', border: '1px solid #ffe2dd', color: '#d93025', cursor: 'pointer', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem' }}>삭제</button>}
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                              {hist.memo && <div style={{ marginTop: '0', padding: '10px 16px', borderTop: '1px solid #eee', fontSize: '0.8rem', color: '#666', backgroundColor: '#fafafa' }}>📌 비고: {hist.memo}</div>}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}