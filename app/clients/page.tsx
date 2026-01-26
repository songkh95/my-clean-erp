// app/clients/page.tsx

import ClientList from '@/components/ClientList'

export default function ClientsPage() {
  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      {/* 이제 모든 기능(등록 버튼 포함)이 ClientList 안에 있습니다 */}
      <ClientList />
    </div>
  )
}