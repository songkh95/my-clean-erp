// components/accounting/SettlementConfirmModal.tsx
'use client'

import React from 'react'
import styles from '@/app/accounting/accounting.module.css'
import { Client, Inventory, CalculatedAsset, BillCalculationResult } from '@/app/types'
import { calcVat, calcGrandTotal } from '@/utils/billingAmounts'

interface Props {
    selectedInventories: Set<string>
    calculateSelectedTotal: () => number
    clients: Client[]
    inventoryMap: { [key: string]: Inventory[] }
    calculateClientBill: (client: Client) => BillCalculationResult
    onClose: () => void
    onSave: () => void
    loading: boolean
}

export default function SettlementConfirmModal({
    selectedInventories, calculateSelectedTotal, clients, inventoryMap, calculateClientBill, onClose, onSave, loading
}: Props) {

    const totalSupply = calculateSelectedTotal();
    const totalVat = calcVat(totalSupply);
    const grandTotal = calcGrandTotal(totalSupply);

    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
                <div className={styles.modalTitle}>🧾 청구서 최종 확인</div>

                <div style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: '10px' }}>
                    {clients
                        .filter(client => (inventoryMap[client.id] || []).some(a => selectedInventories.has(a.id)))
                        .map((client) => {
                            const bill = calculateClientBill(client);
                            const selectedDetails = bill.details.filter(d => selectedInventories.has(d.inventory_id));
                            
                            if (selectedDetails.length === 0) return null;

                            // 거래처별 합계
                            const clientSupply = selectedDetails.reduce((sum, d) => sum + d.rowCost.total, 0);
                            const clientVat = calcVat(clientSupply);
                            const clientTotal = calcGrandTotal(clientSupply);

                            return (
                                <div key={client.id} style={{ marginBottom: '30px', border: '1px solid #eee', padding: '20px', borderRadius: '8px' }}>
                                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom:'10px' }}>
                                        <h3 style={{ color: 'var(--notion-blue)', margin: 0, fontSize: '1.1rem' }}>{client.name}</h3>
                                        <div style={{ textAlign: 'right', fontSize:'0.9rem' }}>
                                            <span style={{ color: '#666', marginRight:'8px' }}>공급가: {clientSupply.toLocaleString()}</span>
                                            <span style={{ color: '#666', marginRight:'8px' }}>부가세: {clientVat.toLocaleString()}</span>
                                            <span style={{ fontWeight:'bold', color:'#d93025' }}>합계: {clientTotal.toLocaleString()}원</span>
                                        </div>
                                    </div>

                                    <table className={styles.modalTable}>
                                        <colgroup>
                                            <col style={{ width: '25%' }} />
                                            <col style={{ width: '15%' }} />
                                            <col style={{ width: '20%' }} />
                                            <col style={{ width: '20%' }} />
                                            <col style={{ width: '20%' }} />
                                        </colgroup>
                                        <thead>
                                            <tr>
                                                <th>기계명(S/N)</th>
                                                <th>전월</th>
                                                <th>당월(기본 매수)</th>
                                                <th>추가 매수</th>
                                                <th>공급가</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedDetails.map((d: CalculatedAsset) => {
                                                const rowSupply = d.rowCost.total;
                                                
                                                // 그룹 여부 확인 (병합용)
                                                const shouldRenderExtraCell = !d.billing_group_id || d.isGroupLeader;
                                                
                                                return (
                                                    <tr key={d.inventory_id}>
                                                        <td style={{ textAlign: 'left' }}>
                                                            <div style={{fontSize: '0.7rem', marginBottom: '2px'}}>
                                                                {d.is_replacement_before && <span style={{color: '#ff4d4f', fontWeight: 'bold'}}>[교체전] </span>}
                                                                {d.billing_group_id && <span style={{color: '#9065b0', fontWeight: 'bold'}}>[그룹합산] </span>}
                                                            </div>
                                                            <strong>{d.model_name}</strong><br />
                                                            <span style={{color: '#888', fontSize: '0.75rem'}}>{d.serial_number}</span>
                                                        </td>
                                                        <td>
                                                            <div>흑 {d.prev.bw.toLocaleString()} / A3 {d.prev.bw_a3.toLocaleString()}</div>
                                                            <div style={{color:'#0070f3'}}>칼 {d.prev.col.toLocaleString()} / A3 {d.prev.col_a3.toLocaleString()}</div>
                                                        </td>
                                                        <td>
                                                            <div>흑 {d.curr.bw.toLocaleString()} <span style={{color:'#888', fontSize:'0.8em'}}>(기본:{d.usageBreakdown.basicBW})</span></div>
                                                            <div style={{color:'#0070f3'}}>
                                                                칼 {d.curr.col.toLocaleString()} <span style={{color:'#88aaff', fontSize:'0.8em'}}>(기본:{d.usageBreakdown.basicCol})</span>
                                                            </div>
                                                            <div style={{fontSize:'0.7rem', color:'#999'}}>A3 흑/칼: {d.curr.bw_a3}/{d.curr.col_a3}</div>
                                                        </td>
                                                        
                                                        {/* 추가매수 (그룹이면 병합) */}
                                                        {shouldRenderExtraCell && (
                                                            <td rowSpan={d.billing_group_id ? d.groupSpan : 1} style={{ verticalAlign: 'top', padding:'10px', backgroundColor: d.billing_group_id ? '#fdfdfd' : 'inherit' }}>
                                                                {d.billing_group_id && d.groupUsageBreakdown ? (
                                                                    // 그룹 합산 추가매수
                                                                    <>
                                                                        <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#0070f3', marginBottom: '6px', borderBottom: '1px dashed #e0e0e0', paddingBottom: '4px' }}>
                                                                            합산 기본 매수 ({d.groupUsageBreakdown.poolBasicBW.toLocaleString()}/{d.groupUsageBreakdown.poolBasicCol.toLocaleString()})
                                                                        </div>
                                                                        
                                                                        <div style={{ fontSize: '0.75rem', color: '#555', marginBottom: '2px', fontWeight: '600' }}>기본 매수</div>
                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '2px' }}>
                                                                            <span style={{ color: '#666' }}>흑백:</span>
                                                                            <b>{d.groupUsageBreakdown.basicBW.toLocaleString()}</b>
                                                                        </div>
                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                                                                            <span style={{ color: '#0070f3' }}>칼라:</span>
                                                                            <b>{d.groupUsageBreakdown.basicCol.toLocaleString()}</b>
                                                                        </div>

                                                                        <div style={{ borderTop: '1px solid #eee', margin: '4px 0' }}></div>

                                                                        <div style={{ fontSize: '0.75rem', color: '#d93025', marginBottom: '2px', fontWeight: '600' }}>추가 매수</div>
                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '2px' }}>
                                                                            <span style={{ color: '#d93025' }}>흑백:</span>
                                                                            <b>{d.groupUsageBreakdown.extraBW.toLocaleString()}</b>
                                                                        </div>
                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                                                                            <span style={{ color: '#d93025' }}>칼라:</span>
                                                                            <b>{d.groupUsageBreakdown.extraCol.toLocaleString()}</b>
                                                                        </div>
                                                                    </>
                                                                ) : (
                                                                    // 개별 추가매수
                                                                    <>
                                                                        <div>흑백: <span style={{color: d.usageBreakdown.extraBW > 0 ? '#d93025' : '#ccc'}}>{d.usageBreakdown.extraBW.toLocaleString()}</span></div>
                                                                        <div>칼라: <span style={{color: d.usageBreakdown.extraCol > 0 ? '#d93025' : '#ccc'}}>{d.usageBreakdown.extraCol.toLocaleString()}</span></div>
                                                                    </>
                                                                )}
                                                            </td>
                                                        )}

                                                        <td style={{ color: '#333', fontWeight:'bold' }}>{rowSupply.toLocaleString()}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            );
                        })}
                    
                    <div className={styles.modalSummary} style={{ display: 'flex', gap: '20px', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <div>총 공급가: <b>{totalSupply.toLocaleString()}</b>원</div>
                        <div>총 부가세: <b>{totalVat.toLocaleString()}</b>원</div>
                        <div style={{ fontSize: '1.2rem', color: 'var(--notion-blue)', fontWeight: 'bold' }}>
                           최종: {grandTotal.toLocaleString()} 원
                        </div>
                    </div>
                </div>
                <div className={styles.modalActions}>
                    <button onClick={onClose} className={styles.btnCancel} disabled={loading}>취소</button>
                    <button 
                        onClick={onSave} 
                        className={styles.btnConfirm} 
                        disabled={loading}
                        style={{ opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
                    >
                        {loading ? '저장 중...' : '확인 및 저장'}
                    </button>
                </div>
            </div>
        </div>
    )
}