'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

const BUCKET = 'quote-branding'

export type QuoteBrandingKind = 'stamp' | 'hqLogo'

async function requireOrg() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { supabase, error: '로그인이 필요합니다.' as string, orgId: null as string | null }
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()
  if (!profile?.organization_id) {
    return { supabase, error: '조직 정보를 찾을 수 없습니다.', orgId: null }
  }
  return { supabase, error: null, orgId: profile.organization_id as string }
}

function schemaHint(msg: string) {
  if (/quote_branding|quote-branding|schema cache/i.test(msg)) {
    return 'DB에 견적서 브랜딩 테이블/버킷이 없습니다. supabase/migrations/add_quote_branding.sql 을 실행하세요.'
  }
  return msg
}

function publicUrl(supabase: Awaited<ReturnType<typeof createClient>>, path: string | null | undefined) {
  if (!path) return null
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl || null
}

export async function getQuoteBrandingAction() {
  const { supabase, error: authErr, orgId } = await requireOrg()
  if (authErr || !orgId) {
    return {
      success: false as const,
      message: authErr || '권한 없음',
      stampUrl: null as string | null,
      hqLogoUrl: null as string | null,
      stampPath: null as string | null,
      hqLogoPath: null as string | null,
    }
  }

  const { data, error } = await supabase
    .from('quote_branding')
    .select('stamp_path, hq_logo_path')
    .eq('organization_id', orgId)
    .maybeSingle()

  if (error) {
    return {
      success: false as const,
      message: schemaHint(error.message),
      stampUrl: null,
      hqLogoUrl: null,
      stampPath: null,
      hqLogoPath: null,
    }
  }

  return {
    success: true as const,
    message: 'ok',
    stampPath: data?.stamp_path || null,
    hqLogoPath: data?.hq_logo_path || null,
    stampUrl: publicUrl(supabase, data?.stamp_path),
    hqLogoUrl: publicUrl(supabase, data?.hq_logo_path),
  }
}

export async function saveQuoteBrandingPathAction(kind: QuoteBrandingKind, path: string) {
  const { supabase, error: authErr, orgId } = await requireOrg()
  if (authErr || !orgId) return { success: false as const, message: authErr || '권한 없음' }

  const { data: existing } = await supabase
    .from('quote_branding')
    .select('organization_id, stamp_path, hq_logo_path')
    .eq('organization_id', orgId)
    .maybeSingle()

  const oldPath = kind === 'stamp' ? existing?.stamp_path : existing?.hq_logo_path
  if (oldPath && oldPath !== path) {
    await supabase.storage.from(BUCKET).remove([oldPath])
  }

  const patch =
    kind === 'stamp'
      ? { stamp_path: path, updated_at: new Date().toISOString() }
      : { hq_logo_path: path, updated_at: new Date().toISOString() }

  const { error } = existing
    ? await supabase.from('quote_branding').update(patch).eq('organization_id', orgId)
    : await supabase.from('quote_branding').insert({ organization_id: orgId, ...patch })

  if (error) return { success: false as const, message: schemaHint(error.message) }

  revalidatePath('/quotes')
  revalidatePath('/settings')
  return { success: true as const, message: '저장되었습니다.', url: publicUrl(supabase, path) }
}

export async function deleteQuoteBrandingImageAction(kind: QuoteBrandingKind) {
  const { supabase, error: authErr, orgId } = await requireOrg()
  if (authErr || !orgId) return { success: false as const, message: authErr || '권한 없음' }

  const { data } = await supabase
    .from('quote_branding')
    .select('stamp_path, hq_logo_path')
    .eq('organization_id', orgId)
    .maybeSingle()

  const path = kind === 'stamp' ? data?.stamp_path : data?.hq_logo_path
  if (path) {
    await supabase.storage.from(BUCKET).remove([path])
  }

  const patch =
    kind === 'stamp'
      ? { stamp_path: null, updated_at: new Date().toISOString() }
      : { hq_logo_path: null, updated_at: new Date().toISOString() }

  if (data) {
    const { error } = await supabase.from('quote_branding').update(patch).eq('organization_id', orgId)
    if (error) return { success: false as const, message: schemaHint(error.message) }
  }

  revalidatePath('/quotes')
  revalidatePath('/settings')
  return { success: true as const, message: '삭제되었습니다.' }
}
