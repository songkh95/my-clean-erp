'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  findLoginEmailsByNameAction,
  requestPasswordResetAction,
} from '@/app/actions/auth'
import styles from '../auth.module.css'

type Tab = 'id' | 'password'

export default function FindAccountPage() {
  const [tab, setTab] = useState<Tab>('id')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [emails, setEmails] = useState<string[]>([])

  const handleFindId = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')
    setEmails([])
    setLoading(true)
    const res = await findLoginEmailsByNameAction(name)
    setLoading(false)
    if (!res.success) {
      setErrorMsg(res.message)
      return
    }
    setEmails(res.emails)
    setSuccessMsg(res.message)
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')
    setLoading(true)
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const redirectTo = `${origin}/auth/callback?next=/auth/reset-password`
    const res = await requestPasswordResetAction(email, redirectTo)
    setLoading(false)
    if (!res.success) {
      setErrorMsg(res.message)
      return
    }
    setSuccessMsg(res.message)
  }

  return (
    <div className={styles.shell}>
      <div className={styles.card}>
        <p className={styles.brand}>My Clean ERP</p>
        <h1 className={styles.title}>계정 찾기</h1>
        <p className={styles.subtitle}>아이디(이메일)를 찾거나 비밀번호를 재설정합니다.</p>

        <div className={styles.modeRow}>
          <button
            type="button"
            className={`${styles.modeBtn} ${tab === 'id' ? styles.modeBtnActive : ''}`}
            onClick={() => {
              setTab('id')
              setErrorMsg('')
              setSuccessMsg('')
            }}
          >
            아이디 찾기
          </button>
          <button
            type="button"
            className={`${styles.modeBtn} ${tab === 'password' ? styles.modeBtnActive : ''}`}
            onClick={() => {
              setTab('password')
              setErrorMsg('')
              setSuccessMsg('')
            }}
          >
            비밀번호 찾기
          </button>
        </div>

        {errorMsg ? <div className={styles.error} style={{ marginTop: 12 }}>{errorMsg}</div> : null}
        {successMsg ? <div className={styles.success} style={{ marginTop: 12 }}>{successMsg}</div> : null}

        {tab === 'id' ? (
          <form className={styles.form} onSubmit={handleFindId} style={{ marginTop: 12 }}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="find-name">사용자 이름</label>
              <input
                id="find-name"
                className={styles.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="가입 시 등록한 이름"
                required
              />
              <span className={styles.hint}>일치하는 계정의 이메일을 일부만 가려서 보여 줍니다.</span>
            </div>
            {emails.length > 0 ? (
              <ul className={styles.list}>
                {emails.map((em) => (
                  <li key={em}>{em}</li>
                ))}
              </ul>
            ) : null}
            <button className={styles.submit} type="submit" disabled={loading}>
              {loading ? '찾는 중…' : '아이디 찾기'}
            </button>
          </form>
        ) : (
          <form className={styles.form} onSubmit={handleResetPassword} style={{ marginTop: 12 }}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="find-email">가입 이메일</label>
              <input
                id="find-email"
                className={styles.input}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                required
              />
              <span className={styles.hint}>재설정 링크가 이메일로 발송됩니다.</span>
            </div>
            <button className={styles.submit} type="submit" disabled={loading}>
              {loading ? '전송 중…' : '재설정 메일 보내기'}
            </button>
          </form>
        )}

        <div className={styles.links}>
          <Link href="/login">로그인으로</Link>
          <Link href="/signup">회원가입</Link>
        </div>
      </div>
    </div>
  )
}
