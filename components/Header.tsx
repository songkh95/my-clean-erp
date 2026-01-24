'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase'
import { useRouter } from 'next/navigation'

export default function Header() {
  const [userName, setUserName] = useState('')
  const [orgName, setOrgName] = useState('')
  const supabase = createClient()
  const router = useRouter()

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
    }
    fetchUserData()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    alert('로그아웃 되었습니다.')
    router.push('/login')
  }

  return (
    <header style={{
      //display: 'flex',
      //justifyContent: 'space-between',
      alignItems: 'center',
      padding: '10px 20px',
      backgroundColor: '#333',
      color: 'white',
      height: '60px' // 높이 고정
    }}>
   
      <div style={{ textAlign: 'right' }}>
        <span style={{ marginRight: '15px' }}>
          <strong>{orgName}</strong> | {userName} 님
        </span>
        <button onClick={handleLogout} style={{ padding: '5px 10px', cursor: 'pointer', borderRadius: '4px' }}>
          로그아웃
        </button>
      </div>
    </header>
  )
}