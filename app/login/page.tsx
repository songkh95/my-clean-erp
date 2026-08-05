'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase'
import { useSearchParams } from 'next/navigation'
import { finalizeSignupFromMetadataAction } from '@/app/actions/auth'
import styles from './auth.module.css'

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms)
    promise
      .then((v) => {
        clearTimeout(timer)
        resolve(v)
      })
      .catch(() => {
        clearTimeout(timer)
        resolve(null)
      })
  })
}

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const supabase = createClient()
  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  const verified = searchParams.get('verified')

  useEffect(() => {
    if (error === 'unauthorized') {
      setErrorMsg('로그인이 필요합니다. 계정으로 로그인해 주세요.')
    }
    if (error === 'auth_callback') {
      setErrorMsg('이메일 확인 처리에 실패했습니다. 링크가 만료되었을 수 있습니다.')
    }
    if (verified === '1') {
      setSuccessMsg('이메일 확인과 회원가입이 완료되었습니다. 로그인해 주세요.')
    }
  }, [error, verified])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')
    setLoading(true)

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (authError) {
        setErrorMsg(
          authError.message === 'Invalid login credentials'
            ? '이메일 또는 비밀번호가 올바르지 않습니다.'
            : authError.message
        )
        return
      }

      const user = data.user
      const meta = (user?.user_metadata || {}) as Record<string, unknown>
      const needsFinalize =
        Boolean(meta.pending_signup) ||
        Boolean(meta.org_name) ||
        Boolean(meta.org_code)

      // 신규 가입 마무리만 시도 (기존 계정은 스킵). 최대 4초 — 멈춰도 로그인 진행
      if (needsFinalize) {
        await withTimeout(finalizeSignupFromMetadataAction(), 4000)
      }

      // 쿠키가 확실히 반영되도록 전체 이동 (router.push는 세션 미반영 루프가 날 수 있음)
      window.location.assign('/')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '로그인 중 오류가 발생했습니다.')
      setLoading(false)
    }
  }

  return (
    <form className={styles.form} onSubmit={handleLogin}>
      {errorMsg ? <div className={styles.error}>{errorMsg}</div> : null}
      {successMsg ? <div className={styles.success}>{successMsg}</div> : null}

      <div className={styles.field}>
        <label className={styles.label} htmlFor="login-email">이메일 (아이디)</label>
        <input
          id="login-email"
          className={styles.input}
          type="email"
          autoComplete="email"
          placeholder="name@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="login-password">비밀번호</label>
        <input
          id="login-password"
          className={styles.input}
          type="password"
          autoComplete="current-password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      <button className={styles.submit} type="submit" disabled={loading}>
        {loading ? '로그인 중…' : '로그인'}
      </button>

      <div className={styles.links}>
        <Link href="/signup">회원가입</Link>
        <Link href="/login/find">아이디 · 비밀번호 찾기</Link>
      </div>
    </form>
  )
}

export default function LoginPage() {
  return (
    <div className={styles.shell}>
      <div className={styles.card}>
        <p className={styles.brand}>My Clean ERP</p>
        <h1 className={styles.title}>로그인</h1>
        <p className={styles.subtitle}>서비스 일지 · 거래처 · 재고를 관리하려면 로그인하세요.</p>
        <Suspense fallback={<div className={styles.hint}>로딩 중…</div>}>
          <LoginForm />
        </Suspense>
        <p className={styles.hint} style={{ marginTop: 16, textAlign: 'center' }}>
          서버 확인: <a href="/api/which-project" target="_blank" rel="noreferrer">/api/which-project</a>
        </p>
      </div>
    </div>
  )
}
