'use client'

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import styles from '@/app/accounting/accounting.module.css'
import { exportHistoryToExcel } from '@/utils/excelExporter'

interface Props {
  isHistOpen: boolean
  setIsHistOpen: (open: boolean) => void
  histYear: number
  setHistYear: (year: number) => void
  histMonth: number
  setHistMonth: (month: number) => void
  historyList: any[]
  handleDeleteHistory: (id: string) => void
  monthMachineHistory: any[] 
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
}

export default function AccountingHistory({
  isHistOpen, setIsHistOpen, histYear, setHistYear, histMonth, setHistMonth, historyList, 
  handleDeleteHistory, monthMachineHistory, handleDeleteDetail, handleDetailRebill,
  handleRebillHistory,
  targetDay, setTargetDay, searchTerm, setSearchTerm, onSearch, togglePaymentStatus, toggleDetailPaymentStatus
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ✅ [추가] 엑셀 다운로드용 선택 상태 관리 (detail.id 들을 저장)
  const [selectedExportItems, setSelectedExportItems] = useState<Set<string>>(new Set());

  // ✅ [수정] 컬럼 너비 상태 (맨 앞 '선택' 컬럼 추가: 50px)
  const [colWidths, setColWidths] = useState<number[]>([50, 300, 100, 150, 100, 160]);
  const activeIndex = useRef<number | null>(null); 
  const startX = useRef<number>(0); 
  const startWidth = useRef<number>(0); 

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  // ✅ [추가] 기계(Detail) 개별 체크 핸들러
  const toggleDetailSelection = (detailId: string) => {
    const newSet = new Set(selectedExportItems);
    if (newSet.has(detailId)) newSet.delete(detailId);
    else newSet.add(detailId);
    setSelectedExportItems(newSet);
  };

  // ✅ [추가] 거래처(Client) 전체 체크 핸들러
  const toggleClientSelection = (hist: any) => {
    const newSet = new Set(selectedExportItems);
    const detailIds = hist.details?.map((d: any) => d.id) || [];
    const isAllSelected = detailIds.every((id: string) => newSet.has(id));

    if (isAllSelected) {
      // 이미 다 선택되어 있으면 -> 전체 해제
      detailIds.forEach((id: string) => newSet.delete(id));
    } else {
      // 하나라도 빠져 있으면 -> 전체 선택
      detailIds.forEach((id: string) => newSet.add(id));
    }
    setSelectedExportItems(newSet);
  };

  // ✅ [수정] 엑셀 다운로드 핸들러 (선택된 것만 필터링)
  const handleExcelDownload = () => {
    if (selectedExportItems.size === 0) {
      alert('엑셀로 다운로드할 항목을 선택해주세요.');
      return;
    }

    // 선택된 detail만 포함하도록 데이터 가공
    const exportData = historyList.map(hist => {
      // 이 거래처의 기계들 중, 체크된 것만 필터링
      const selectedDetails = hist.details?.filter((d: any) => selectedExportItems.has(d.id)) || [];
      
      if (selectedDetails.length === 0) return null; // 선택된 기계가 없으면 이 거래처는 제외

      // 필터링된 detail을 포함한 새 객체 반환
      return {
        ...hist,
        details: selectedDetails,
        // (선택사항) total_amount 등도 재계산이 필요할 수 있으나, 
        // 현재 엑셀 로직(excelExporter.ts)은 detail 기준으로 행을 생성하므로 
        // details 배열만 잘 걸러주면 됩니다.
      };
    }).filter(Boolean); // null 제거

    exportHistoryToExcel(exportData);
  };

  // 거래처별 입금 상태 변경 핸들러
  const handlePaymentClick = (e: React.MouseEvent, id: string, currentStatus: boolean) => {
    e.stopPropagation(); 
    const message = !currentStatus 
      ? "입금이 확인되었습니까?\n\n[확인]을 누르면 이 거래처의 모든 기계가 '입금완료' 처리됩니다."
      : "입금 완료 상태를 취소하시겠습니까?\n\n[확인]을 누르면 이 거래처의 모든 기계가 '미입금' 처리됩니다.";

    if (confirm(message)) {
      togglePaymentStatus(id, currentStatus);
    }
  };

  // 기계별 입금 상태 변경 핸들러
  const handleDetailPaymentClick = (settlementId: string, detailId: string, currentStatus: boolean) => {
    const message = !currentStatus 
      ? "이 기계의 입금이 확인되었습니까?"
      : "이 기계의 입금 상태를 취소하시겠습니까?";
      
    if (confirm(message)) {
      toggleDetailPaymentStatus(settlementId, detailId, currentStatus);
    }
  }

  // 드래그 핸들러들
  const handleMouseDown = (index: number, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation(); 
    activeIndex.current = index; startX.current = e.clientX; startWidth.current = colWidths[index];
    document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleMouseMove); document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (activeIndex.current === null) return;
    const deltaX = e.clientX - startX.current;
    const newWidth = Math.max(30, startWidth.current + deltaX); 
    setColWidths(prev => { const next = [...prev]; next[activeIndex.current!] = newWidth; return next; });
  }, []);

  const handleMouseUp = useCallback(() => {
    activeIndex.current = null; document.body.style.cursor = ''; document.body.style.userSelect = '';
    document.removeEventListener('mousemove', handleMouseMove); document.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);

  useEffect(() => {
    return () => { document.removeEventListener('mousemove', handleMouseMove); document.removeEventListener('mouseup', handleMouseUp); };
  }, [handleMouseMove, handleMouseUp]);


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
              <input 
                type="number" 
                value={histYear} 
                onChange={e => setHistYear(Number(e.target.value))} 
                className={styles.input} 
                style={{ width: '70px', textAlign: 'center' }} 
              />
              <span>년</span>
              <input 
                type="number" 
                value={histMonth} 
                onChange={e => setHistMonth(Number(e.target.value))} 
                className={styles.input} 
                style={{ width: '50px', textAlign: 'center' }} 
              />
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
            <button 
              onClick={handleExcelDownload} 
              className={styles.saveBtn} 
              style={{ backgroundColor: '#217346', marginLeft: '8px' }} 
              title="선택된 항목을 엑셀로 다운로드"
            >
              📥 엑셀
            </button>
          </div>

          <div className={styles.tableContainer}>
            <table className={styles.table} style={{ tableLayout: 'fixed' }}>
              <colgroup>{colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
              <thead>
                <tr>
                  {/* ✅ [수정] '선택' 컬럼 추가 */}
                  {['선택', '거래처명', '기기수', '총 청구액', '입금상태', '관리'].map((title, idx) => (
                    <th key={idx} className={styles.th}>
                      {title}
                      <div className={styles.resizer} onMouseDown={(e) => handleMouseDown(idx, e)} onClick={(e) => e.stopPropagation()} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {historyList.length === 0 ? (
                  <tr><td colSpan={6} className={styles.td} style={{ color: 'var(--notion-sub-text)', padding: '40px' }}>조회된 내역이 없습니다.</td></tr>
                ) : historyList.map(hist => {
                  // 거래처 체크박스 상태 계산
                  const detailIds = hist.details?.map((d: any) => d.id) || [];
                  const isAllSelected = detailIds.length > 0 && detailIds.every((id: string) => selectedExportItems.has(id));
                  
                  return (
                    <React.Fragment key={hist.id}>
                      <tr onClick={() => toggleExpand(hist.id)} style={{ cursor: 'pointer', backgroundColor: expandedId === hist.id ? 'var(--notion-soft-bg)' : 'transparent' }}>
                        {/* ✅ [추가] 거래처 체크박스 */}
                        <td className={styles.td} onClick={(e) => e.stopPropagation()}>
                          <input 
                            type="checkbox" 
                            checked={isAllSelected} 
                            onChange={() => toggleClientSelection(hist)} 
                            style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
                          />
                        </td>
                        <td className={styles.td} style={{ textAlign: 'left', padding: '16px 16px 16px 24px', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <span style={{ marginRight: '8px', fontSize:'0.7rem', color:'#aaa' }}>{expandedId === hist.id ? '▼' : '▶'}</span>
                          {hist.client?.name}
                        </td>
                        <td className={styles.td} style={{ padding: '16px' }}>{hist.details?.length || 0}대</td>
                        <td className={styles.td} style={{ padding: '16px', color: 'var(--notion-blue)', fontWeight: '600' }}>{hist.total_amount?.toLocaleString()}원</td>
                        <td className={styles.td} style={{ padding: '16px' }}>
                          <span 
                            onClick={(e) => handlePaymentClick(e, hist.id, hist.is_paid)}
                            style={{ 
                              fontSize: '0.75rem', padding: '4px 8px', borderRadius: '4px', 
                              backgroundColor: hist.is_paid ? '#dbeddb' : '#ffe2dd', 
                              color: hist.is_paid ? '#2eaadc' : '#d93025',
                              cursor: 'pointer', border: '1px solid transparent', transition: 'all 0.2s', userSelect: 'none'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.border = '1px solid currentColor'}
                            onMouseOut={(e) => e.currentTarget.style.border = '1px solid transparent'}
                          >
                            {hist.is_paid ? '입금완료' : '미입금'}
                          </span>
                        </td>
                        <td className={styles.td} style={{ padding: '16px' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                            <button onClick={(e) => { e.stopPropagation(); handleRebillHistory(hist.id); }} style={{ color: 'var(--notion-blue)', border: '1px solid #d3e5ef', background: 'white', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem' }} title="전체 재청구">전체 재청구</button>
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteHistory(hist.id); }} style={{ color: '#d93025', border: '1px solid #ffe2dd', background: 'white', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem' }} title="전체 삭제">전체 삭제</button>
                          </div>
                        </td>
                      </tr>

                      {expandedId === hist.id && (
                        <tr>
                          <td colSpan={6} style={{ padding: '0', backgroundColor: '#fff' }}>
                            <div style={{ borderTop: '1px solid var(--notion-border)', borderBottom: '1px solid var(--notion-border)' }}>
                              <table className={styles.table} style={{ backgroundColor: '#fafafa' }}>
                                <thead>
                                  <tr>
                                    {/* ✅ [추가] 상세 테이블 체크박스 컬럼 */}
                                    <th className={styles.th} style={{ width: '40px' }}>선택</th>
                                    <th className={styles.th} style={{ width: '20%' }}>기계 모델 (S/N)</th>
                                    <th className={styles.th} style={{ width: '60px' }}>구분</th>
                                    <th className={styles.th} style={{ width: '80px' }}>전월</th>
                                    <th className={styles.th} style={{ width: '80px' }}>당월</th>
                                    <th className={styles.th} style={{ width: '120px' }}>실사용량 (가중치)</th>
                                    <th className={styles.th} style={{ width: '100px' }}>청구 금액</th>
                                    <th className={styles.th} style={{ width: '80px' }}>입금</th>
                                    <th className={styles.th} style={{ width: '120px' }}>관리</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {hist.details?.map((detail: any) => {
                                    let badgeLabel = detail.inventory?.status || '설치';
                                    let badgeStyle = { backgroundColor: '#f1f1f0', color: '#37352f' };
                                    let isComplexCase = false;

                                    if (detail.is_replacement_record) {
                                      badgeLabel = "교체(철수)"; badgeStyle = { backgroundColor: '#ffe2dd', color: '#d93025' };
                                      isComplexCase = true;
                                    } else {
                                      const isInstalledThisMonth = monthMachineHistory?.some(mh => mh.inventory_id === detail.inventory_id && mh.action_type === 'INSTALL');
                                      if (isInstalledThisMonth) { 
                                        badgeLabel = "교체(설치)"; 
                                        badgeStyle = { backgroundColor: '#d3e5ef', color: '#0070f3' }; 
                                        isComplexCase = true;
                                      }
                                    }

                                    return (
                                      <tr key={detail.id} style={{ backgroundColor: '#fff' }}>
                                        {/* ✅ [추가] 개별 기계 체크박스 */}
                                        <td className={styles.td}>
                                          <input 
                                            type="checkbox" 
                                            checked={selectedExportItems.has(detail.id)} 
                                            onChange={() => toggleDetailSelection(detail.id)}
                                            style={{ cursor: 'pointer' }}
                                          />
                                        </td>
                                        <td className={styles.td} style={{ textAlign: 'left', padding: '12px' }}>
                                          <div style={{ marginBottom: '4px' }}><span style={{ ...badgeStyle, fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', fontWeight: '500' }}>{badgeLabel}</span></div>
                                          <div style={{ fontWeight: '600', marginBottom: '2px' }}>{detail.inventory?.model_name}</div>
                                          <div style={{ fontSize: '0.75rem', color: '#999', marginBottom: '2px' }}>{detail.inventory?.serial_number}</div>
                                          <div style={{ fontSize: '0.75rem', color: '#666' }}>청구일: {detail.inventory?.billing_date || '-'}</div>
                                        </td>
                                        <td className={styles.td} style={{ padding: '0' }}><div className={styles.splitCellContainer}><div className={styles.rowGray}>흑백</div><div className={styles.rowBlue}>칼라</div><div className={styles.rowGray}>흑백(A3)</div><div className={`${styles.rowBlue} ${styles.rowLast}`}>칼라(A3)</div></div></td>
                                        <td className={styles.td} style={{ padding: '0' }}><div className={styles.splitCellContainer}><div className={styles.rowGray}>{detail.prev_count_bw.toLocaleString()}</div><div className={styles.rowBlue}>{detail.prev_count_col.toLocaleString()}</div><div className={styles.rowGray}>{detail.prev_count_bw_a3?.toLocaleString() || 0}</div><div className={`${styles.rowBlue} ${styles.rowLast}`}>{detail.prev_count_col_a3?.toLocaleString() || 0}</div></div></td>
                                        <td className={styles.td} style={{ padding: '0' }}><div className={styles.splitCellContainer}><div className={styles.rowGray} style={{ fontWeight:'bold' }}>{detail.curr_count_bw.toLocaleString()}</div><div className={styles.rowBlue} style={{ fontWeight:'bold' }}>{detail.curr_count_col.toLocaleString()}</div><div className={styles.rowGray} style={{ fontWeight:'bold' }}>{detail.curr_count_bw_a3?.toLocaleString() || 0}</div><div className={`${styles.rowBlue} ${styles.rowLast}`} style={{ fontWeight:'bold' }}>{detail.curr_count_col_a3?.toLocaleString() || 0}</div></div></td>
                                        <td className={styles.td} style={{ padding: '12px', textAlign: 'left', fontSize: '0.8rem', lineHeight: '1.6', verticalAlign: 'top' }}>
                                          <div style={{ fontWeight: '600', color: '#555', marginBottom: '2px' }}>기본매수</div>
                                          <div style={{ display:'flex', justifyContent:'space-between', color: '#666', marginBottom:'2px' }}><span>흑백:</span> <span>0</span></div>
                                          <div style={{ display:'flex', justifyContent:'space-between', color: '#0070f3', marginBottom:'4px' }}><span>칼라:</span> <span>0</span></div>
                                          <div style={{ borderTop: '1px solid #eee', margin: '6px 0' }}></div>
                                          <div style={{ fontWeight: '600', color: '#d93025', marginBottom: '2px' }}>추가매수</div>
                                          <div style={{ display:'flex', justifyContent:'space-between', color: '#d93025', marginBottom:'2px' }}><span>흑백:</span> <span>0</span></div>
                                          <div style={{ display:'flex', justifyContent:'space-between', color: '#d93025' }}><span>칼라:</span> <span>0</span></div>
                                        </td>
                                        <td className={styles.td} style={{ padding: '12px', verticalAlign: 'middle', fontWeight: 'bold' }}>{detail.calculated_amount?.toLocaleString()}원</td>
                                        
                                        <td className={styles.td} style={{ padding: '12px', verticalAlign: 'middle' }}>
                                          <span 
                                            onClick={() => handleDetailPaymentClick(hist.id, detail.id, detail.is_paid)}
                                            style={{
                                              fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px',
                                              backgroundColor: detail.is_paid ? '#dbeddb' : '#ffe2dd',
                                              color: detail.is_paid ? '#2eaadc' : '#d93025',
                                              cursor: 'pointer', border: '1px solid transparent', userSelect: 'none'
                                            }}
                                          >
                                            {detail.is_paid ? '완료' : '미납'}
                                          </span>
                                        </td>

                                        <td className={styles.td} style={{ padding: '12px', verticalAlign: 'middle' }}>
                                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                            <button onClick={() => handleDetailRebill(hist.id, detail.id, detail.inventory_id, detail.is_replacement_record, hist.client_id)} style={{ color: 'var(--notion-blue)', border: '1px solid #d3e5ef', background: 'white', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem' }} title="이 기계만 청구 취소">재청구</button>
                                            {isComplexCase && (
                                              <button onClick={() => handleDeleteDetail(hist.id, detail.id, detail.inventory_id, detail.calculated_amount, detail.is_replacement_record)} style={{ backgroundColor: '#fff', border: '1px solid #ffe2dd', color: '#d93025', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem' }} title="완전 삭제">삭제</button>
                                            )}
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                              {hist.memo && <div style={{ marginTop: '10px', padding: '10px', border: '1px solid #f9f0ff', fontSize: '0.85rem', color: '#666', backgroundColor: '#fcfcfc', borderRadius: '6px', margin: '16px' }}>📌 비고: {hist.memo}</div>}
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