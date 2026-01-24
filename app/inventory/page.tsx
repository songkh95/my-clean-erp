'use client'

import { useState } from 'react'
// 🔴 파일명이 정확히 대소문자까지 일치해야 에러가 안 납니다!
import InventoryForm from '../../components/InventoryForm' 
import InventoryList from '../../components/InventoryList' 

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState('복합기 및 프린터')
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const tabs = ['복합기 및 프린터', '소모품', '부품', '기타']

  return (
    <div style={{ padding: '30px', backgroundColor: '#f5f7f9', minHeight: '100vh' }}>
      <h2 style={{ marginBottom: '20px' }}>📦 자산 및 재고 관리</h2>

      {/* 상단 탭 메뉴 */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '10px 20px', borderRadius: '8px', border: 'none',
              backgroundColor: activeTab === tab ? '#0070f3' : '#fff',
              color: activeTab === tab ? '#fff' : '#333',
              cursor: 'pointer', fontWeight: 'bold'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
        {/* 왼쪽: 아이템 추가 */}
        <div style={{ width: '400px', flexShrink: 0 }}>
          <InventoryForm type={activeTab} onSuccess={() => setRefreshTrigger(prev => prev + 1)} />
        </div>

        {/* 오른쪽: 아이템 목록 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <InventoryList type={activeTab} refreshTrigger={refreshTrigger} />
        </div>
      </div>
    </div>
  )
}