'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase'
import {
  deleteServiceImageAction,
  getMyOrgIdAction,
  listServiceImagesAction,
  registerServiceImageAction,
} from '@/app/actions/service'
import styles from './ServiceImages.module.css'

type LocalFile = { id: string; file: File; preview: string }
type SavedImage = {
  id: string
  storage_path: string
  file_name: string | null
  url?: string
}

interface Props {
  /** 수정 시 기존 일지 ID. 신규는 저장 후 uploadPending 호출 */
  logId?: string | null
  disabled?: boolean
  pendingFiles: LocalFile[]
  onPendingChange: (files: LocalFile[]) => void
}

const MAX_FILES = 8
const MAX_MB = 5

export default function ServiceImages({
  logId,
  disabled = false,
  pendingFiles,
  onPendingChange,
}: Props) {
  const [saved, setSaved] = useState<SavedImage[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!logId || logId.startsWith('dummy_')) {
      setSaved([])
      return
    }
    let cancelled = false
    const load = async () => {
      setLoading(true)
      const rows = await listServiceImagesAction(logId)
      if (cancelled) return
      const supabase = createClient()
      const withUrl: SavedImage[] = []
      for (const row of rows as SavedImage[]) {
        const { data } = await supabase.storage
          .from('service-attachments')
          .createSignedUrl(row.storage_path, 3600)
        withUrl.push({ ...row, url: data?.signedUrl })
      }
      setSaved(withUrl)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [logId])

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (files.length === 0) return

    const next = [...pendingFiles]
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        alert(`${file.name}: 이미지 파일만 올릴 수 있습니다.`)
        continue
      }
      if (file.size > MAX_MB * 1024 * 1024) {
        alert(`${file.name}: ${MAX_MB}MB 이하만 가능합니다.`)
        continue
      }
      if (saved.length + next.length >= MAX_FILES) {
        alert(`이미지는 최대 ${MAX_FILES}장까지입니다.`)
        break
      }
      next.push({
        id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        file,
        preview: URL.createObjectURL(file),
      })
    }
    onPendingChange(next)
  }

  const removePending = (id: string) => {
    const target = pendingFiles.find((f) => f.id === id)
    if (target) URL.revokeObjectURL(target.preview)
    onPendingChange(pendingFiles.filter((f) => f.id !== id))
  }

  const removeSaved = async (img: SavedImage) => {
    if (disabled) return
    if (!confirm('이 이미지를 삭제할까요?')) return
    const res = await deleteServiceImageAction(img.id, img.storage_path)
    if (!res.success) {
      alert(res.message || '삭제 실패')
      return
    }
    setSaved((prev) => prev.filter((s) => s.id !== img.id))
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <span className={styles.title}>현장 사진</span>
        <label className={styles.uploadBtn}>
          이미지 추가
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={disabled}
            onChange={onPick}
            hidden
          />
        </label>
      </div>
      <p className={styles.hint}>jpg/png 등 · 장당 {MAX_MB}MB · 최대 {MAX_FILES}장</p>

      {loading && <p className={styles.hint}>이미지 불러오는 중…</p>}

      <div className={styles.grid}>
        {saved.map((img) => (
          <div key={img.id} className={styles.thumb}>
            {img.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={img.url} alt={img.file_name || '첨부'} />
            ) : (
              <div className={styles.placeholder}>{img.file_name || '이미지'}</div>
            )}
            {!disabled && (
              <button type="button" className={styles.remove} onClick={() => removeSaved(img)}>✕</button>
            )}
          </div>
        ))}
        {pendingFiles.map((f) => (
          <div key={f.id} className={styles.thumb}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={f.preview} alt={f.file.name} />
            <span className={styles.badge}>대기</span>
            {!disabled && (
              <button type="button" className={styles.remove} onClick={() => removePending(f.id)}>✕</button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Storage 객체 키: ASCII만 허용 (한글 파일명 → Invalid key 방지) */
function toStorageFileName(originalName: string) {
  const extMatch = originalName.match(/\.([a-zA-Z0-9]{1,8})$/)
  const ext = extMatch ? extMatch[1].toLowerCase() : 'jpg'
  const base = originalName
    .replace(/\.[^.]+$/, '')
    .normalize('NFKD')
    .replace(/[^\w.\-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40)
  const safeBase = base && /^[\w.\-]+$/.test(base) ? base : 'image'
  return `${Date.now()}_${safeBase}.${ext}`
}

/** 일지 저장 후 대기 중인 파일 업로드 */
export async function uploadPendingServiceImages(
  logId: string,
  pending: LocalFile[]
): Promise<{ ok: boolean; message?: string }> {
  if (pending.length === 0) return { ok: true }

  const orgId = await getMyOrgIdAction()
  if (!orgId) return { ok: false, message: '조직 정보를 찾을 수 없습니다.' }

  const supabase = createClient()

  for (const item of pending) {
    const fileName = toStorageFileName(item.file.name)
    const path = `${orgId}/${logId}/${fileName}`
    const { error: upErr } = await supabase.storage
      .from('service-attachments')
      .upload(path, item.file, { contentType: item.file.type || 'image/jpeg', upsert: false })

    if (upErr) {
      return {
        ok: false,
        message: `이미지 업로드 실패: ${upErr.message}`,
      }
    }

    const reg = await registerServiceImageAction({
      service_log_id: logId,
      storage_path: path,
      file_name: item.file.name,
    })
    if (!reg.success) {
      return { ok: false, message: reg.message || '이미지 메타 저장 실패' }
    }
  }

  return { ok: true }
}

export type { LocalFile }
