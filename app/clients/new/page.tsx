'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase'
import { useRouter } from 'next/navigation'

export default function NewClientPage() {
  const router = useRouter()
  const supabase = createClient()
  
  // 1. 현재 로그인한 사람의 회사 ID를 저장할 상자
  const [myOrgId, setMyOrgId] = useState<string | null>(null)

  // 2. 11개 항목을 담은 '종합 선물 세트' 상자
  const [formData, setFormData] = useState({
    name: '',
    business_number: '',
    representative_name: '',
    contact_person: '',
    phone: '',
    office_phone: '',
    email: '',
    address: '',
    status: 'active',
    popup_memo: ''
  })

  // 3. 페이지가 열리자마자 내 회사 ID를 알아내기
useEffect(() => {
  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    
    // [보안 추가] 로그인한 유저 정보가 없으면?
    if (!user) {
      alert('로그인이 필요한 페이지입니다.')
      router.push('/login') // 로그인 페이지로 강제 이동!
      return
    }

    // 로그인 확인 후 조직 정보 가져오기
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single()
    
    if (profile) setMyOrgId(profile.organization_id)
  }
  checkUser()
}, [])

  // 4. 입력창에 글자를 칠 때 실행되는 통합 함수
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,     // 기존 내용물은 그대로 두고
      [name]: value // 바뀐 칸(name)만 새 값(value)으로 갈아 끼우기!
    }))
  }

  const handleSave = async () => {
    if (!myOrgId) return alert('조직 정보를 불러오는 중입니다.')

    // 5. 드디어 DB에 저장!
    const { error } = await supabase
      .from('clients')
      .insert([{ ...formData, organization_id: myOrgId }])

    if (error) {
      alert('에러 발생: ' + error.message)
    } else {
      alert('새 거래처가 등록되었습니다!')
      router.push('/')
    }
  }

  return (
    <div style={{ padding: '20px', maxWidth: '600px' }}>
      <h1>🏰 새 거래처 등록</h1>
      
      {/* 입력 칸들 (예시로 3개만 먼저 적었습니다. 나머지도 같은 방식!) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <input name="name" placeholder="업체명 (필수)" onChange={handleChange} />
        <input name="business_number" placeholder="사업자번호" onChange={handleChange} />
        <input name="representative_name" placeholder="대표자명" onChange={handleChange} />
        <input name="contact_person" placeholder="담당자명" onChange={handleChange} />
        <input name="phone" placeholder="핸드폰 번호" onChange={handleChange} />
        <textarea name="popup_memo" placeholder="알림 메모" onChange={handleChange} />
        
        <button onClick={handleSave} style={{ padding: '15px', backgroundColor: '#0070f3', color: 'white', border: 'none', borderRadius: '5px' }}>
          거래처 저장하기
        </button>
      </div>
    </div>
  )
}