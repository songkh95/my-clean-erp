'use client'

import { useState } from 'react' //useState: 사용자가 입력창에 글자를 칠 때마다 그 글자를 컴퓨터가 기억하게 하는 상자입니다.
import { createClient } from '@/utils/supabase'  // 우리가 만든 연결 단말기
import { useRouter } from 'next/navigation' // 페이지 이동 도구

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const router = useRouter()
  const supabase = createClient()

  // [로그인 버튼을 눌렀을 때 실행되는 마법]
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault() // 페이지가 새로고침되는 것을 막아줘요

    // 수파베이스에게 "로그인시켜줘!"라고 말합니다.
    const { error } = await supabase.auth.signInWithPassword({ //signInWithPassword: 수파베이스가 미리 만들어둔 **'로그인 전용 도구'**입니다. 이메일과 비번만 던져주면 알아서 검사해 줍니다.
      email: email,
      password: password,
    })

    if (error) {
      alert('로그인 실패: ' + error.message)
    } else {
      alert('로그인 성공!')
      router.push('/') // 성공하면 첫 페이지로 이동!
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
        <button type="submit" style={{ backgroundColor: 'blue', color: 'white', cursor: 'pointer' }}>
          로그인하기
        </button>
      </form>
    </div>
  )
}