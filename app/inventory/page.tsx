'use client'

import React, { useState } from 'react'
import InventoryList from '@/components/inventory/InventoryList'
import ConsumableList from '@/components/inventory/ConsumableList'
import InventoryForm from '@/components/inventory/InventoryForm'
import styles from './inventory.module.css'

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState<'machines' | 'consumables' | 'parts' | 'others'>('machines')
  
  // 기기 등록용 모달 상태 (기존 코드 유지)
  const [isMachineModalOpen, setIsMachineModalOpen] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  // 탭 스타일링 헬퍼
  const getTabStyle = (tabName: string) => ({
    padding: '10px 20px',
    cursor: 'pointer',
    fontWeight: activeTab === tabName ? '700' : '500',
    color: activeTab === tabName ? '#0070f3' : '#666',
    borderBottom: activeTab === tabName ? '2px solid #0070f3' : '2px solid transparent',
    transition: 'all 0.2s'
  })

  return (
    <div className={styles.container}>
      {/* 상단 탭 메뉴 */}
      <div style={{ borderBottom: '1px solid #e5e5e5', display: 'flex', gap: '8px', marginBottom: 'var(--page-title-mb)' }}>
        <div onClick={() => setActiveTab('machines')} style={getTabStyle('machines')}>🖨️ 기기(Assets)</div>
        <div onClick={() => setActiveTab('consumables')} style={getTabStyle('consumables')}>🧴 소모품(토너/드럼)</div>
        <div onClick={() => setActiveTab('parts')} style={getTabStyle('parts')}>⚙️ 부품(Parts)</div>
        <div onClick={() => setActiveTab('others')} style={getTabStyle('others')}>🔧 기타 자재</div>
      </div>

      {/* 탭 컨텐츠 */}
      {activeTab === 'machines' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 className={styles.title}>📦 전체 자산 목록</h2>
            <button 
              onClick={() => setIsMachineModalOpen(true)} 
              className={styles.primaryBtn}
            >
              + 기기 추가
            </button>
          </div>
          {/* 기존 InventoryList에 refreshTrigger 전달하여 업데이트 시 목록 갱신 */}
          <InventoryList type="all" refreshTrigger={refreshTrigger} />
          
          <InventoryForm 
            isOpen={isMachineModalOpen}
            onClose={() => setIsMachineModalOpen(false)}
            onSuccess={() => setRefreshTrigger(prev => prev + 1)}
          />
        </div>
      )}

      {activeTab === 'consumables' && <ConsumableList tab="consumables" />}
      {activeTab === 'parts' && <ConsumableList tab="parts" />}
      {activeTab === 'others' && <ConsumableList tab="others" />}
    </div>
  )
}