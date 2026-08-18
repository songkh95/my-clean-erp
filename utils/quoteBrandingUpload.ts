import { createClient } from '@/utils/supabase'
import { getMyOrgIdAction } from '@/app/actions/service'
import {
  deleteQuoteBrandingImageAction,
  saveQuoteBrandingPathAction,
  type QuoteBrandingKind,
} from '@/app/actions/quoteBranding'
import { fileToResizedDataUrl } from '@/utils/imageDataUrl'

const BUCKET = 'quote-branding'

async function dataUrlToFile(dataUrl: string, fileName: string): Promise<File> {
  const res = await fetch(dataUrl)
  const blob = await res.blob()
  return new File([blob], fileName, { type: blob.type || 'image/png' })
}

function extFromFile(file: File): string {
  const t = (file.type || '').toLowerCase()
  if (t.includes('png')) return 'png'
  if (t.includes('webp')) return 'webp'
  if (t.includes('gif')) return 'gif'
  return 'jpg'
}

/** 설정에서 도장/본사 로고 업로드 → Storage + DB 경로 저장 */
export async function uploadQuoteBrandingImage(
  kind: QuoteBrandingKind,
  file: File
): Promise<{ success: boolean; message: string; url?: string | null }> {
  const orgId = await getMyOrgIdAction()
  if (!orgId) return { success: false, message: '조직 정보를 찾을 수 없습니다.' }

  const maxEdge = kind === 'stamp' ? 360 : 520
  let uploadFile = file
  try {
    const dataUrl = await fileToResizedDataUrl(file, maxEdge)
    uploadFile = await dataUrlToFile(dataUrl, file.name || `${kind}.jpg`)
  } catch {
    // 리사이즈 실패 시 원본 사용
  }

  const ext = extFromFile(uploadFile)
  const path = `${orgId}/${kind === 'stamp' ? 'stamp' : 'hq-logo'}.${ext}`
  const supabase = createClient()

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, uploadFile, {
    contentType: uploadFile.type || 'image/jpeg',
    upsert: true,
  })
  if (upErr) {
    return {
      success: false,
      message: /bucket|not found|row-level/i.test(upErr.message)
        ? '업로드 실패: supabase/migrations/add_quote_branding.sql 을 실행하세요.'
        : `업로드 실패: ${upErr.message}`,
    }
  }

  const saved = await saveQuoteBrandingPathAction(kind, path)
  if (!saved.success) return { success: false, message: saved.message }

  // 캐시 bust
  const url = saved.url ? `${saved.url}?t=${Date.now()}` : saved.url
  return { success: true, message: '저장되었습니다.', url }
}

export async function removeQuoteBrandingImage(kind: QuoteBrandingKind) {
  return deleteQuoteBrandingImageAction(kind)
}
