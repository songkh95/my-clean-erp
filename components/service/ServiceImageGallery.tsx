'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase'
import {
  deleteServiceImageAction,
  listServiceImagesAction,
} from '@/app/actions/service'
import styles from './ServiceImageGallery.module.css'

type GalleryImage = {
  id: string
  storage_path: string
  file_name: string | null
  url?: string
}

interface Props {
  logId: string | null
  clientName?: string
  locked?: boolean
  onClose: () => void
  /** 일지 수정 팝업으로 이동 (이미지 추가) */
  onEditLog?: () => void
}

export default function ServiceImageGallery({
  logId,
  clientName,
  locked = false,
  onClose,
  onEditLog,
}: Props) {
  const [images, setImages] = useState<GalleryImage[]>([])
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!logId || logId.startsWith('dummy_')) {
      setImages([])
      setLoading(false)
      return
    }
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const rows = await listServiceImagesAction(logId)
        if (cancelled) return
        const supabase = createClient()
        const withUrl: GalleryImage[] = []
        for (const row of rows as unknown as GalleryImage[]) {
          const { data } = await supabase.storage
            .from('service-attachments')
            .createSignedUrl(row.storage_path, 3600)
          withUrl.push({ ...row, url: data?.signedUrl })
        }
        setImages(withUrl)
        setActive(0)
      } catch (e: any) {
        if (!cancelled) setError(e?.message || '이미지를 불러오지 못했습니다.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [logId])

  const remove = async (img: GalleryImage) => {
    if (locked) return
    if (!confirm('이 사진을 삭제할까요?')) return
    const res = await deleteServiceImageAction(img.id, img.storage_path)
    if (!res.success) {
      alert(res.message || '삭제 실패')
      return
    }
    setImages((prev) => {
      const next = prev.filter((p) => p.id !== img.id)
      setActive((i) => Math.max(0, Math.min(i, next.length - 1)))
      return next
    })
  }

  if (!logId) return null

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.head}>
          <div>
            <h3 className={styles.title}>현장 사진</h3>
            <p className={styles.sub}>
              {clientName || '거래처'}
              {images.length > 0 ? ` · ${images.length}장` : ''}
            </p>
          </div>
          <button type="button" className={styles.close} onClick={onClose}>닫기</button>
        </div>

        {loading ? (
          <div className={styles.empty}>불러오는 중…</div>
        ) : error ? (
          <div className={styles.empty}>{error}</div>
        ) : images.length === 0 ? (
          <div className={styles.empty}>
            <p>등록된 사진이 없습니다.</p>
            <p className={styles.hint}>거래처명 또는 No를 더블클릭해 일지 수정에서 사진을 추가하세요.</p>
            {onEditLog && !locked && (
              <button type="button" className={styles.editBtn} onClick={onEditLog}>
                일지에서 사진 추가
              </button>
            )}
          </div>
        ) : (
          <>
            <div className={styles.main}>
              {images[active]?.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={images[active].url}
                  alt={images[active].file_name || `사진 ${active + 1}`}
                />
              ) : (
                <div className={styles.empty}>미리보기를 만들 수 없습니다.</div>
              )}
            </div>
            <div className={styles.thumbs}>
              {images.map((img, i) => (
                <button
                  key={img.id}
                  type="button"
                  className={`${styles.thumb} ${i === active ? styles.thumbActive : ''}`}
                  onClick={() => setActive(i)}
                >
                  {img.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img.url} alt="" />
                  ) : (
                    <span>{i + 1}</span>
                  )}
                </button>
              ))}
            </div>
            <div className={styles.footer}>
              <span className={styles.fileName}>
                {images[active]?.file_name || `${active + 1} / ${images.length}`}
              </span>
              <div className={styles.footerActions}>
                {onEditLog && !locked && (
                  <button type="button" className={styles.editBtn} onClick={onEditLog}>
                    사진 추가
                  </button>
                )}
                {!locked && (
                  <button
                    type="button"
                    className={styles.deleteBtn}
                    onClick={() => images[active] && remove(images[active])}
                  >
                    이 사진 삭제
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
