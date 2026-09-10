'use client'

import React, { useEffect, useState } from 'react'
import InventoryList from '@/components/inventory/InventoryList'
import ConsumableList from '@/components/inventory/ConsumableList'
import InventoryForm from '@/components/inventory/InventoryForm'
import PendingStockPanel from '@/components/inventory/PendingStockPanel'
import ClientExcelModal from '@/components/client/ClientExcelModal'
import PanelRefreshButton from '@/components/ui/PanelRefreshButton'
import styles from './inventory.module.css'

type InventoryTab = 'machines' | 'consumables' | 'parts' | 'others'
const TAB_KEY = 'inventory-active-tab'

function loadTab(): InventoryTab {
  try {
    const v = sessionStorage.getItem(TAB_KEY)
    if (v === 'machines' || v === 'consumables' || v === 'parts' || v === 'others') return v
  } catch { /* ignore */ }
  return 'machines'
}

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState<InventoryTab>('machines')
  const [tabReady, setTabReady] = useState(false)

  const [isMachineModalOpen, setIsMachineModalOpen] = useState(false)
  const [excelModalOpen, setExcelModalOpen] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [pendingRefresh, setPendingRefresh] = useState(0)
  const [machineCount, setMachineCount] = useState(0)

  useEffect(() => {
    setActiveTab(loadTab())
    setTabReady(true)
  }, [])

  const selectTab = (tab: InventoryTab) => {
    setActiveTab(tab)
    try {
      sessionStorage.setItem(TAB_KEY, tab)
    } catch { /* ignore */ }
  }

  if (!tabReady) {
    return <div className={styles.container} />
  }

  return (
    <div className={styles.container}>
      <PendingStockPanel
        refreshKey={pendingRefresh}
        onGoConsumables={() => selectTab('consumables')}
      />

      <div className={styles.tabs}>
        <div
          className={`${styles.tab} ${activeTab === 'machines' ? styles.tabActive : ''}`}
          onClick={() => selectTab('machines')}
        >
          🖨️ 기기
        </div>
        <div
          className={`${styles.tab} ${activeTab === 'consumables' ? styles.tabActive : ''}`}
          onClick={() => selectTab('consumables')}
        >
          🧴 소모품
        </div>
        <div
          className={`${styles.tab} ${activeTab === 'parts' ? styles.tabActive : ''}`}
          onClick={() => selectTab('parts')}
        >
          ⚙️ 부품
        </div>
        <div
          className={`${styles.tab} ${activeTab === 'others' ? styles.tabActive : ''}`}
          onClick={() => selectTab('others')}
        >
          🔧 기타
        </div>
      </div>

      {activeTab === 'machines' && (
        <div>
          <div className={styles.headerSection}>
            <h2 className={styles.title}>
              전체 자산 목록 <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--notion-sub-text)' }}>({machineCount})</span>
            </h2>
            <div style={{ display: 'flex', gap: 8 }}>
              <PanelRefreshButton
                onRefresh={async () => {
                  setRefreshTrigger((prev) => prev + 1)
                  setPendingRefresh((prev) => prev + 1)
                }}
              />
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
          <InventoryList type="all" refreshTrigger={refreshTrigger} onCountChange={setMachineCount} />

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
