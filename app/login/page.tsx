'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase'
import { useRouter, useSearchParams } from 'next/navigation'

export default function LoginPage() {

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const router = useRouter()
  const supabase = createClient()
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  // 경고창 띄우기 로직
  useEffect(() => {
    if (error === 'unauthorized') {
      alert('⚠️ 로그인 없이 접속할 수 없습니다. 먼저 로그인해 주세요!')
    }
  }, [error])
  
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()

    const { error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    })

    if (error) {
      alert('로그인 실패: ' + error.message)
    } else {
      alert('로그인 성공!')
      router.push('/')
      router.refresh() // 메인 화면 정보를 새로고침하기 위해 추가
    }
  }

  return (
    <div style={{ padding: '40px', maxWidth: '400px', margin: '0 auto' }}>
      <h1>ERP 로그인</h1>
      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <input 
          type="email" 
          placeholder="이메일 입력" 
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required 
        />
        <input 
          type="password" 
          placeholder="비밀번호 입력" 
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required 
        />
        <button type="submit" style={{ backgroundColor: 'blue', color: 'white', cursor: 'pointer', padding: '10px' }}>
          로그인하기
        </button>
      </form>
    </div>
  )
}