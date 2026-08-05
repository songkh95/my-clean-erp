'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase'
import styles from '../../login/auth.module.css'

export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = createClient()
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    if (password.length < 6) {
      setErrorMsg('비밀번호는 6자 이상이어야 합니다.')
      return
    }
    if (password !== password2) {
      setErrorMsg('비밀번호 확인이 일치하지 않습니다.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      setErrorMsg(error.message)
      return
    }

    setSuccessMsg('비밀번호가 변경되었습니다. 홈으로 이동합니다.')
    setTimeout(() => {
      router.push('/')
      router.refresh()
    }, 800)
  }

  return (
    <div className={styles.shell}>
      <div className={styles.card}>
        <p className={styles.brand}>My Clean ERP</p>
        <h1 className={styles.title}>새 비밀번호</h1>
        <p className={styles.subtitle}>메일 링크로 인증된 후 새 비밀번호를 설정하세요.</p>

        <form className={styles.form} onSubmit={handleSubmit}>
          {errorMsg ? <div className={styles.error}>{errorMsg}</div> : null}
          {successMsg ? <div className={styles.success}>{successMsg}</div> : null}

          <div className={styles.field}>
            <label className={styles.label} htmlFor="npw">새 비밀번호</label>
            <input
              id="npw"
              className={styles.input}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="npw2">새 비밀번호 확인</label>
            <input
              id="npw2"
              className={styles.input}
              type="password"
              autoComplete="new-password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              minLength={6}
              required
            />
          </div>

          <button className={styles.submit} type="submit" disabled={loading}>
            {loading ? '저장 중…' : '비밀번호 저장'}
          </button>

          <div className={styles.links}>
            <Link href="/login">로그인</Link>
          </div>
        </form>
      </div>
    </div>
  )
}
