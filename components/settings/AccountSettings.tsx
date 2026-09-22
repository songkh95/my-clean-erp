'use client'

import { useEffect, useState } from 'react'
import Button from '@/components/ui/Button'
import {
  changePasswordAction,
  getMyProfileAction,
  updateMyNameAction,
  getOrgBusinessInfoAction,
  updateOrgBusinessInfoAction,
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

  // 홈택스 일괄등록 엑셀 등에 쓰이는 우리 회사(공급자) 사업자 정보
  const [bizNumber, setBizNumber] = useState('')
  const [bizRepName, setBizRepName] = useState('')
  const [bizAddress, setBizAddress] = useState('')
  const [bizEmail, setBizEmail] = useState('')
  const [bizType, setBizType] = useState('')
  const [bizItem, setBizItem] = useState('')
  const [bizMsg, setBizMsg] = useState('')
  const [bizErr, setBizErr] = useState('')
  const [savingBiz, setSavingBiz] = useState(false)

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

      const bizRes = await getOrgBusinessInfoAction()
      if (cancelled) return
      if (bizRes.success && bizRes.data) {
        setBizNumber(bizRes.data.business_number || '')
        setBizRepName(bizRes.data.representative_name || '')
        setBizAddress(bizRes.data.address || '')
        setBizEmail(bizRes.data.email || '')
        setBizType(bizRes.data.business_type || '')
        setBizItem(bizRes.data.business_item || '')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const saveBizInfo = async () => {
    setBizMsg('')
    setBizErr('')
    setSavingBiz(true)
    const res = await updateOrgBusinessInfoAction({
      businessNumber: bizNumber,
      representativeName: bizRepName,
      address: bizAddress,
      email: bizEmail,
      businessType: bizType,
      businessItem: bizItem,
    })
    setSavingBiz(false)
    if (!res.success) {
      setBizErr(res.message)
      return
    }
    setBizMsg(res.message)
  }

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

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>사업자 정보 (우리 회사)</h2>
        <p className={styles.cardDesc}>
          홈택스 세금계산서 일괄등록 엑셀을 만들 때 '공급자' 정보로 자동 채워집니다.
        </p>

        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label}>사업자등록번호 (- 없이)</label>
            <input
              className={styles.input}
              value={bizNumber}
              onChange={(e) => setBizNumber(e.target.value)}
              placeholder="예: 5193301796"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>대표자명</label>
            <input className={styles.input} value={bizRepName} onChange={(e) => setBizRepName(e.target.value)} />
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>사업장 주소</label>
          <input className={styles.input} value={bizAddress} onChange={(e) => setBizAddress(e.target.value)} />
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label}>업태</label>
            <input className={styles.input} value={bizType} onChange={(e) => setBizType(e.target.value)} placeholder="예: 서비스업" />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>종목</label>
            <input className={styles.input} value={bizItem} onChange={(e) => setBizItem(e.target.value)} placeholder="예: 복합기 임대 및 유지보수" />
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>이메일</label>
          <input className={styles.input} value={bizEmail} onChange={(e) => setBizEmail(e.target.value)} />
        </div>

        {bizErr ? <p className={styles.hint} style={{ color: '#b91c1c' }}>{bizErr}</p> : null}
        {bizMsg ? <p className={styles.hint} style={{ color: '#0f7b3a' }}>{bizMsg}</p> : null}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="primary" type="button" onClick={saveBizInfo} disabled={savingBiz}>
            {savingBiz ? '저장 중…' : '사업자 정보 저장'}
          </Button>
        </div>
      </div>
    </>
  )
}
