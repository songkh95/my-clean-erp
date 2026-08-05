'use client'

import { useEffect, useState, useRef, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase'
import { finalizeSignupFromMetadataAction } from '@/app/actions/auth'
import styles from '../../login/auth.module.css'

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

function VerifiedContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pendingHash = searchParams.get('pending') === '1'

  const [status, setStatus] = useState<'working' | 'ok' | 'error'>('working')
  const [message, setMessage] = useState('이메일 확인 처리 중…')
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    let cancelled = false
    const supabase = createClient()

    const finish = async () => {
      try {
        // 구형 링크: URL 해시에 access_token 이 있는 경우
        if (typeof window !== 'undefined' && window.location.hash.includes('access_token')) {
          const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
          const access_token = hash.get('access_token')
          const refresh_token = hash.get('refresh_token')
          if (access_token && refresh_token) {
            await supabase.auth.setSession({ access_token, refresh_token })
            window.history.replaceState(null, '', window.location.pathname + window.location.search)
          }
        }

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          if (pendingHash) {
            if (!cancelled) {
              setStatus('ok')
              setMessage('이메일 확인이 완료되었습니다. 로그인하여 이용해 주세요.')
              setTimeout(() => {
                if (!cancelled) window.location.replace('/login?verified=1')
              }, 1200)
            }
            return
          }
          if (!cancelled) {
            setStatus('error')
            setMessage('세션을 확인할 수 없습니다. 로그인 화면에서 다시 로그인해 주세요.')
          }
          return
        }

        const result = await withTimeout(finalizeSignupFromMetadataAction(), 8000)
        if (cancelled) return

        if (!result || !result.ok) {
          setStatus('error')
          const msg = result?.message || '가입 마무리에 시간이 초과되었습니다.'
          setMessage(
            msg.includes('function') || msg.includes('schema cache')
              ? '가입 마무리 DB 함수가 없습니다. sql/auth_profiles_signup.sql 실행 후 다시 로그인해 주세요.'
              : msg
          )
          return
        }

        setStatus('ok')
        setMessage(
          result.alreadyDone
            ? '이메일 확인이 완료되었고, 이미 가입이 끝난 계정입니다. 로그인하여 이용해 주세요.'
            : '이메일 확인과 회원가입이 완료되었습니다. 로그인하여 이용해 주세요.'
        )

        await supabase.auth.signOut()
        setTimeout(() => {
          if (!cancelled) window.location.replace('/login?verified=1')
        }, 1200)
      } catch (err) {
        if (!cancelled) {
          setStatus('error')
          setMessage(err instanceof Error ? err.message : '처리 중 오류가 발생했습니다.')
        }
      }
    }

    finish()
    return () => {
      cancelled = true
    }
  }, [pendingHash, router])

  return (
    <div className={styles.shell}>
      <div className={styles.card}>
        <p className={styles.brand}>My Clean ERP</p>
        <h1 className={styles.title}>
          {status === 'working' ? '확인 중' : status === 'ok' ? '가입 완료' : '확인 실패'}
        </h1>
        <p className={styles.subtitle}>{message}</p>

        {status === 'ok' ? (
          <div className={styles.success}>이메일 인증이 완료되었습니다. 곧 로그인 화면으로 이동합니다.</div>
        ) : null}
        {status === 'error' ? <div className={styles.error}>{message}</div> : null}

        <div className={styles.links} style={{ marginTop: 20 }}>
          <Link href="/login">로그인으로 이동</Link>
        </div>
      </div>
    </div>
  )
}

export default function AuthVerifiedPage() {
  return (
    <Suspense fallback={
      <div className={styles.shell}>
        <div className={styles.card}>
          <p className={styles.hint}>처리 중…</p>
        </div>
      </div>
    }>
      <VerifiedContent />
    </Suspense>
  )
}
