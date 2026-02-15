'use client'

import React, { useState, useEffect } from 'react'
import Button from '@/components/ui/Button'
import ServiceForm from '@/components/service/ServiceForm'
import styles from './service.module.css' // ✅ 여기가 핵심: service.module.css를 사용해야 합니다
import { getServiceLogsAction, deleteServiceLogAction } from '@/app/actions/service'
import { ServiceLog } from '@/app/types'
import Link from 'next/link'

export default function ServicePage() {
  const [logs, setLogs] = useState<ServiceLog[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  
  // 수정용 상태
  const [selectedLog, setSelectedLog] = useState<ServiceLog | null>(null)

  const fetchLogs = async () => {
    setLoading(true)
    const result = await getServiceLogsAction()
    if (result.success) {
      setLogs(result.data as unknown as ServiceLog[])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchLogs()
  }, [])

  // 수정 버튼 핸들러
  const handleEdit = (log: ServiceLog) => {
    setSelectedLog(log)
    setIsModalOpen(true)
  }

  // 삭제 버튼 핸들러
  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까? (완료된 건은 재고가 복구됩니다)')) return
    
    const result = await deleteServiceLogAction(id)
    if (result.success) {
      alert('삭제되었습니다.')
      fetchLogs()
    } else {
      alert(result.message)
    }
  }

  // 팝업 닫기 (데이터 초기화)
  const handleClose = () => {
    setIsModalOpen(false)
    setSelectedLog(null)
  }

  return (
    <div className={styles.container}>
      <div className={styles.headerSection}>
        <h2 className={styles.title}>🛠️ 서비스 / A.S 일지</h2>
        <Button onClick={() => { setSelectedLog(null); setIsModalOpen(true); }}>+ 일지 작성</Button>
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th} style={{width: '70px'}}>상태</th>
              <th className={styles.th} style={{width: '90px'}}>방문일자</th>
              <th className={styles.th} style={{width: '70px'}}>구분</th>
              <th className={styles.th} style={{width: '140px'}}>거래처명</th>
              <th className={styles.th} style={{width: '160px'}}>기기정보 (S/N)</th>
              <th className={styles.th} style={{width: '180px'}}>증상/요청</th>
              <th className={styles.th} style={{width: '220px'}}>조치내용</th>
              <th className={styles.th} style={{width: '150px'}}>교체/배송</th>
              <th className={styles.th} style={{width: '70px'}}>담당자</th>
              <th className={styles.th} style={{width: '90px'}}>관리</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className={styles.td} style={{textAlign:'center', padding:'20px'}}>로딩 중...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={10} className={styles.td} style={{textAlign:'center', padding:'20px'}}>기록이 없습니다.</td></tr>
            ) : (
              logs.map((log) => {
                const isDummy = log.status === '미방문';

                return (
                  <tr key={log.id} className={styles.tr}>
                    <td className={styles.td} style={{textAlign:'center'}}>
                      <span className={`${styles.badge} ${
                        log.status === '완료' ? styles.statusCompleted : 
                        log.status === '보류' ? styles.statusHold : 
                        log.status === '미방문' ? styles.statusUnvisited : styles.statusReceived
                      }`}>
                        {log.status}
                      </span>
                    </td>
                    <td className={styles.td} style={{textAlign:'center', color: log.visit_date === '-' ? '#ccc' : 'inherit'}}>
                      {log.visit_date}
                    </td>
                    <td className={styles.td} style={{textAlign:'center'}}>{log.service_type}</td>
                    <td className={styles.td}>
                      <Link href={`/clients?search=${log.client?.name}`} className={styles.link}>
                        {log.client?.name}
                      </Link>
                    </td>
                    <td className={styles.td}>
                      {log.inventory ? (
                        <span title={log.inventory.serial_number}>
                          {log.inventory.model_name} <span style={{color:'#888', fontSize:'0.75rem'}}>({log.inventory.serial_number})</span>
                        </span>
                      ) : <span style={{color:'#ccc'}}>-</span>}
                    </td>
                    <td className={styles.td} title={log.symptom || ''}>{log.symptom}</td>
                    <td className={styles.td} title={log.action_detail || ''}>{log.action_detail}</td>
                    <td className={styles.td} style={{fontSize:'0.8rem', color:'#555'}}>
                      {log.parts_usage && log.parts_usage.length > 0 
                        ? log.parts_usage.map(p => `${p.consumable?.model_name}(${p.quantity})`).join(', ')
                        : '-'}
                    </td>
                    <td className={styles.td} style={{textAlign:'center'}}>{log.manager?.name}</td>
                    
                    <td className={styles.td} style={{textAlign:'center'}}>
                      {!isDummy && (
                        <div style={{display:'flex', gap:'4px', justifyContent:'center'}}>
                          <button 
                            onClick={() => handleEdit(log)}
                            className={styles.actionBtn}
                            style={{color: '#0070f3', borderColor: '#0070f3'}}
                          >
                            수정
                          </button>
                          <button 
                            onClick={() => handleDelete(log.id)}
                            className={styles.actionBtn}
                            style={{color: '#d93025', borderColor: '#d93025'}}
                          >
                            삭제
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <ServiceForm 
        isOpen={isModalOpen} 
        onClose={handleClose} 
        onSuccess={fetchLogs}
        editData={selectedLog}
      />
    </div>
  )
}