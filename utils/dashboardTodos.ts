/** 홈 대시보드 할 일 */

export type DashboardTodo = {
  id: string
  text: string
  /** YYYY-MM-DD, null이면 미정 */
  date: string | null
  done: boolean
  createdAt: string
}

/** @deprecated DB 이전용. 신규 저장은 서버(DB) 사용 */
export const DASHBOARD_TODOS_KEY = 'my-clean-erp-dashboard-todos-v1'
export const DASHBOARD_TODOS_MIGRATED_KEY = 'my-clean-erp-dashboard-todos-migrated-v1'

export function todayYmd(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function normalizeDate(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v !== 'string') return null
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null
}

/** localStorage에서 읽기 (DB 이전용) */
export function loadLocalDashboardTodos(): DashboardTodo[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(DASHBOARD_TODOS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (t): t is Record<string, unknown> =>
          !!t && typeof t.id === 'string' && typeof t.text === 'string'
      )
      .map((t) => ({
        id: t.id as string,
        text: t.text as string,
        date: normalizeDate(t.date),
        done: Boolean(t.done),
        createdAt: typeof t.createdAt === 'string' ? t.createdAt : new Date().toISOString(),
      }))
  } catch {
    return []
  }
}

export function clearLocalDashboardTodos(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(DASHBOARD_TODOS_KEY)
  localStorage.setItem(DASHBOARD_TODOS_MIGRATED_KEY, '1')
}

export function isLocalDashboardTodosMigrated(): boolean {
  if (typeof window === 'undefined') return true
  return localStorage.getItem(DASHBOARD_TODOS_MIGRATED_KEY) === '1'
}
