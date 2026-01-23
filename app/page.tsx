'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase'
import { useRouter } from 'next/navigation' // 1. 페이지 이동을 위해 추가

export default function HomePage() {
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState('')
  const [orgName, setOrgName] = useState('')
  const supabase = createClient()
  const router = useRouter() // 2. 라우터 초기화

  useEffect(() => {
    const fetchUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select(`name, organizations ( name )`)
          .eq('id', user.id)
          .single()

        if (profile) {
          setUserName(profile.name)
          // @ts-ignore
          setOrgName(profile.organizations?.name || '소속 없음')
        }
      }
      setLoading(false)
    }
    fetchUserData()
  }, [])

  // 3. ✨ 로그아웃 일꾼(함수) 만들기
  const handleLogout = async () => {
    await supabase.auth.signOut() // 수파베이스에게 로그아웃 알리기
    alert('로그아웃 되었습니다.')
    router.push('/login') // 로그인 페이지로 보내기
  }

  if (loading) return <div style={{ padding: '20px' }}>데이터를 불러오는 중...</div>

  return (
    <div style={{ padding: '0' }}>
      {/* 상단 헤더 영역 - 이전 스타일 유지 */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between', // between으로 오타 수정
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
          <button onClick={handleLogout} style={{ padding: '5px 10px', cursor: 'pointer', borderRadius: '4px' }}>
            로그아웃
          </button>
        </div>
      </header>

      {/* 메인 내용 (대시보드 청소 버전) */}
      <main style={{ padding: '40px' }}>
        <h1 style={{ fontSize: '2rem' }}>🏠 홈 대시보드</h1>
        <p style={{ color: '#666' }}>오늘도 화이팅하세요! 왼쪽 메뉴를 통해 거래처를 관리할 수 있습니다.</p>
      </main>
    </div>
  )
}