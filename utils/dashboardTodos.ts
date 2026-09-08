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

/** 목록 필터: 오늘(+연체) / 미정 / 다가오는 / 전체 */
export type TodoListFilter = 'today' | 'undated' | 'upcoming' | 'all'

export const TODO_FILTER_KEY = 'my-clean-erp-todo-filter-v1'
export const TODO_SHOW_DONE_KEY = 'my-clean-erp-todo-show-done-v1'
export const CAL_SHOW_DONE_KEY = 'my-clean-erp-cal-show-done-v1'

export function loadTodoListFilter(): TodoListFilter {
  if (typeof window === 'undefined') return 'today'
  const v = localStorage.getItem(TODO_FILTER_KEY)
  if (v === 'today' || v === 'undated' || v === 'upcoming' || v === 'all') return v
  return 'today'
}

export function saveTodoListFilter(filter: TodoListFilter) {
  if (typeof window === 'undefined') return
  localStorage.setItem(TODO_FILTER_KEY, filter)
}

export function loadBoolPref(key: string, fallback: boolean): boolean {
  if (typeof window === 'undefined') return fallback
  const v = localStorage.getItem(key)
  if (v === '1') return true
  if (v === '0') return false
  return fallback
}

export function saveBoolPref(key: string, value: boolean) {
  if (typeof window === 'undefined') return
  localStorage.setItem(key, value ? '1' : '0')
}

export function matchesTodoFilter(todo: DashboardTodo, filter: TodoListFilter, today: string): boolean {
  if (filter === 'all') return true
  if (filter === 'undated') return !todo.date
  if (filter === 'today') {
    if (!todo.date) return false
    return todo.date <= today
  }
  // upcoming
  return Boolean(todo.date && todo.date > today)
}

/** 미완료: 연체 → 오늘 → 미정 → 미래, 그다음 완료 */
export function compareTodosForList(a: DashboardTodo, b: DashboardTodo, today: string): number {
  if (a.done !== b.done) return a.done ? 1 : -1

  const rank = (t: DashboardTodo) => {
    if (!t.date) return 2
    if (t.date < today) return 0
    if (t.date === today) return 1
    return 3
  }
  const ra = rank(a)
  const rb = rank(b)
  if (ra !== rb) return ra - rb
  if (a.date && b.date && a.date !== b.date) return a.date.localeCompare(b.date)
  if (!a.date && b.date) return -1
  if (a.date && !b.date) return 1
  return a.createdAt.localeCompare(b.createdAt)
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
