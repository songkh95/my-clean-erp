'use client'

import React, { useState } from 'react'
import styles from '@/app/accounting/accounting.module.css'

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
}

export default function AccountingHistory({
  isHistOpen, setIsHistOpen, histYear, setHistYear, histMonth, setHistMonth, historyList, 
  handleDeleteHistory, monthMachineHistory, handleDeleteDetail, handleDetailRebill,
  handleRebillHistory,
  targetDay, setTargetDay, searchTerm, setSearchTerm, onSearch
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

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
                <option value="all">전체 납기일</option>
                <option value="말일">말일</option>
                {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (<option key={d} value={String(d)}>{d}일</option>))}
              </select>
            </div>

            <div className={styles.controlItem} style={{ flex: 1 }}>
              <input placeholder="거래처명, 모델명 검색..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={styles.input} style={{ width: '100%' }} />
            </div>

            <button onClick={onSearch} className={styles.saveBtn}>조회</button>
          </div>

          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th} style={{width:'300px'}}>거래처명</th>
                  <th className={styles.th} style={{width:'100px'}}>기기수</th>
                  <th className={styles.th} style={{width:'150px'}}>총 청구액</th>
                  <th className={styles.th} style={{width:'100px'}}>입금상태</th>
                  <th className={styles.th} style={{width:'160px'}}>관리</th>
                </tr>
              </thead>
              <tbody>
                {historyList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className={styles.td} style={{ color: 'var(--notion-sub-text)', padding: '40px' }}>
                      조회된 내역이 없습니다.
                    </td>
                  </tr>
                ) : historyList.map(hist => (
                  <React.Fragment key={hist.id}>
                    <tr 
                      onClick={() => toggleExpand(hist.id)} 
                      style={{ cursor: 'pointer', backgroundColor: expandedId === hist.id ? 'var(--notion-soft-bg)' : 'transparent' }}
                    >
                      <td className={styles.td} style={{ textAlign: 'left', padding: '16px 16px 16px 24px', fontWeight: '500' }}>
                        <span style={{ marginRight: '8px', fontSize:'0.7rem', color:'#aaa' }}>{expandedId === hist.id ? '▼' : '▶'}</span>
                        {hist.client?.name}
                      </td>
                      <td className={styles.td} style={{ padding: '16px' }}>{hist.details?.length || 0}대</td>
                      <td className={styles.td} style={{ padding: '16px', color: 'var(--notion-blue)', fontWeight: '600' }}>
                        {hist.total_amount?.toLocaleString()}원
                      </td>
                      <td className={styles.td} style={{ padding: '16px' }}>
                        <span style={{ 
                          fontSize: '0.75rem', 
                          padding: '4px 8px', 
                          borderRadius: '4px', 
                          backgroundColor: hist.is_paid ? '#dbeddb' : '#ffe2dd', 
                          color: hist.is_paid ? '#2eaadc' : '#d93025'
                        }}>
                          {hist.is_paid ? '입금완료' : '미입금'}
                        </span>
                      </td>
                      <td className={styles.td} style={{ padding: '16px' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRebillHistory(hist.id);
                            }} 
                            style={{ 
                              color: 'var(--notion-blue)', border: '1px solid #d3e5ef', background: 'white', 
                              cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem' 
                            }}
                            title="전체 재청구"
                          >
                            전체 재청구
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteHistory(hist.id);
                            }} 
                            style={{ 
                              color: '#d93025', border: '1px solid #ffe2dd', background: 'white', 
                              cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem' 
                            }}
                            title="전체 삭제"
                          >
                            전체 삭제
                          </button>
                        </div>
                      </td>
                    </tr>

                    {expandedId === hist.id && (
                      <tr>
                        <td colSpan={5} style={{ padding: '0', backgroundColor: '#fff' }}>
                          <div style={{ borderTop: '1px solid var(--notion-border)', borderBottom: '1px solid var(--notion-border)' }}>
                            <table className={styles.table} style={{ backgroundColor: '#fafafa' }}>
                              <thead>
                                <tr>
                                  <th className={styles.th} style={{ width: '20%' }}>기계 모델 (S/N)</th>
                                  <th className={styles.th} style={{ width: '60px' }}>구분</th>
                                  <th className={styles.th} style={{ width: '100px' }}>전월</th>
                                  <th className={styles.th} style={{ width: '100px' }}>당월</th>
                                  <th className={styles.th} style={{ width: '160px' }}>실사용량 (가중치)</th>
                                  <th className={styles.th} style={{ width: '120px' }}>청구 금액</th>
                                  <th className={styles.th} style={{ width: '100px' }}>관리</th>
                                </tr>
                              </thead>
                              <tbody>
                                {hist.details?.map((detail: any) => {
                                  let badgeLabel = detail.inventory?.status || '설치';
                                  let badgeStyle = { backgroundColor: '#f1f1f0', color: '#37352f' };
                                  let isComplexCase = false;

                                  if (detail.is_replacement_record) {
                                    badgeLabel = "교체(철수)";
                                    badgeStyle = { backgroundColor: '#ffe2dd', color: '#d93025' };
                                    isComplexCase = true;
                                  } else {
                                    const isInstalledThisMonth = monthMachineHistory?.some(mh => 
                                      mh.inventory_id === detail.inventory_id && mh.action_type === 'INSTALL'
                                    );
                                    if (isInstalledThisMonth) {
                                      badgeLabel = "교체(설치)";
                                      badgeStyle = { backgroundColor: '#d3e5ef', color: '#0070f3' };
                                      isComplexCase = true;
                                    }
                                  }

                                  const usageBW = detail.curr_count_bw - detail.prev_count_bw;
                                  const usageCol = detail.curr_count_col - detail.prev_count_col;

                                  return (
                                    <tr key={detail.id} style={{ backgroundColor: '#fff' }}>
                                      {/* ✅ 기계 정보 표시 수정: 상태 -> 모델명 -> S/N -> 청구일 */}
                                      <td className={styles.td} style={{ textAlign: 'left', padding: '12px' }}>
                                        <div style={{ marginBottom: '4px' }}>
                                          <span style={{ ...badgeStyle, fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', fontWeight: '500' }}>
                                            {badgeLabel}
                                          </span>
                                        </div>
                                        <div style={{ fontWeight: '600', marginBottom: '2px' }}>{detail.inventory?.model_name}</div>
                                        <div style={{ fontSize: '0.75rem', color: '#999', marginBottom: '2px' }}>{detail.inventory?.serial_number}</div>
                                        <div style={{ fontSize: '0.75rem', color: '#666' }}>청구일: {detail.inventory?.billing_date || '-'}</div>
                                      </td>
                                      
                                      <td className={styles.td} style={{ padding: '0' }}>
                                        <div className={styles.splitCellContainer}>
                                          <div className={styles.rowGray}>흑백</div>
                                          <div className={styles.rowBlue}>칼라</div>
                                          <div className={styles.rowGray}>흑백(A3)</div>
                                          <div className={`${styles.rowBlue} ${styles.rowLast}`}>칼라(A3)</div>
                                        </div>
                                      </td>

                                      <td className={styles.td} style={{ padding: '0' }}>
                                        <div className={styles.splitCellContainer}>
                                          <div className={styles.rowGray}>{detail.prev_count_bw.toLocaleString()}</div>
                                          <div className={styles.rowBlue}>{detail.prev_count_col.toLocaleString()}</div>
                                          <div className={styles.rowGray}>{detail.prev_count_bw_a3?.toLocaleString() || 0}</div>
                                          <div className={`${styles.rowBlue} ${styles.rowLast}`}>{detail.prev_count_col_a3?.toLocaleString() || 0}</div>
                                        </div>
                                      </td>

                                      <td className={styles.td} style={{ padding: '0' }}>
                                        <div className={styles.splitCellContainer}>
                                          <div className={styles.rowGray} style={{ fontWeight:'bold' }}>{detail.curr_count_bw.toLocaleString()}</div>
                                          <div className={styles.rowBlue} style={{ fontWeight:'bold' }}>{detail.curr_count_col.toLocaleString()}</div>
                                          <div className={styles.rowGray} style={{ fontWeight:'bold' }}>{detail.curr_count_bw_a3?.toLocaleString() || 0}</div>
                                          <div className={`${styles.rowBlue} ${styles.rowLast}`} style={{ fontWeight:'bold' }}>{detail.curr_count_col_a3?.toLocaleString() || 0}</div>
                                        </div>
                                      </td>

                                      <td className={styles.td} style={{ padding: '12px', textAlign: 'left', fontSize: '0.8rem', lineHeight: '1.6', verticalAlign: 'top' }}>
                                        <div style={{ fontWeight: '600', color: '#555', marginBottom: '2px' }}>기본매수</div>
                                        <div style={{ display:'flex', justifyContent:'space-between', color: '#666', marginBottom:'2px' }}>
                                          <span>흑백:</span> <span>0</span>
                                        </div>
                                        <div style={{ display:'flex', justifyContent:'space-between', color: '#0070f3', marginBottom:'4px' }}>
                                          <span>칼라:</span> <span>0</span>
                                        </div>
                                        
                                        <div style={{ borderTop: '1px solid #eee', margin: '6px 0' }}></div>
                                        
                                        <div style={{ fontWeight: '600', color: '#d93025', marginBottom: '2px' }}>추가매수</div>
                                        <div style={{ display:'flex', justifyContent:'space-between', color: '#d93025', marginBottom:'2px' }}>
                                          <span>흑백:</span> <span>0</span>
                                        </div>
                                        <div style={{ display:'flex', justifyContent:'space-between', color: '#d93025' }}>
                                          <span>칼라:</span> <span>0</span>
                                        </div>
                                      </td>

                                      <td className={styles.td} style={{ padding: '12px', verticalAlign: 'middle', fontWeight: 'bold' }}>
                                        {detail.calculated_amount?.toLocaleString()}원
                                      </td>
                                      
                                      <td className={styles.td} style={{ padding: '12px', verticalAlign: 'middle' }}>
                                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                          <button 
                                            onClick={() => handleDetailRebill(hist.id, detail.id, detail.inventory_id, detail.is_replacement_record, hist.client_id)}
                                            style={{
                                              color: 'var(--notion-blue)', border: '1px solid #d3e5ef', background: 'white',
                                              cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem'
                                            }}
                                            title="이 기계만 청구 취소"
                                          >
                                            재청구
                                          </button>
                                          {isComplexCase && (
                                            <button 
                                              onClick={() => handleDeleteDetail(hist.id, detail.id, detail.inventory_id, detail.calculated_amount, detail.is_replacement_record)}
                                              style={{
                                                backgroundColor: '#fff', border: '1px solid #ffe2dd', color: '#d93025',
                                                cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem'
                                              }}
                                              title="완전 삭제"
                                            >
                                              삭제
                                            </button>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                            {hist.memo && (
                              <div style={{ marginTop: '10px', padding: '10px', border: '1px solid #f9f0ff', fontSize: '0.85rem', color: '#666', backgroundColor: '#fcfcfc', borderRadius: '6px', margin: '16px' }}>
                                📌 비고: {hist.memo}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}