// app/clients/page.tsx

import ClientList from '@/components/client/ClientList'

export default function ClientsPage() {
  return (
    <div className="pageShell">
      {/* 이제 모든 기능(등록 버튼 포함)이 ClientList 안에 있습니다 */}
      <ClientList />
    </div>
  )
}