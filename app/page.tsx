'use client' // 버튼 클릭 같은 상호작용을 위해 필요합니다.

import { useEffect, useState } from 'react'
import { createClient } from '../utils/supabase' // 파일 위치에 맞게 수정했습니다.
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const [loading, setLoading] = useState(true)
  const [orgName, setOrgName] = useState('')
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    // 1. 현재 로그인한 사용자가 있는지 확인합니다.
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        // 로그인 안 되어 있으면 로그인 페이지로 보냅니다.
        router.push('/login')
      } else {
        // 로그인 되어 있으면 회사 이름을 가져옵니다.
        const { data } = await supabase.from('organizations').select('name').single()
        if (data) setOrgName(data.name)
        setLoading(false)
      }
    }
    checkUser()
  }, [])

  // 2. 로그아웃 함수
  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) return <p>로딩 중...</p>

  return (
    <div style={{ padding: '40px' }}>
      <h1>🏰 {orgName} ERP 메인</h1>
      <hr />
      <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
        {/* 나중에 이곳에 '거래처 관리', '기기 관리' 버튼을 만들 거예요. */}
        <button 
          onClick={() => router.push('/clients')}
          style={{ padding: '10px 20px', cursor: 'pointer' }}
        >
          📁 거래처 관리
        </button>
        
        <button 
          onClick={handleLogout}
          style={{ padding: '10px 20px', backgroundColor: '#ff4d4f', color: 'white', border: 'none', cursor: 'pointer' }}
        >
          로그아웃
        </button>
      </div>
    </div>
  )
}