'use client'

import { useEffect, useState } from 'react'
import Button from '@/components/ui/Button'
import {
  changePasswordAction,
  getMyProfileAction,
  updateMyNameAction,
} from '@/app/actions/auth'
import styles from '@/app/settings/settings.module.css'

export default function AccountSettings() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [orgName, setOrgName] = useState('')
  const [orgId, setOrgId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [nameMsg, setNameMsg] = useState('')
  const [nameErr, setNameErr] = useState('')
  const [savingName, setSavingName] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPassword2, setNewPassword2] = useState('')
  const [pwMsg, setPwMsg] = useState('')
  const [pwErr, setPwErr] = useState('')
  const [savingPw, setSavingPw] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const res = await getMyProfileAction()
      if (cancelled) return
      setLoading(false)
      if (!res.success) {
        setNameErr(res.message)
        return
      }
      setEmail(res.email)
      setName(res.profile?.name || '')
      setOrgName(res.profile?.organizationName || '')
      setOrgId(res.profile?.organizationId || null)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const saveName = async () => {
    setNameMsg('')
    setNameErr('')
    setSavingName(true)
    const res = await updateMyNameAction(name)
    setSavingName(false)
    if (!res.success) {
      setNameErr(res.message)
      return
    }
    setNameMsg(res.message)
  }

  const savePassword = async () => {
    setPwMsg('')
    setPwErr('')
    if (newPassword !== newPassword2) {
      setPwErr('새 비밀번호 확인이 일치하지 않습니다.')
      return
    }
    setSavingPw(true)
    const res = await changePasswordAction(currentPassword, newPassword)
    setSavingPw(false)
    if (!res.success) {
      setPwErr(res.message)
      return
    }
    setPwMsg(res.message)
    setCurrentPassword('')
    setNewPassword('')
    setNewPassword2('')
  }

  if (loading) {
    return <p className={styles.cardDesc}>계정 정보를 불러오는 중…</p>
  }

  return (
    <>
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>내 계정</h2>
        <p className={styles.cardDesc}>
          사용자 이름은 서비스 일지 <strong>담당자</strong> 등 화면 전체에 표시되는 이름입니다.
        </p>

        <div className={styles.field}>
          <label className={styles.label}>로그인 이메일 (아이디)</label>
          <input className={styles.input} value={email} disabled readOnly />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>사용자 이름</label>
          <input
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 홍길동"
          />
          <span className={styles.hint}>일지 담당자 목록·헤더 등에 사용됩니다.</span>
        </div>

        {orgName ? (
          <div className={styles.field}>
            <label className={styles.label}>회사(조직)</label>
            <input className={styles.input} value={orgName} disabled readOnly />
          </div>
        ) : null}

        {orgId ? (
          <div className={styles.field}>
            <label className={styles.label}>조직 코드 (동료 초대용)</label>
            <input className={styles.input} value={orgId} readOnly onFocus={(e) => e.currentTarget.select()} />
            <span className={styles.hint}>회원가입 → 기존 회사 참여 시 이 코드를 공유하세요.</span>
          </div>
        ) : null}

        {nameErr ? <p className={styles.hint} style={{ color: '#b91c1c' }}>{nameErr}</p> : null}
        {nameMsg ? <p className={styles.hint} style={{ color: '#0f7b3a' }}>{nameMsg}</p> : null}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="primary" type="button" onClick={saveName} disabled={savingName}>
            {savingName ? '저장 중…' : '이름 저장'}
          </Button>
        </div>
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>비밀번호 변경</h2>
        <p className={styles.cardDesc}>현재 비밀번호 확인 후 새 비밀번호로 변경합니다.</p>

        <div className={styles.field}>
          <label className={styles.label}>현재 비밀번호</label>
          <input
            className={styles.input}
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </div>
        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label}>새 비밀번호</label>
            <input
              className={styles.input}
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={6}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>새 비밀번호 확인</label>
            <input
              className={styles.input}
              type="password"
              autoComplete="new-password"
              value={newPassword2}
              onChange={(e) => setNewPassword2(e.target.value)}
              minLength={6}
            />
          </div>
        </div>

        {pwErr ? <p className={styles.hint} style={{ color: '#b91c1c' }}>{pwErr}</p> : null}
        {pwMsg ? <p className={styles.hint} style={{ color: '#0f7b3a' }}>{pwMsg}</p> : null}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="primary" type="button" onClick={savePassword} disabled={savingPw}>
            {savingPw ? '변경 중…' : '비밀번호 변경'}
          </Button>
        </div>
      </div>
    </>
  )
}
