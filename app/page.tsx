'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState('')
  const [orgName, setOrgName] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const fetchUserData = async () => {
      // 1. 로그인한 유저 정보 가져오기
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        // 2. 프로필과 조직 이름을 한 번에 가져오는 마법의 쿼리!
        // profiles 테이블에서 내 정보를 찾고, 연결된 organizations 테이블에서 name만 가져와라!
        const { data: profile } = await supabase
          .from('profiles')
          .select(`
            name,
            organizations (
              name
            )
          `)
          .eq('id', user.id)
          .single()

        if (profile) {
          setUserName(profile.name)
          // @ts-ignore (조직 이름 데이터 구조 대응)
          setOrgName(profile.organizations?.name || '소속 없음')
        }
      }
      setLoading(false)
    }

    fetchUserData()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) return <div style={{ padding: '20px' }}>데이터를 불러오는 중...</div>

  return (
    <div style={{ padding: '0' }}>
      {/* 상단 헤더 영역 */}
      <header style={{ 
        display: 'flex', 
        justifyContent: 'between', 
        alignItems: 'center', 
        padding: '10px 20px', 
        backgroundColor: '#333', 
        color: 'white' 
      }}>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>🧼 My Clean ERP</span>
        </div>
        
        <div style={{ textAlign: 'right' }}>
          <span style={{ marginRight: '15px' }}>
            <strong>{orgName}</strong> | {userName} 님 환영합니다
          </span>
          <button onClick={handleLogout} style={{ padding: '5px 10px', cursor: 'pointer' }}>
            로그아웃
          </button>
        </div>
      </header>

      {/* 메인 컨텐츠 영역 */}
      <main style={{ padding: '40px', textAlign: 'center' }}>
        <h1>🏠 메인 대시보드</h1>
        <p>우리 회사({orgName})의 데이터를 관리하는 공간입니다.</p>
        
        <div style={{ marginTop: '30px' }}>
          <button 
            onClick={() => router.push('/clients/new')}
            style={{ padding: '15px 30px', fontSize: '1.1rem', cursor: 'pointer' }}
          >
            ➕ 새 거래처 등록하기
          </button>
        </div>
      </main>
    </div>
  )
}