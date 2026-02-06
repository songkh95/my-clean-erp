// components/accounting/AccountingHistory.tsx
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
  handleOpenStatement: (settlement: Settlement, targetDetails: SettlementDetail[]) => void
}

interface GroupStats {
  totalPoolBW: number;
  totalPoolCol: number;
  totalUsedBW: number;
  totalUsedCol: number;
  totalExtraBW: number;
  totalExtraCol: number;
  count: number;
  startIndex: number;
}

export default function AccountingHistory({
  isHistOpen, setIsHistOpen, histYear, setHistYear, histMonth, setHistMonth, historyList, 
  handleDeleteHistory, monthMachineHistory, handleDeleteDetail, handleDetailRebill,
  handleRebillHistory,
  targetDay, setTargetDay, searchTerm, setSearchTerm, onSearch, togglePaymentStatus, toggleDetailPaymentStatus,
  handleBatchDeleteHistory, handleBatchRebillHistory,
  handleOpenStatement
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

  const processDetailsForGrouping = (details: SettlementDetail[] = []) => {
    const groupStatsMap = new Map<string, GroupStats>();

    // 1. 그룹별 통계 계산
    details.forEach((d, idx) => {
      // @ts-ignore
      const inv = d.inventory as any;
      const groupId = inv?.billing_group_id;

      if (groupId) {
        if (!groupStatsMap.has(groupId)) {
          groupStatsMap.set(groupId, {
            totalPoolBW: 0, totalPoolCol: 0,
            totalUsedBW: 0, totalUsedCol: 0,
            totalExtraBW: 0, totalExtraCol: 0,
            count: 0, startIndex: idx
          });
        }
        const stats = groupStatsMap.get(groupId)!;
        
        stats.totalPoolBW += (inv.plan_basic_cnt_bw || 0);
        stats.totalPoolCol += (inv.plan_basic_cnt_col || 0);
        stats.totalUsedBW += (d.converted_usage_bw || 0);
        stats.totalUsedCol += (d.converted_usage_col || 0);
        stats.count += 1;
      }
    });

    // 2. 초과량 계산
    groupStatsMap.forEach(stats => {
      stats.totalExtraBW = Math.max(0, stats.totalUsedBW - stats.totalPoolBW);
      stats.totalExtraCol = Math.max(0, stats.totalUsedCol - stats.totalPoolCol);
    });

    // 3. 렌더링 데이터 생성
    return details.map((d, idx) => {
      // @ts-ignore
      const groupId = d.inventory?.billing_group_id;
      let rowSpan = 1;
      let isHidden = false;
      let groupStats = null;

      if (groupId) {
        const stats = groupStatsMap.get(groupId)!;
        const isLeader = stats.startIndex === idx;

        if (isLeader) {
          rowSpan = stats.count;
          groupStats = stats;
        } else {
          isHidden = true;
        }
      }

      return {
        ...d,
        _ui: { rowSpan, isHidden, groupStats }
      };
    });
  };

  const ROW_H = '32px';
  const rowStyle = { height: ROW_H, display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #eee', padding: '0 4px', fontSize: '0.8rem' };
  const rowStyleLast = { ...rowStyle, borderBottom: 'none' };

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
            {/* 컨트롤 영역 */}
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
            <table className={styles.table} style={{ tableLayout: 'fixed', width: '100%' }}>
              <colgroup>
                <col style={{ width: '50px' }} />
                {/* ✅ [수정 1] 거래처명 너비를 제거하여 남는 공간 꽉 채움 */}
                <col /> 
                <col style={{ width: '100px' }} />
                <col style={{ width: '250px' }} />
                <col style={{ width: '100px' }} />
                <col style={{ width: '250px' }} />
              </colgroup>
              <thead>
                <tr>
                  <th className={styles.th}><input type="checkbox" checked={isAllSelected} onChange={handleSelectAll} style={{ cursor: 'pointer', transform: 'scale(1.2)' }} /></th>
                  {['거래처명', '기기수', '청구 금액 (VAT포함)', '입금상태', '관리'].map((title, idx) => (
                    <th key={idx + 1} className={styles.th}>{title}</th>
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
                  
                  const processedDetails = processDetailsForGrouping(hist.details);

                  return (
                    <React.Fragment key={hist.id}>
                      <tr onClick={() => toggleExpand(hist.id)} style={{ cursor: 'pointer', backgroundColor: expandedId === hist.id ? 'var(--notion-soft-bg)' : '#fafafa', borderBottom: '1px solid #e0e0e0' }}>
                        <td className={styles.td} onClick={(e) => e.stopPropagation()} style={{ backgroundColor: 'inherit' }}>
                          <input type="checkbox" checked={selectedSettlementIds.has(hist.id)} onChange={() => toggleClientSelection(hist)} style={{ cursor: 'pointer', transform: 'scale(1.2)' }} />
                        </td>
                        <td className={styles.td} style={{ textAlign: 'left', padding: '12px 16px', fontWeight: '600', color: '#171717', backgroundColor: 'inherit' }}>
                          <span style={{ marginRight: '8px', fontSize:'0.7rem', color:'#888' }}>{expandedId === hist.id ? '▼' : '▶'}</span>
                          {hist.client?.name || '(거래처 미상)'}
                        </td>
                        <td className={styles.td} style={{ padding: '12px', fontSize: '0.9rem', backgroundColor: 'inherit' }}>{hist.details?.length || 0}대</td>
                        <td className={styles.td} style={{ padding: '8px 16px', backgroundColor: 'inherit' }}>
                          <div style={{ color: '#0070f3', fontWeight: '700', fontSize: '0.95rem' }}>{total.toLocaleString()}원</div>
                          <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '2px' }}>(공급 {supply.toLocaleString()} / 세액 {vat.toLocaleString()})</div>
                        </td>
                        <td className={styles.td} style={{ padding: '8px', backgroundColor: 'inherit' }}>
                          <span onClick={(e) => handlePaymentClick(e, hist.id, hist.is_paid)} style={{ fontSize: '0.75rem', padding: '4px 8px', borderRadius: '4px', backgroundColor: hist.is_paid ? '#dbeddb' : '#ffe2dd', color: hist.is_paid ? '#2eaadc' : '#d93025', cursor: 'pointer', fontWeight: '600' }}>{hist.is_paid ? '입금완료' : '미입금'}</span>
                        </td>
                        <td className={styles.td} style={{ padding: '8px', backgroundColor: 'inherit' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                            <button onClick={(e) => { e.stopPropagation(); const targetDetails = hist.details?.filter(d => selectedExportItems.has(d.id)) || []; handleOpenStatement(hist, targetDetails); }} style={{ color: '#333', border: '1px solid #ccc', background: 'white', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem' }}>📄 명세서</button>
                            <button onClick={(e) => { e.stopPropagation(); handleRebillHistory(hist.id); }} style={{ color: 'var(--notion-blue)', border: '1px solid #d3e5ef', background: 'white', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem' }}>재청구</button>
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteHistory(hist.id); }} style={{ color: '#d93025', border: '1px solid #ffe2dd', background: 'white', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem' }}>삭제</button>
                          </div>
                        </td>
                      </tr>
                      
                      {expandedId === hist.id && (
                        <tr>
                          {/* ✅ [수정 2] 상세 내역 컨테이너 디자인 개선 (Card Style) */}
                          <td colSpan={6} style={{ backgroundColor: '#f5f5f7' }}>
                            <div style={{ 
                              backgroundColor: '#fff', 
                              borderRadius: '0px', 
                              border: '0px', 
                              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                              overflow: 'hidden' 
                            }}>
                              <table className={styles.table} style={{ tableLayout: 'fixed', backgroundColor: '#fff', width: '100%', margin: 0 }}>
                                <colgroup>
                                  <col style={{ width: '50px' }} />
                                  <col />
                                  <col style={{ width: '80px' }} />
                                  <col style={{ width: '15%' }} />
                                  <col style={{ width: '15%' }} /> 
                                  <col style={{ width: '15%' }} />
                                  <col style={{ width: '90px' }} />
                                  <col style={{ width: '140px' }} />
                                </colgroup>
                                <thead>
                                  <tr>
                                    <th className={styles.th} style={{backgroundColor: '#d5e7fc', borderBottom:'1px solid #eee'}}>선택</th>
                                    <th className={styles.th} style={{backgroundColor: '#d5e7fc', borderBottom:'1px solid #eee'}}>기계 모델 (S/N)</th>
                                    <th className={styles.th} style={{backgroundColor: '#d5e7fc', borderBottom:'1px solid #eee'}}>구분</th>
                                    <th className={styles.th} style={{backgroundColor: '#d5e7fc', borderBottom:'1px solid #eee'}}>전월 / 당월</th>
                                    <th className={styles.th} style={{backgroundColor: '#d5e7fc', borderBottom:'1px solid #eee'}}>추가 매수</th>
                                    <th className={styles.th} style={{backgroundColor: '#d5e7fc', borderBottom:'1px solid #eee'}}>상세 금액 (VAT포함)</th>
                                    <th className={styles.th} style={{backgroundColor: '#d5e7fc', borderBottom:'1px solid #eee'}}>입금</th>
                                    <th className={styles.th} style={{backgroundColor: '#d5e7fc', borderBottom:'1px solid #eee'}}>관리</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {processedDetails.map((detail) => {
                                    let badgeLabel = detail.inventory?.status || '설치';
                                    let badgeStyle = { backgroundColor: '#f1f1f0', color: '#37352f' };
                                    let isComplexCase = false;
                                    if (detail.inventory?.status === '교체전(철수)') { badgeLabel = "교체(철수)"; badgeStyle = { backgroundColor: '#ffe2dd', color: '#d93025' }; isComplexCase = true; }
                                    
                                    const rowSupply = detail.calculated_amount ?? 0;
                                    const rowVat = Math.floor(rowSupply * 0.1);
                                    const rowTotal = rowSupply + rowVat;

                                    return (
                                      <tr key={detail.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                        <td className={styles.td} style={{ verticalAlign: 'middle', border:'none' }}>
                                          <input type="checkbox" checked={selectedExportItems.has(detail.id)} onChange={() => toggleDetailSelection(detail.id)} style={{ cursor: 'pointer' }} />
                                        </td>
                                        <td className={styles.td} style={{ textAlign: 'left', padding: '12px', verticalAlign: 'middle', border:'none' }}>
                                          <div style={{ marginBottom: '4px' }}>
                                            <span style={{ ...badgeStyle, fontSize: '0.65rem', padding: '2px 4px', borderRadius: '3px', fontWeight: '500' }}>{badgeLabel}</span>
                                            {/* @ts-ignore */}
                                            {detail.inventory?.billing_group_id && <span style={{ fontSize: '0.65rem', padding: '2px 4px', borderRadius: '3px', fontWeight: '500', backgroundColor: '#f9f0ff', color: '#9065b0', marginLeft: '4px' }}>🔗 그룹</span>}
                                          </div>
                                          <div style={{ fontWeight: '600', fontSize:'0.9rem', marginBottom: '2px' }}>{detail.inventory?.model_name}</div>
                                          <div style={{ fontSize: '0.75rem', color: '#999' }}>{detail.inventory?.serial_number}</div>
                                        </td>
                                        
                                        <td className={styles.td} style={{ padding: '0', fontSize:'0.8rem', border:'none' }}>
                                            <div style={rowStyle}>흑백</div><div style={rowStyle}>칼라</div><div style={rowStyle}>흑(A3)</div><div style={rowStyleLast}>칼(A3)</div>
                                        </td>
                                        
                                        <td className={styles.td} style={{ padding: '0', fontSize:'0.8rem', border:'none' }}>
                                            <div style={rowStyle}>{detail.prev_count_bw?.toLocaleString()} / <b>{detail.curr_count_bw?.toLocaleString()}</b></div>
                                            <div style={rowStyle}>{detail.prev_count_col?.toLocaleString()} / <b>{detail.curr_count_col?.toLocaleString()}</b></div>
                                            <div style={rowStyle}>{detail.prev_count_bw_a3?.toLocaleString()} / <b>{detail.curr_count_bw_a3?.toLocaleString()}</b></div>
                                            <div style={rowStyleLast}>{detail.prev_count_col_a3?.toLocaleString()} / <b>{detail.curr_count_col_a3?.toLocaleString()}</b></div>
                                        </td>

                                        {!detail._ui.isHidden && (
                                          <td className={styles.td} rowSpan={detail._ui.rowSpan} style={{ padding: '8px 12px', textAlign: 'left', verticalAlign: 'top', backgroundColor: detail._ui.rowSpan > 1 ? '#fbfbff' : 'inherit', border:'none', borderLeft: detail._ui.rowSpan > 1 ? '1px solid #f0f0f0' : 'none' }}>
                                            {detail._ui.groupStats ? (
                                                <>
                                                    <div style={{ fontSize:'0.8rem', fontWeight: '700', color: '#0070f3', marginBottom: '6px', textAlign:'center', borderBottom:'1px dashed #e0e0e0', paddingBottom:'4px' }}>
                                                      합산 기본 매수 ({detail._ui.groupStats.totalPoolBW.toLocaleString()}/{detail._ui.groupStats.totalPoolCol.toLocaleString()})
                                                    </div>
                                                    
                                                    <div style={{ fontSize:'0.75rem', color: '#555', marginBottom:'2px', fontWeight:'600' }}>기본 매수</div>
                                                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.75rem', color: '#666', marginBottom:'2px' }}>
                                                        <span>흑백:</span> 
                                                        <b>{(detail._ui.groupStats.totalUsedBW - detail._ui.groupStats.totalExtraBW).toLocaleString()}</b>
                                                    </div>
                                                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.75rem', color: '#0070f3', marginBottom:'4px' }}>
                                                        <span>칼라:</span> 
                                                        <b>{(detail._ui.groupStats.totalUsedCol - detail._ui.groupStats.totalExtraCol).toLocaleString()}</b>
                                                    </div>
                                                    
                                                    <div style={{ borderTop: '1px solid #eee', margin: '4px 0' }}></div>
                                                    
                                                    <div style={{ fontSize:'0.75rem', color: '#d93025', marginBottom:'2px', fontWeight:'600' }}>추가 매수</div>
                                                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.75rem', color: '#d93025', marginBottom:'2px' }}>
                                                        <span>흑백:</span> 
                                                        <b>{detail._ui.groupStats.totalExtraBW.toLocaleString()}</b>
                                                    </div>
                                                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.75rem', color: '#d93025' }}>
                                                        <span>칼라:</span> 
                                                        <b>{detail._ui.groupStats.totalExtraCol.toLocaleString()}</b>
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <div style={{ fontSize:'0.75rem', color: '#555', marginBottom:'2px', fontWeight:'600' }}>기본 매수</div>
                                                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px', fontSize:'0.75rem' }}>
                                                        <span>흑백:</span> 
                                                        <b>{((detail.converted_usage_bw ?? 0) - Math.max(0, (detail.converted_usage_bw ?? 0) - (detail.inventory?.plan_basic_cnt_bw ?? 0))).toLocaleString()}</b>
                                                    </div>
                                                    <div style={{ display:'flex', justifyContent:'space-between', color: '#0070f3', fontSize:'0.75rem', marginBottom:'4px' }}>
                                                        <span>칼라:</span> 
                                                        <b>{((detail.converted_usage_col ?? 0) - Math.max(0, (detail.converted_usage_col ?? 0) - (detail.inventory?.plan_basic_cnt_col ?? 0))).toLocaleString()}</b>
                                                    </div>

                                                    {(Math.max(0, (detail.converted_usage_bw ?? 0) - (detail.inventory?.plan_basic_cnt_bw ?? 0)) > 0 || 
                                                      Math.max(0, (detail.converted_usage_col ?? 0) - (detail.inventory?.plan_basic_cnt_col ?? 0)) > 0) && (
                                                      <>
                                                        <div style={{ borderTop: '1px solid #eee', margin: '4px 0' }}></div>
                                                        <div style={{ fontSize:'0.75rem', color: '#d93025', marginBottom:'2px', fontWeight:'600' }}>추가 매수</div>
                                                        <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.75rem', color: '#d93025', marginBottom:'2px' }}>
                                                            <span>흑백:</span> 
                                                            <b>{Math.max(0, (detail.converted_usage_bw ?? 0) - (detail.inventory?.plan_basic_cnt_bw ?? 0)).toLocaleString()}</b>
                                                        </div>
                                                        <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.75rem', color: '#d93025' }}>
                                                            <span>칼라:</span> 
                                                            <b>{Math.max(0, (detail.converted_usage_col ?? 0) - (detail.inventory?.plan_basic_cnt_col ?? 0)).toLocaleString()}</b>
                                                        </div>
                                                      </>
                                                    )}
                                                </>
                                            )}
                                          </td>
                                        )}
                                        
                                        <td className={styles.td} style={{ padding: '8px 12px', verticalAlign: 'middle', textAlign: 'right', border:'none' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                <div style={{ fontSize: '0.75rem', color: '#666', display: 'flex', justifyContent: 'space-between' }}><span>공급</span> <span>{rowSupply.toLocaleString()}</span></div>
                                                <div style={{ fontSize: '0.75rem', color: '#666', display: 'flex', justifyContent: 'space-between' }}><span>VAT</span> <span>{rowVat.toLocaleString()}</span></div>
                                                <div style={{ borderTop: '1px solid #eee', paddingTop: '2px', marginTop: '2px', display: 'flex', justifyContent: 'space-between', color: '#333', fontWeight: 'bold' }}>
                                                    <span style={{ fontSize: '0.75rem' }}>합계</span> <span style={{fontSize:'0.9rem'}}>{rowTotal.toLocaleString()}</span>
                                                </div>
                                            </div>
                                        </td>

                                        <td className={styles.td} style={{ padding: '8px', verticalAlign: 'middle', border:'none' }}>
                                          <span onClick={() => handleDetailPaymentClick(hist.id, detail.id, detail.is_paid)} style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: detail.is_paid ? '#dbeddb' : '#ffe2dd', color: detail.is_paid ? '#2eaadc' : '#d93025', cursor: 'pointer' }}>{detail.is_paid ? '완료' : '미납'}</span>
                                        </td>
                                        <td className={styles.td} style={{ padding: '8px', verticalAlign: 'middle', border:'none' }}>
                                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                            <button onClick={() => handleOpenStatement(hist, [detail])} style={{ color: '#333', border: '1px solid #ccc', background: 'white', cursor: 'pointer', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem' }}>명세서</button>
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