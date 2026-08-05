'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase'
import { completeSignupAction, joinOrganizationAction } from '@/app/actions/auth'
import styles from '../login/auth.module.css'

type Mode = 'create' | 'join'

export default function SignupPage() {
  const router = useRouter()
  const supabase = createClient()

  const [mode, setMode] = useState<Mode>('create')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [orgName, setOrgName] = useState('')
  const [orgCode, setOrgCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [awaitingEmail, setAwaitingEmail] = useState(false)

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
    if (!name.trim()) {
      setErrorMsg('사용자 이름(담당자 표시명)을 입력해 주세요.')
      return
    }
    if (mode === 'create' && !orgName.trim()) {
      setErrorMsg('회사(조직) 이름을 입력해 주세요.')
      return
    }
    if (mode === 'join' && !orgCode.trim()) {
      setErrorMsg('조직 코드를 입력해 주세요.')
      return
    }

    setLoading(true)

    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const emailRedirectTo = `${origin}/auth/callback?next=/auth/verified`

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo,
        data: {
          name: name.trim(),
          display_name: name.trim(),
          signup_mode: mode,
          org_name: mode === 'create' ? orgName.trim() : '',
          org_code: mode === 'join' ? orgCode.trim() : '',
          pending_signup: true,
        },
      },
    })

    if (error) {
      setLoading(false)
      setErrorMsg(error.message)
      return
    }

    // 이메일 확인 필요 (세션 없음)
    if (!data.session) {
      setLoading(false)
      setAwaitingEmail(true)
      setSuccessMsg(
        `${email.trim()} 으로 확인 메일을 보냈습니다. 메일함에서 링크를 누르면 가입이 완료되고 로그인 화면으로 안내됩니다.`
      )
      return
    }

    const result =
      mode === 'create'
        ? await completeSignupAction(orgName, name)
        : await joinOrganizationAction(orgCode, name)

    setLoading(false)

    if (!result.ok) {
      setErrorMsg(
        result.message.includes('function') || result.message.includes('schema cache')
          ? '회원가입 DB 함수가 없습니다. Supabase에서 sql/auth_profiles_signup.sql 을 실행한 뒤 다시 시도해 주세요.'
          : result.message
      )
      return
    }

    setSuccessMsg('가입이 완료되었습니다. 로그인 화면으로 이동합니다.')
    await supabase.auth.signOut()
    router.push('/login?verified=1')
    router.refresh()
  }

  if (awaitingEmail) {
    return (
      <div className={styles.shell}>
        <div className={styles.card}>
          <p className={styles.brand}>My Clean ERP</p>
          <h1 className={styles.title}>이메일 확인</h1>
          <p className={styles.subtitle}>가입을 마치려면 메일 인증이 필요합니다.</p>
          <div className={styles.success}>{successMsg}</div>
          <p className={styles.hint} style={{ marginTop: 14 }}>
            메일의 링크를 클릭하면 「가입 완료」 안내 후 로그인 화면으로 이동합니다.
            메일이 없으면 스팸함을 확인해 주세요.
          </p>
          <div className={styles.links}>
            <Link href="/login">로그인 화면으로</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.shell}>
      <div className={styles.card}>
        <p className={styles.brand}>My Clean ERP</p>
        <h1 className={styles.title}>회원가입</h1>
        <p className={styles.subtitle}>
          여기서 등록한 이름은 서비스 일지 <strong>담당자</strong> 등에 표시됩니다.
        </p>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.modeRow}>
            <button
              type="button"
              className={`${styles.modeBtn} ${mode === 'create' ? styles.modeBtnActive : ''}`}
              onClick={() => setMode('create')}
            >
              새 회사 만들기
            </button>
            <button
              type="button"
              className={`${styles.modeBtn} ${mode === 'join' ? styles.modeBtnActive : ''}`}
              onClick={() => setMode('join')}
            >
              기존 회사 참여
            </button>
          </div>

          {mode === 'create' ? (
            <p className={styles.hint}>
              새 회사는 데이터가 비어 있는 새 공간입니다. 지금까지 쓰던 데이터를 보려면
              「기존 회사 참여」로 조직 코드를 입력하거나, 예전 계정으로 로그인하세요.
            </p>
          ) : (
            <p className={styles.hint}>
              기존 회사의 거래처·일지 등을 같이 쓰려면, 이미 쓰는 계정의 설정 → 계정에 있는 조직 코드가 필요합니다.
            </p>
          )}

          {errorMsg ? <div className={styles.error}>{errorMsg}</div> : null}
          {successMsg ? <div className={styles.success}>{successMsg}</div> : null}

          <div className={styles.field}>
            <label className={styles.label} htmlFor="su-name">사용자 이름</label>
            <input
              id="su-name"
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 홍길동"
              required
            />
            <span className={styles.hint}>일지 담당자 목록에 이 이름으로 표시됩니다.</span>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="su-email">이메일 (아이디)</label>
            <input
              id="su-email"
              className={styles.input}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="su-pw">비밀번호</label>
            <input
              id="su-pw"
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
            <label className={styles.label} htmlFor="su-pw2">비밀번호 확인</label>
            <input
              id="su-pw2"
              className={styles.input}
              type="password"
              autoComplete="new-password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              minLength={6}
              required
            />
          </div>

          {mode === 'create' ? (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="su-org">회사(조직) 이름</label>
              <input
                id="su-org"
                className={styles.input}
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="예: ○○사무기"
                required
              />
            </div>
          ) : (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="su-code">조직 코드</label>
              <input
                id="su-code"
                className={styles.input}
                value={orgCode}
                onChange={(e) => setOrgCode(e.target.value)}
                placeholder="기존 회사의 조직 UUID"
                required
              />
              <span className={styles.hint}>설정 → 계정에서 확인할 수 있는 조직 코드를 입력하세요.</span>
            </div>
          )}

          <button className={styles.submit} type="submit" disabled={loading}>
            {loading ? '가입 중…' : '가입하기'}
          </button>

          <div className={styles.links}>
            <Link href="/login">이미 계정이 있나요? 로그인</Link>
          </div>
        </form>
      </div>
    </div>
  )
}
