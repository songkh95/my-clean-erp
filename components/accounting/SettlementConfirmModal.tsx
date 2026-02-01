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
    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
                <div className={styles.modalTitle}>🧾 청구서 최종 확인</div>

                <div style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: '10px' }}>
                    {clients
                        .filter(client => (inventoryMap[client.id] || []).some(a => selectedInventories.has(a.id)))
                        .map((client) => {
                            const bill = calculateClientBill(client);
                            // 선택된 기계만 필터링
                            const selectedDetails = bill.details.filter(d => selectedInventories.has(d.inventory_id));
                            
                            if (selectedDetails.length === 0) return null;

                            return (
                                <div key={client.id} style={{ marginBottom: '30px', border: '1px solid #eee', padding: '20px', borderRadius: '8px' }}>
                                    <h3 style={{ color: 'var(--notion-blue)', borderBottom: '1px solid #eee', paddingBottom: '10px', marginTop: 0, fontSize: '1.1rem' }}>{client.name}</h3>
                                    <table className={styles.modalTable}>
                                        <thead>
                                            <tr>
                                                <th style={{ width: '30%' }}>기계명(S/N)</th>
                                                <th style={{ width: '15%' }}>전월</th>
                                                <th style={{ width: '15%' }}>당월</th>
                                                <th style={{ width: '20%' }}>실사용</th>
                                                <th style={{ width: '20%' }}>금액</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedDetails.map((d: CalculatedAsset) => (
                                                <tr key={d.inventory_id}>
                                                    <td style={{ textAlign: 'left' }}>
                                                        <div style={{fontSize: '0.7rem', marginBottom: '2px'}}>
                                                            {/* 🔴 수정됨: d.inv.flag -> d.flag 로 변경 (직접 접근) */}
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
                                                    <td style={{ fontWeight: 'bold', color: 'var(--notion-main-text)' }}>{d.rowCost.total.toLocaleString()}원</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            );
                        })}
                    <div className={styles.modalSummary}>
                        총 청구 금액: <span style={{ color: 'var(--notion-blue)', fontSize: '1.2rem', marginLeft: '8px' }}>{calculateSelectedTotal().toLocaleString()}</span> 원 
                        <span style={{ fontSize: '0.9rem', color: '#666', marginLeft: '8px', fontWeight: 'normal' }}>(선택 기계: {selectedInventories.size}대)</span>
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