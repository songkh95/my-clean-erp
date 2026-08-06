'use client'

import React, { useState } from 'react'
import InventoryList from '@/components/inventory/InventoryList'
import ConsumableList from '@/components/inventory/ConsumableList'
import InventoryForm from '@/components/inventory/InventoryForm'
import ClientExcelModal from '@/components/client/ClientExcelModal'
import styles from './inventory.module.css'

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState<'machines' | 'consumables' | 'parts' | 'others'>('machines')

  const [isMachineModalOpen, setIsMachineModalOpen] = useState(false)
  const [excelModalOpen, setExcelModalOpen] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  return (
    <div className={styles.container}>
      <div className={styles.tabs}>
        <div
          className={`${styles.tab} ${activeTab === 'machines' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('machines')}
        >
          🖨️ 기기
        </div>
        <div
          className={`${styles.tab} ${activeTab === 'consumables' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('consumables')}
        >
          🧴 소모품
        </div>
        <div
          className={`${styles.tab} ${activeTab === 'parts' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('parts')}
        >
          ⚙️ 부품
        </div>
        <div
          className={`${styles.tab} ${activeTab === 'others' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('others')}
        >
          🔧 기타
        </div>
      </div>

      {activeTab === 'machines' && (
        <div>
          <div className={styles.headerSection}>
            <h2 className={styles.title}>전체 자산 목록</h2>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => setExcelModalOpen(true)}
                className={styles.secondaryBtn}
              >
                엑셀
              </button>
              <button
                type="button"
                onClick={() => setIsMachineModalOpen(true)}
                className={styles.primaryBtn}
              >
                + 기기 추가
              </button>
            </div>
          </div>
          <InventoryList type="all" refreshTrigger={refreshTrigger} />

          <InventoryForm
            isOpen={isMachineModalOpen}
            onClose={() => setIsMachineModalOpen(false)}
            onSuccess={() => setRefreshTrigger((prev) => prev + 1)}
          />
          <ClientExcelModal
            isOpen={excelModalOpen}
            onClose={() => setExcelModalOpen(false)}
            onImported={() => setRefreshTrigger((prev) => prev + 1)}
          />
        </div>
      )}

      {activeTab === 'consumables' && <ConsumableList tab="consumables" />}
      {activeTab === 'parts' && <ConsumableList tab="parts" />}
      {activeTab === 'others' && <ConsumableList tab="others" />}
    </div>
  )
}
