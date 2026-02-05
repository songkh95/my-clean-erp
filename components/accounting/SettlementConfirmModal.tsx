'use client'

import React from 'react'
import styles from '@/app/accounting/accounting.module.css'
import { Client, Inventory, CalculatedAsset, BillCalculationResult } from '@/app/types'

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

    // 전체 선택 합계 계산
    const totalSupply = calculateSelectedTotal();
    const totalVat = Math.floor(totalSupply * 0.1);
    const grandTotal = totalSupply + totalVat;

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

                            // 거래처별 합계 (선택된 기계만)
                            const clientSupply = selectedDetails.reduce((sum, d) => sum + (d.isGroupLeader ? d.rowCost.total : 0), 0);
                            const clientVat = Math.floor(clientSupply * 0.1);
                            const clientTotal = clientSupply + clientVat;

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
                                        <thead>
                                            <tr>
                                                <th style={{ width: '25%' }}>기계명(S/N)</th>
                                                <th style={{ width: '15%' }}>전월</th>
                                                <th style={{ width: '15%' }}>당월</th>
                                                <th style={{ width: '15%' }}>실사용</th>
                                                <th style={{ width: '15%' }}>공급가</th>
                                                <th style={{ width: '15%' }}>부가세</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedDetails.map((d: CalculatedAsset) => {
                                                const rowSupply = d.isGroupLeader ? d.rowCost.total : 0;
                                                const rowVat = Math.floor(rowSupply * 0.1);
                                                
                                                return (
                                                    <tr key={d.inventory_id}>
                                                        <td style={{ textAlign: 'left' }}>
                                                            <div style={{fontSize: '0.7rem', marginBottom: '2px'}}>
                                                                {d.is_replacement_before && <span style={{color: '#ff4d4f', fontWeight: 'bold'}}>[교체전] </span>}
                                                                {d.is_replacement_after && <span style={{color: '#0070f3', fontWeight: 'bold'}}>[교체후] </span>}
                                                                {d.is_withdrawal && <span style={{color: '#8c8c8c', fontWeight: 'bold'}}>[철수] </span>}
                                                            </div>
                                                            <strong>{d.model_name}</strong><br />
                                                            <span style={{color: '#888', fontSize: '0.75rem'}}>{d.serial_number}</span>
                                                        </td>
                                                        <td>{d.prev.bw.toLocaleString()} / {d.prev.col.toLocaleString()}</td>
                                                        <td>{d.curr.bw.toLocaleString()} / {d.curr.col.toLocaleString()}</td>
                                                        <td>{d.converted.bw.toLocaleString()} / {d.converted.col.toLocaleString()}</td>
                                                        <td style={{ color: '#333' }}>{d.isGroupLeader ? rowSupply.toLocaleString() : '-'}</td>
                                                        <td style={{ color: '#666' }}>{d.isGroupLeader ? rowVat.toLocaleString() : '-'}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            );
                        })}
                    
                    {/* 최종 합계 요약 */}
                    <div className={styles.modalSummary} style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                        <div style={{ fontSize: '1rem', color: '#666' }}>
                           선택 기계: {selectedInventories.size}대
                        </div>
                        <div style={{ display: 'flex', gap: '20px', fontSize: '1.1rem', color: '#333' }}>
                            <span>총 공급가액: <b>{totalSupply.toLocaleString()}</b>원</span>
                            <span>+</span>
                            <span>총 부가세(10%): <b>{totalVat.toLocaleString()}</b>원</span>
                        </div>
                        <div style={{ fontSize: '1.4rem', color: 'var(--notion-blue)', fontWeight: 'bold', borderTop:'1px solid #ddd', paddingTop:'8px', marginTop:'4px' }}>
                           = 최종 청구 금액: {grandTotal.toLocaleString()} 원
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