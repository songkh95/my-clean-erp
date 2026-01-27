'use client'

import React from 'react'
import styles from '@/app/accounting/accounting.module.css'

interface Props {
    selectedInventories: Set<string>
    calculateSelectedTotal: () => number
    clients: any[]
    inventoryMap: { [key: string]: any[] }
    calculateClientBill: (client: any) => any
    onClose: () => void
    onSave: () => void
}

export default function SettlementConfirmModal({
    selectedInventories, calculateSelectedTotal, clients, inventoryMap, calculateClientBill, onClose, onSave
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
                            return (
                                <div key={client.id} style={{ marginBottom: '40px', border: '1px solid #eee', padding: '15px', borderRadius: '8px' }}>
                                    <h3 style={{ color: '#0070f3', borderBottom: '2px solid #0070f3', paddingBottom: '8px', marginTop: 0 }}>{client.name}</h3>
                                    <table className={styles.modalTable}>
                                        <thead>
                                            <tr><th>기계명(S/N)</th><th>전월</th><th>당월</th><th>실사용</th><th>금액</th></tr>
                                        </thead>
                                        <tbody>
                                            {bill.details.filter((d: any) => selectedInventories.has(d.inventory_id)).map((d: any) => (
                                                <tr key={d.inventory_id}>
                                                    <td>{d.model_name}<br /><small>{d.serial_number}</small></td>
                                                    <td>{d.prev.bw}/{d.prev.col}</td>
                                                    <td>{d.curr.bw}/{d.curr.col}</td>
                                                    <td>{d.converted.bw}/{d.converted.col}</td>
                                                    <td style={{ fontWeight: 'bold' }}>{d.rowCost.total.toLocaleString()}원</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            );
                        })}
                    <div className={styles.modalSummary}>
                        총 청구 금액: <strong>{calculateSelectedTotal().toLocaleString()}</strong> 원 (선택 기계: {selectedInventories.size}대)
                    </div>
                </div>
                <div className={styles.modalActions}>
                    <button onClick={onClose} className={styles.btnCancel}>취소</button>
                    <button onClick={onSave} className={styles.btnConfirm}>확인 및 저장</button>
                </div>
            </div>
        </div>
    )
}