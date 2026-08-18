'use client'

import { useCallback, useEffect, useState } from 'react'
import Button from '@/components/ui/Button'
import { getQuoteBrandingAction } from '@/app/actions/quoteBranding'
import { removeQuoteBrandingImage, uploadQuoteBrandingImage } from '@/utils/quoteBrandingUpload'
import styles from '@/app/settings/settings.module.css'

export default function QuoteBrandingSettings() {
  const [stampUrl, setStampUrl] = useState('')
  const [hqLogoUrl, setHqLogoUrl] = useState('')
  const [busy, setBusy] = useState<'stamp' | 'hqLogo' | null>(null)
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    const res = await getQuoteBrandingAction()
    if (!res.success) {
      setMessage(res.message)
      return
    }
    setMessage('')
    setStampUrl(res.stampUrl || '')
    setHqLogoUrl(res.hqLogoUrl || '')
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const notify = () => {
    window.dispatchEvent(new Event('quote-branding-changed'))
  }

  const onUpload = async (kind: 'stamp' | 'hqLogo', file: File | undefined) => {
    if (!file) return
    setBusy(kind)
    const res = await uploadQuoteBrandingImage(kind, file)
    setBusy(null)
    if (!res.success) {
      alert(res.message)
      return
    }
    if (kind === 'stamp') setStampUrl(res.url || '')
    else setHqLogoUrl(res.url || '')
    notify()
  }

  const onDelete = async (kind: 'stamp' | 'hqLogo') => {
    if (!confirm(kind === 'stamp' ? '도장을 삭제할까요?' : '본사 로고를 삭제할까요?')) return
    setBusy(kind)
    const res = await removeQuoteBrandingImage(kind)
    setBusy(null)
    if (!res.success) {
      alert(res.message)
      return
    }
    if (kind === 'stamp') setStampUrl('')
    else setHqLogoUrl('')
    notify()
  }

  return (
    <>
      {message ? <p className={styles.hint}>{message}</p> : null}
      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label}>도장 이미지</label>
          {stampUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={stampUrl}
              alt="도장 미리보기"
              style={{ width: 96, height: 96, objectFit: 'contain', marginBottom: 8 }}
            />
          ) : (
            <div className={styles.hint}>등록된 도장 없음</div>
          )}
          <input
            type="file"
            accept="image/*"
            disabled={busy === 'stamp'}
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              onUpload('stamp', file)
            }}
          />
          {stampUrl ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy === 'stamp'}
              onClick={() => onDelete('stamp')}
              style={{ marginTop: 6 }}
            >
              도장 삭제
            </Button>
          ) : null}
        </div>
        <div className={styles.field}>
          <label className={styles.label}>본사 로고</label>
          {hqLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={hqLogoUrl}
              alt="본사 로고 미리보기"
              style={{ maxWidth: 180, maxHeight: 64, objectFit: 'contain', marginBottom: 8 }}
            />
          ) : (
            <div className={styles.hint}>등록된 로고 없음</div>
          )}
          <input
            type="file"
            accept="image/*"
            disabled={busy === 'hqLogo'}
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              onUpload('hqLogo', file)
            }}
          />
          {hqLogoUrl ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy === 'hqLogo'}
              onClick={() => onDelete('hqLogo')}
              style={{ marginTop: 6 }}
            >
              로고 삭제
            </Button>
          ) : null}
        </div>
      </div>
    </>
  )
}
