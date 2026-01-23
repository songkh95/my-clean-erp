'use client'

import ClientForm from '@/components/ClientForm' // ✨ 만들어둔 부품 불러오기

export default function ClientsPage() {
  return (
    <div style={{ padding: '40px' }}>
      <h1>👥 거래처 관리</h1>
      <p style={{ color: '#666' }}>새로운 거래처를 등록하거나 목록을 확인하세요.</p>

      <div style={{ marginTop: '30px', display: 'flex', gap: '40px' }}>
        {/* 왼쪽: 나중에 거래처 목록 표가 들어올 자리 */}
        <div style={{ flex: 2 }}>
          <div style={{ padding: '20px', border: '1px dashed #ccc', textAlign: 'center' }}>
            <h3>거래처 목록</h3>
            <p>내일 여기에 실제 표(Table)를 만들어서 넣을 거예요!</p>
          </div>
        </div>

        {/* 오른쪽: 우리가 만든 등록 폼 부품 배치! */}
        <div style={{ flex: 1 }}>
          <ClientForm />
        </div>
      </div>
    </div>
  )
}