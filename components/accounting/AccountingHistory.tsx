'use client'

import React from 'react'
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
}

export default function AccountingHistory({
  isHistOpen, setIsHistOpen, histYear, setHistYear, histMonth, setHistMonth, historyList, handleDeleteHistory
}: Props) {
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
              <input type="number" value={histYear} onChange={e => setHistYear(Number(e.target.value))} className={styles.input} style={{ width: '80px' }} />
              <span>년</span>
              <input type="number" value={histMonth} onChange={e => setHistMonth(Number(e.target.value))} className={styles.input} style={{ width: '60px' }} />
              <span>월 내역 조회</span>
            </div>
          </div>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>청구월</th>
                  <th className={styles.th}>거래처명</th>
                  <th className={styles.th}>총 사용량 (흑/칼)</th>
                  <th className={styles.th}>최종 청구액</th>
                  <th className={styles.th}>관리</th>
                </tr>
              </thead>
              <tbody>
                {historyList.length === 0 ? (
                  <tr><td colSpan={5} className={styles.td} style={{ color: '#999', padding: '30px' }}>조회된 내역이 없습니다.</td></tr>
                ) : historyList.map(hist => (
                  <tr key={hist.id}>
                    <td className={styles.td}>{hist.billing_year}-{hist.billing_month}</td>
                    <td className={styles.td} style={{ fontWeight: 'bold' }}>{hist.client?.name}</td>
                    <td className={styles.td}>{hist.total_usage_bw?.toLocaleString()} / {hist.total_usage_col?.toLocaleString()}</td>
                    <td className={styles.td} style={{ color: '#0070f3', fontWeight: 'bold' }}>{hist.total_amount?.toLocaleString()}원</td>
                    <td className={styles.td}>
                      <button onClick={() => handleDeleteHistory(hist.id)} style={{ color: 'red', border: '1px solid #eee', background: 'white', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px' }}>삭제</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}