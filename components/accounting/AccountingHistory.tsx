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
  handleRebillHistory: (id: string) => void // ✅ 추가
  handleDeleteHistory: (id: string) => void // ✅ 추가
  monthMachineHistory: any[] 
  handleDeleteDetail: (settlementId: string, detailId: string, inventoryId: string, amount: number, isReplacement: boolean) => void 
}

export default function AccountingHistory({
  isHistOpen, setIsHistOpen, histYear, setHistYear, histMonth, setHistMonth, historyList, 
  handleRebillHistory, handleDeleteHistory, monthMachineHistory, handleDeleteDetail
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className={styles.section} style={{ marginTop: '30px' }}>
      <div onClick={() => setIsHistOpen(!isHistOpen)} className={styles.header}>
        <span>📋 청구 내역 조회 및 관리</span>
        <span>{isHistOpen ? '▲' : '▼'}</span>
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
                style={{ width: '80px' }} 
              />
              <span>년</span>
              <input 
                type="number" 
                value={histMonth} 
                onChange={e => setHistMonth(Number(e.target.value))} 
                className={styles.input} 
                style={{ width: '60px' }} 
              />
              <span>월 내역 조회</span>
            </div>
          </div>

          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>거래처명</th>
                  <th className={styles.th}>정산 기기수</th>
                  <th className={styles.th}>총 청구액</th>
                  <th className={styles.th}>입금상태</th>
                  <th className={styles.th}>관리</th>
                </tr>
              </thead>
              <tbody>
                {historyList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className={styles.td} style={{ color: '#999', padding: '30px' }}>
                      조회된 내역이 없습니다.
                    </td>
                  </tr>
                ) : historyList.map(hist => (
                  <React.Fragment key={hist.id}>
                    <tr 
                      onClick={() => toggleExpand(hist.id)} 
                      style={{ cursor: 'pointer', backgroundColor: expandedId === hist.id ? '#f0f7ff' : 'transparent' }}
                    >
                      <td className={styles.td} style={{ fontWeight: 'bold', textAlign: 'left', paddingLeft: '20px' }}>
                        <span style={{ marginRight: '8px' }}>{expandedId === hist.id ? '▼' : '▶'}</span>
                        {hist.client?.name}
                      </td>
                      <td className={styles.td}>{hist.details?.length || 0}대</td>
                      <td className={styles.td} style={{ color: '#0070f3', fontWeight: 'bold' }}>
                        {hist.total_amount?.toLocaleString()}원
                      </td>
                      <td className={styles.td}>
                        <span style={{ 
                          fontSize: '0.75rem', 
                          padding: '2px 6px', 
                          borderRadius: '4px', 
                          backgroundColor: hist.is_paid ? '#e6ffed' : '#fff1f0', 
                          color: hist.is_paid ? '#52c41a' : '#f5222d',
                          border: `1px solid ${hist.is_paid ? '#b7eb8f' : '#ffa39e'}`
                        }}>
                          {hist.is_paid ? '입금완료' : '미입금'}
                        </span>
                      </td>
                      <td className={styles.td}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          {/* ✅ [수정] 재청구 버튼 */}
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRebillHistory(hist.id);
                            }} 
                            style={{ 
                              color: '#0070f3', border: '1px solid #91d5ff', background: 'white', 
                              cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem' 
                            }}
                            title="삭제 후 기계 상태를 복구하여 다시 청구할 수 있게 합니다."
                          >
                            재청구
                          </button>
                          {/* ✅ [수정] 삭제 버튼 */}
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteHistory(hist.id);
                            }} 
                            style={{ 
                              color: '#d93025', border: '1px solid #ffccc7', background: 'white', 
                              cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem' 
                            }}
                            title="청구 이력만 삭제합니다."
                          >
                            삭제
                          </button>
                        </div>
                      </td>
                    </tr>

                    {expandedId === hist.id && (
                      <tr style={{ backgroundColor: '#fafafa' }}>
                        <td colSpan={5} style={{ padding: '20px' }}>
                          <div style={{ backgroundColor: '#fff', border: '1px solid #eee', borderRadius: '8px', overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                              <thead style={{ backgroundColor: '#f9f9f9', borderBottom: '1px solid #eee' }}>
                                <tr>
                                  <th style={{ padding: '10px', color: '#666', width: '25%' }}>기계 모델 (S/N)</th>
                                  <th style={{ padding: '10px', color: '#666', textAlign: 'center' }}>카운터 (전월 → 당월)</th>
                                  <th style={{ padding: '10px', color: '#666', textAlign: 'center' }}>실사용량</th>
                                  <th style={{ padding: '10px', color: '#666', textAlign: 'center' }}>청구 금액</th>
                                  <th style={{ padding: '10px', color: '#666', textAlign: 'center', width: '80px' }}>관리</th>
                                </tr>
                              </thead>
                              <tbody>
                                {hist.details?.map((detail: any) => {
                                  // 기존 뱃지 로직
                                  let badgeLabel = detail.inventory?.status || '설치';
                                  let badgeStyle = { backgroundColor: '#f5f5f5', color: '#666', border: '1px solid #d9d9d9' };

                                  if (detail.is_replacement_record) {
                                    badgeLabel = "교체(철수)";
                                    badgeStyle = { backgroundColor: '#fff1f0', color: '#cf1322', border: '1px solid #ffa39e' };
                                  } else {
                                    const isInstalledThisMonth = monthMachineHistory?.some(mh => 
                                      mh.inventory_id === detail.inventory_id && mh.action_type === 'INSTALL'
                                    );
                                    if (isInstalledThisMonth) {
                                      badgeLabel = "교체(설치)";
                                      badgeStyle = { backgroundColor: '#e6f7ff', color: '#096dd9', border: '1px solid #91d5ff' };
                                    } else {
                                      badgeLabel = "설치";
                                      badgeStyle = { backgroundColor: '#f6ffed', color: '#389e0d', border: '1px solid #b7eb8f' };
                                    }
                                  }

                                  return (
                                    <tr key={detail.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                      <td style={{ padding: '12px', textAlign: 'left' }}>
                                        <div style={{ marginBottom: '4px' }}>
                                          <span style={{
                                            ...badgeStyle,
                                            fontSize: '0.7rem',
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            fontWeight: '600'
                                          }}>
                                            {badgeLabel}
                                          </span>
                                        </div>
                                        <div style={{ fontWeight: '600' }}>{detail.inventory?.model_name}</div>
                                        <div style={{ fontSize: '0.75rem', color: '#999' }}>{detail.inventory?.serial_number}</div>
                                      </td>
                                      <td style={{ padding: '8px', verticalAlign: 'middle' }}>
                                        <div className={styles.splitCellContainer} style={{ minHeight: 'auto', border: '1px solid #eee', borderRadius: '4px' }}>
                                          <div style={{ display: 'flex', borderBottom: '1px solid #eee' }}>
                                            <div style={{ flex: 1, padding: '4px', textAlign: 'center', backgroundColor: '#fafafa', color: '#666', borderRight: '1px solid #eee' }}>{detail.prev_count_bw}</div>
                                            <div style={{ flex: 1, padding: '4px', textAlign: 'center', backgroundColor: 'rgba(0,112,243,0.05)', color: '#0070f3' }}>{detail.prev_count_col}</div>
                                          </div>
                                          <div style={{ display: 'flex' }}>
                                            <div style={{ flex: 1, padding: '4px', textAlign: 'center', backgroundColor: '#fafafa', color: '#666', fontWeight:'bold', borderRight: '1px solid #eee' }}>{detail.curr_count_bw}</div>
                                            <div style={{ flex: 1, padding: '4px', textAlign: 'center', backgroundColor: 'rgba(0,112,243,0.05)', color: '#0070f3', fontWeight:'bold' }}>{detail.curr_count_col}</div>
                                          </div>
                                        </div>
                                      </td>
                                      <td style={{ padding: '12px', textAlign: 'center', verticalAlign: 'middle' }}>
                                        <div style={{ fontSize: '0.85rem' }}>
                                          <div>흑: <strong>{(detail.curr_count_bw - detail.prev_count_bw).toLocaleString()}</strong></div>
                                          <div>칼: <strong style={{color:'#0070f3'}}>{(detail.curr_count_col - detail.prev_count_col).toLocaleString()}</strong></div>
                                        </div>
                                      </td>
                                      <td style={{ padding: '12px', textAlign: 'center', verticalAlign: 'middle', fontWeight: 'bold', color: '#333' }}>
                                        {detail.calculated_amount?.toLocaleString()}원
                                      </td>
                                      <td style={{ padding: '12px', textAlign: 'center', verticalAlign: 'middle' }}>
                                        <button 
                                          onClick={() => handleDeleteDetail(hist.id, detail.id, detail.inventory_id, detail.calculated_amount, detail.is_replacement_record)}
                                          style={{
                                            backgroundColor: '#fff', border: '1px solid #ffccc7', color: '#d93025',
                                            cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem'
                                          }}
                                        >
                                          개별 삭제
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                            {hist.memo && (
                              <div style={{ padding: '10px 20px', borderTop: '1px solid #eee', fontSize: '0.8rem', color: '#666', backgroundColor: '#fffbe6' }}>
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