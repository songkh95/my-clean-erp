'use client'

import { useState } from 'react'
import ClientForm from '@/components/ClientForm'
import ClientList from '@/components/ClientList'

export default function ClientsPage() {
  // [공부포인트] refreshTrigger는 "새로고침 벨"이에요. 
  // 등록창에서 벨을 누르면 목록창이 소리를 듣고 데이터를 다시 가져옵니다.
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1)
  }

  return (
    // 배경색과 패딩을 주어 사진처럼 깔끔하게 만듭니다.
    <div style={{ padding: '30px', backgroundColor: '#f5f7f9', minHeight: '100vh' }}>
      <h2 style={{ marginBottom: '20px', color: '#333' }}>👥 거래처 관리 시스템</h2>
      
      {/* 왼쪽(400px 고정)과 오른쪽(나머지 전체) 배치 */}
      <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
        
        {/* 왼쪽: 신규 등록 폼 */}
        <div style={{ width: '400px', flexShrink: 0 }}>
          <ClientForm onSuccess={handleRefresh} />
        </div>

        {/* 오른쪽: 거래처 목록 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <ClientList refreshTrigger={refreshTrigger} />
        </div>

      </div>
    </div>
  )
}