/** 홈 대시보드 할 일 (브라우저 localStorage) */

export type DashboardTodo = {
  id: string
  text: string
  /** YYYY-MM-DD, null이면 미정 */
  date: string | null
  done: boolean
  createdAt: string
}

export const DASHBOARD_TODOS_KEY = 'my-clean-erp-dashboard-todos-v1'

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

export function loadDashboardTodos(): DashboardTodo[] {
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

export function saveDashboardTodos(todos: DashboardTodo[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(DASHBOARD_TODOS_KEY, JSON.stringify(todos))
}

export function createTodoId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `todo-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}
