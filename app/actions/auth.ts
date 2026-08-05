'use server'

import { createClient } from '@/utils/supabase/server'

type RpcJson = { ok?: boolean; message?: string; organization_id?: string }

async function callRpc(name: string, args: Record<string, unknown>) {
  const supabase = await createClient()
  // generated Database types에 RPC가 없을 수 있어 any 캐스팅
  const { data, error } = await (supabase as any).rpc(name, args)
  if (error) return { ok: false as const, message: error.message }
  const json = data as RpcJson
  if (json && typeof json === 'object' && 'ok' in json && json.ok === false) {
    return { ok: false as const, message: json.message || '요청에 실패했습니다.' }
  }
  return { ok: true as const, message: json?.message, organizationId: json?.organization_id }
}

/** 이메일 확인/로그인 직후: user_metadata로 조직·프로필 마무리 */
export async function finalizeSignupFromMetadataAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, message: '로그인이 필요합니다.', alreadyDone: false }

  let profile: { organization_id: string | null; name: string | null } | null = null
  try {
    const res = await supabase
      .from('profiles')
      .select('organization_id, name')
      .eq('id', user.id)
      .maybeSingle()
    profile = res.data
  } catch {
    profile = null
  }

  if (profile?.organization_id) {
    return {
      ok: true as const,
      message: '이미 가입이 완료된 계정입니다.',
      alreadyDone: true,
      organizationId: profile.organization_id,
    }
  }

  const meta = (user.user_metadata || {}) as Record<string, unknown>
  const displayName = String(meta.display_name || meta.name || '').trim() || (user.email?.split('@')[0] || '사용자')
  const mode = String(meta.signup_mode || 'create')
  const orgName = String(meta.org_name || '').trim()
  const orgCode = String(meta.org_code || '').trim()
  const pending = meta.pending_signup === true || Boolean(orgName) || Boolean(orgCode)

  // 기존 계정(메타데이터 없음)은 RPC 호출하지 않음 — 로그인 지연/무한대기 방지
  if (!pending) {
    return {
      ok: true as const,
      message: '추가 가입 절차가 없습니다.',
      alreadyDone: true,
      organizationId: undefined,
    }
  }

  let result: { ok: true; message?: string; organizationId?: string } | { ok: false; message: string }

  if (mode === 'join') {
    if (!orgCode) {
      return { ok: false as const, message: '조직 코드가 없어 가입을 완료할 수 없습니다. 다시 회원가입해 주세요.', alreadyDone: false }
    }
    result = await callRpc('join_organization', {
      p_org_id: orgCode,
      p_display_name: displayName,
    })
  } else {
    if (!orgName) {
      return {
        ok: false as const,
        message: '회사 이름이 없어 가입을 완료할 수 없습니다. 다시 회원가입해 주세요.',
        alreadyDone: false,
      }
    }
    result = await callRpc('complete_signup', {
      p_org_name: orgName,
      p_display_name: displayName,
    })
  }

  if (!result.ok) {
    return { ok: false as const, message: result.message, alreadyDone: false }
  }

  try {
    await supabase.auth.updateUser({
      data: {
        ...meta,
        pending_signup: false,
        signup_completed: true,
      },
    })
  } catch {
    /* ignore */
  }

  return {
    ok: true as const,
    message: result.message || '회원가입이 완료되었습니다.',
    alreadyDone: false,
    organizationId: result.organizationId,
  }
}

export async function getMyProfileAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false as const, message: '로그인이 필요합니다.' }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, name, organization_id, role, organization:organizations(id, name)')
    .eq('id', user.id)
    .maybeSingle()

  if (error) return { success: false as const, message: error.message }

  return {
    success: true as const,
    email: user.email || '',
    profile: profile
      ? {
          id: profile.id,
          name: profile.name || '',
          organizationId: profile.organization_id,
          role: profile.role,
          organizationName: (profile as any).organization?.name || '',
        }
      : null,
  }
}

export async function updateMyNameAction(name: string) {
  const trimmed = name.trim()
  if (!trimmed) return { success: false as const, message: '이름을 입력해 주세요.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false as const, message: '로그인이 필요합니다.' }

  const { error } = await supabase
    .from('profiles')
    .update({ name: trimmed, updated_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) return { success: false as const, message: error.message }
  return { success: true as const, message: '이름이 저장되었습니다.' }
}

export async function changePasswordAction(currentPassword: string, newPassword: string) {
  if (!currentPassword) return { success: false as const, message: '현재 비밀번호를 입력해 주세요.' }
  if (!newPassword || newPassword.length < 6) {
    return { success: false as const, message: '새 비밀번호는 6자 이상이어야 합니다.' }
  }
  if (currentPassword === newPassword) {
    return { success: false as const, message: '새 비밀번호가 현재와 같습니다.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return { success: false as const, message: '로그인이 필요합니다.' }

  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  })
  if (reauthError) {
    return { success: false as const, message: '현재 비밀번호가 올바르지 않습니다.' }
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) return { success: false as const, message: error.message }
  return { success: true as const, message: '비밀번호가 변경되었습니다.' }
}

export async function completeSignupAction(orgName: string, displayName: string) {
  return callRpc('complete_signup', {
    p_org_name: orgName.trim(),
    p_display_name: displayName.trim(),
  })
}

export async function joinOrganizationAction(orgId: string, displayName: string) {
  const id = orgId.trim()
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return { ok: false as const, message: '조직 코드(UUID) 형식이 올바르지 않습니다.' }
  }
  return callRpc('join_organization', {
    p_org_id: id,
    p_display_name: displayName.trim(),
  })
}

export async function findLoginEmailsByNameAction(name: string) {
  const trimmed = name.trim()
  if (!trimmed) return { success: false as const, message: '이름을 입력해 주세요.', emails: [] as string[] }

  const supabase = await createClient()
  const { data, error } = await (supabase as any).rpc('find_login_emails_by_name', {
    p_name: trimmed,
  })

  if (error) {
    return {
      success: false as const,
      message: error.message.includes('function')
        ? '아이디 찾기 기능이 아직 DB에 없습니다. sql/auth_profiles_signup.sql 을 실행해 주세요.'
        : error.message,
      emails: [] as string[],
    }
  }

  const emails = (Array.isArray(data) ? data : [])
    .map((row: { masked_email?: string }) => row.masked_email)
    .filter(Boolean) as string[]

  return {
    success: true as const,
    message: emails.length > 0 ? `${emails.length}건을 찾았습니다.` : '일치하는 계정이 없습니다.',
    emails,
  }
}

export async function requestPasswordResetAction(email: string, redirectTo: string) {
  const trimmed = email.trim()
  if (!trimmed) return { success: false as const, message: '이메일을 입력해 주세요.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(trimmed, { redirectTo })
  if (error) return { success: false as const, message: error.message }

  return {
    success: true as const,
    message: '비밀번호 재설정 메일을 보냈습니다. 메일함을 확인해 주세요.',
  }
}
