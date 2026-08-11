'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import type { DashboardTodo } from '@/utils/dashboardTodos'

async function requireUserOrg() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return {
      supabase,
      error: '로그인이 필요합니다.' as string,
      orgId: null as string | null,
      userId: null as string | null,
    }
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()
  if (!profile?.organization_id) {
    return { supabase, error: '조직 정보를 찾을 수 없습니다.', orgId: null, userId: user.id }
  }
  return {
    supabase,
    error: null,
    orgId: profile.organization_id as string,
    userId: user.id,
  }
}

function mapRow(row: {
  id: string
  text: string
  due_date: string | null
  done: boolean
  created_at: string
}): DashboardTodo {
  return {
    id: row.id,
    text: row.text,
    date: row.due_date,
    done: row.done,
    createdAt: row.created_at,
  }
}

export async function listDashboardTodosAction() {
  const { supabase, error: authErr, orgId, userId } = await requireUserOrg()
  if (authErr || !orgId || !userId) {
    return { success: false as const, message: authErr || '권한 없음', data: [] as DashboardTodo[] }
  }

  const { data, error } = await supabase
    .from('dashboard_todos')
    .select('id, text, due_date, done, created_at')
    .eq('organization_id', orgId)
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) {
    const msg = error.message || '조회 실패'
    if (msg.includes('dashboard_todos') || msg.includes('schema cache')) {
      return {
        success: false as const,
        message:
          'DB에 dashboard_todos 테이블이 없습니다. supabase/migrations/add_dashboard_todos.sql 을 실행하세요.',
        data: [] as DashboardTodo[],
      }
    }
    return { success: false as const, message: msg, data: [] as DashboardTodo[] }
  }

  return {
    success: true as const,
    message: 'ok',
    data: (data || []).map(mapRow),
  }
}

export async function createDashboardTodoAction(input: {
  text: string
  date: string | null
}) {
  const { supabase, error: authErr, orgId, userId } = await requireUserOrg()
  if (authErr || !orgId || !userId) {
    return { success: false as const, message: authErr || '권한 없음', data: null as DashboardTodo | null }
  }

  const text = input.text.trim()
  if (!text) {
    return { success: false as const, message: '할 일을 입력하세요.', data: null }
  }

  const { data, error } = await supabase
    .from('dashboard_todos')
    .insert({
      organization_id: orgId,
      user_id: userId,
      text,
      due_date: input.date || null,
      done: false,
    })
    .select('id, text, due_date, done, created_at')
    .single()

  if (error || !data) {
    return {
      success: false as const,
      message: error?.message || '등록 실패',
      data: null,
    }
  }

  revalidatePath('/')
  return { success: true as const, message: '등록되었습니다.', data: mapRow(data) }
}

export async function updateDashboardTodoAction(
  id: string,
  patch: { text?: string; date?: string | null; done?: boolean }
) {
  const { supabase, error: authErr, orgId, userId } = await requireUserOrg()
  if (authErr || !orgId || !userId) {
    return { success: false as const, message: authErr || '권한 없음' }
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.text !== undefined) update.text = patch.text.trim()
  if (patch.date !== undefined) update.due_date = patch.date
  if (patch.done !== undefined) update.done = patch.done

  const { error } = await supabase
    .from('dashboard_todos')
    .update(update)
    .eq('id', id)
    .eq('organization_id', orgId)
    .eq('user_id', userId)

  if (error) {
    return { success: false as const, message: error.message || '수정 실패' }
  }

  revalidatePath('/')
  return { success: true as const, message: '수정되었습니다.' }
}

export async function deleteDashboardTodoAction(id: string) {
  const { supabase, error: authErr, orgId, userId } = await requireUserOrg()
  if (authErr || !orgId || !userId) {
    return { success: false as const, message: authErr || '권한 없음' }
  }

  const { error } = await supabase
    .from('dashboard_todos')
    .delete()
    .eq('id', id)
    .eq('organization_id', orgId)
    .eq('user_id', userId)

  if (error) {
    return { success: false as const, message: error.message || '삭제 실패' }
  }

  revalidatePath('/')
  return { success: true as const, message: '삭제되었습니다.' }
}

/** 브라우저 localStorage 할 일을 DB로 이전 (한 번) */
export async function migrateDashboardTodosAction(
  todos: Array<{ text: string; date: string | null; done: boolean; createdAt?: string }>
) {
  const { supabase, error: authErr, orgId, userId } = await requireUserOrg()
  if (authErr || !orgId || !userId) {
    return { success: false as const, message: authErr || '권한 없음', imported: 0 }
  }

  if (!todos.length) {
    return { success: true as const, message: '가져올 항목 없음', imported: 0 }
  }

  const { count, error: countErr } = await supabase
    .from('dashboard_todos')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('user_id', userId)

  if (countErr) {
    return { success: false as const, message: countErr.message, imported: 0 }
  }
  if ((count || 0) > 0) {
    return { success: true as const, message: '이미 DB에 할 일이 있어 이전하지 않았습니다.', imported: 0 }
  }

  const rows = todos
    .filter((t) => t.text?.trim())
    .map((t) => ({
      organization_id: orgId,
      user_id: userId,
      text: t.text.trim(),
      due_date: t.date || null,
      done: Boolean(t.done),
      created_at: t.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }))

  if (!rows.length) {
    return { success: true as const, message: '가져올 항목 없음', imported: 0 }
  }

  const { error } = await supabase.from('dashboard_todos').insert(rows)
  if (error) {
    return { success: false as const, message: error.message, imported: 0 }
  }

  revalidatePath('/')
  return { success: true as const, message: `${rows.length}건을 계정으로 이전했습니다.`, imported: rows.length }
}
