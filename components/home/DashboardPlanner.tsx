'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CAL_SHOW_DONE_KEY,
  clearLocalDashboardTodos,
  compareTodosForList,
  isLocalDashboardTodosMigrated,
  loadBoolPref,
  loadLocalDashboardTodos,
  loadTodoListFilter,
  matchesTodoFilter,
  saveBoolPref,
  saveTodoListFilter,
  todayYmd,
  TODO_SHOW_DONE_KEY,
  type DashboardTodo,
  type TodoListFilter,
} from '@/utils/dashboardTodos'
import {
  createDashboardTodoAction,
  deleteDashboardTodoAction,
  listDashboardTodosAction,
  migrateDashboardTodosAction,
  updateDashboardTodoAction,
} from '@/app/actions/dashboardTodos'
import { getKoreanHolidays } from '@/utils/koreanHolidays'
import styles from '@/app/home.module.css'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const PAGE_SIZE = 8
const COMPLETE_LINGER_MS = 700

const FILTERS: { id: TodoListFilter; label: string }[] = [
  { id: 'today', label: '오늘' },
  { id: 'undated', label: '미정' },
  { id: 'upcoming', label: '다가오는' },
  { id: 'all', label: '전체' },
]

function truncate(text: string, max = 6): string {
  const t = text.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}

export default function DashboardPlanner() {
  const [todos, setTodos] = useState<DashboardTodo[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [busy, setBusy] = useState(false)
  const [text, setText] = useState('')
  const [entryDate, setEntryDate] = useState(todayYmd())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth())
  const [page, setPage] = useState(1)
  const [assigningId, setAssigningId] = useState<string | null>(null)
  const [filter, setFilter] = useState<TodoListFilter>('today')
  const [showDone, setShowDone] = useState(false)
  const [showCalDone, setShowCalDone] = useState(false)
  const [prefsReady, setPrefsReady] = useState(false)
  /** 완료 직후 잠시 목록에 남겨 두는 id */
  const [lingeringIds, setLingeringIds] = useState<Set<string>>(() => new Set())
  const lingerTimers = useRef<Map<string, number>>(new Map())

  const today = todayYmd()

  useEffect(() => {
    setFilter(loadTodoListFilter())
    setShowDone(loadBoolPref(TODO_SHOW_DONE_KEY, false))
    setShowCalDone(loadBoolPref(CAL_SHOW_DONE_KEY, false))
    setPrefsReady(true)
  }, [])

  useEffect(() => {
    return () => {
      for (const timer of lingerTimers.current.values()) window.clearTimeout(timer)
      lingerTimers.current.clear()
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const result = await listDashboardTodosAction()
        if (cancelled) return

        if (!result.success) {
          setLoadError(result.message)
          setTodos([])
          return
        }

        let data = result.data

        if (data.length === 0 && !isLocalDashboardTodosMigrated()) {
          const local = loadLocalDashboardTodos()
          if (local.length > 0) {
            const migrated = await migrateDashboardTodosAction(
              local.map((t) => ({
                text: t.text,
                date: t.date,
                done: t.done,
                createdAt: t.createdAt,
              }))
            )
            if (cancelled) return
            if (migrated.success && migrated.imported > 0) {
              clearLocalDashboardTodos()
              const again = await listDashboardTodosAction()
              if (cancelled) return
              if (again.success) data = again.data
            } else if (migrated.success) {
              clearLocalDashboardTodos()
            }
          } else {
            clearLocalDashboardTodos()
          }
        }

        setLoadError('')
        setTodos(data)
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : '할 일을 불러오지 못했습니다.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const scopedTodos = useMemo(
    () => todos.filter((t) => matchesTodoFilter(t, filter, today)),
    [todos, filter, today]
  )

  const openTodos = useMemo(
    () => scopedTodos.filter((t) => !t.done).sort((a, b) => compareTodosForList(a, b, today)),
    [scopedTodos, today]
  )

  const doneTodos = useMemo(
    () => scopedTodos.filter((t) => t.done).sort((a, b) => compareTodosForList(a, b, today)),
    [scopedTodos, today]
  )

  const lingeringTodos = useMemo(
    () =>
      todos
        .filter((t) => lingeringIds.has(t.id) && t.done && matchesTodoFilter(t, filter, today))
        .sort((a, b) => compareTodosForList(a, b, today)),
    [todos, lingeringIds, filter, today]
  )

  const visibleTodos = useMemo(() => {
    if (showDone) {
      return [...openTodos, ...doneTodos]
    }
    const lingerOnly = lingeringTodos.filter((t) => !openTodos.some((o) => o.id === t.id))
    return [...openTodos, ...lingerOnly]
  }, [showDone, openTodos, doneTodos, lingeringTodos])

  const totalPages = Math.max(1, Math.ceil(visibleTodos.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pagedTodos = visibleTodos.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  useEffect(() => {
    setPage(1)
  }, [filter, showDone])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const todosByDate = useMemo(() => {
    const map = new Map<string, DashboardTodo[]>()
    for (const t of todos) {
      if (!t.date) continue
      if (!showCalDone && t.done) continue
      const list = map.get(t.date) || []
      list.push(t)
      map.set(t.date, list)
    }
    for (const list of map.values()) {
      list.sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1
        return a.createdAt.localeCompare(b.createdAt)
      })
    }
    return map
  }, [todos, showCalDone])

  const holidays = useMemo(() => getKoreanHolidays(viewYear), [viewYear])

  const calendarCells = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1)
    const startPad = first.getDay()
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const cells: ({ day: number; ymd: string; dow: number } | null)[] = []
    for (let i = 0; i < startPad; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) {
      const ymd = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      cells.push({ day: d, ymd, dow: (startPad + d - 1) % 7 })
    }
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }, [viewYear, viewMonth])

  const selectedDayTodos = useMemo(() => {
    if (!selectedDate) return []
    return todos
      .filter((t) => t.date === selectedDate && (showCalDone || !t.done))
      .sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1
        return a.createdAt.localeCompare(b.createdAt)
      })
  }, [todos, selectedDate, showCalDone])

  const selectedHoliday = selectedDate ? holidays.get(selectedDate) : undefined

  const shiftMonth = (delta: number) => {
    const next = new Date(viewYear, viewMonth + delta, 1)
    setViewYear(next.getFullYear())
    setViewMonth(next.getMonth())
  }

  const selectCalendarDate = (ymd: string) => {
    setSelectedDate(ymd)
    setEntryDate(ymd)
  }

  const changeFilter = (next: TodoListFilter) => {
    setFilter(next)
    saveTodoListFilter(next)
  }

  const toggleShowDone = () => {
    setShowDone((prev) => {
      const next = !prev
      saveBoolPref(TODO_SHOW_DONE_KEY, next)
      return next
    })
  }

  const toggleShowCalDone = () => {
    setShowCalDone((prev) => {
      const next = !prev
      saveBoolPref(CAL_SHOW_DONE_KEY, next)
      return next
    })
  }

  const clearLinger = (id: string) => {
    const timer = lingerTimers.current.get(id)
    if (timer) {
      window.clearTimeout(timer)
      lingerTimers.current.delete(id)
    }
    setLingeringIds((prev) => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  const scheduleLinger = (id: string) => {
    clearLinger(id)
    setLingeringIds((prev) => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
    const timer = window.setTimeout(() => {
      lingerTimers.current.delete(id)
      setLingeringIds((prev) => {
        if (!prev.has(id)) return prev
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }, COMPLETE_LINGER_MS)
    lingerTimers.current.set(id, timer)
  }

  const addTodo = async (date: string | null) => {
    const trimmed = text.trim()
    if (!trimmed || busy) return
    setBusy(true)
    try {
      const result = await createDashboardTodoAction({ text: trimmed, date })
      if (!result.success || !result.data) {
        alert(result.message)
        return
      }
      setTodos((prev) => [...prev, result.data!])
      setText('')
      if (date === null) changeFilter('undated')
      else if (date === today) changeFilter('today')
      else if (date > today) changeFilter('upcoming')
      else changeFilter('today')
      setPage(1)
    } finally {
      setBusy(false)
    }
  }

  const toggleDone = async (id: string) => {
    const target = todos.find((t) => t.id === id)
    if (!target || busy) return
    const nextDone = !target.done
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, done: nextDone } : t)))
    if (nextDone && !showDone) scheduleLinger(id)
    else clearLinger(id)
    const result = await updateDashboardTodoAction(id, { done: nextDone })
    if (!result.success) {
      clearLinger(id)
      setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, done: target.done } : t)))
      alert(result.message)
    }
  }

  const removeTodo = async (id: string) => {
    if (busy) return
    const prev = todos
    clearLinger(id)
    setTodos((list) => list.filter((t) => t.id !== id))
    if (assigningId === id) setAssigningId(null)
    const result = await deleteDashboardTodoAction(id)
    if (!result.success) {
      setTodos(prev)
      alert(result.message)
    }
  }

  const assignDate = async (id: string, date: string) => {
    const target = todos.find((t) => t.id === id)
    if (!target) return
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, date } : t)))
    setAssigningId(null)
    const [y, m] = date.split('-').map(Number)
    if (y && m) {
      setViewYear(y)
      setViewMonth(m - 1)
      setSelectedDate(date)
    }
    const result = await updateDashboardTodoAction(id, { date })
    if (!result.success) {
      setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, date: target.date } : t)))
      alert(result.message)
    }
  }

  const headerCount = loading
    ? '불러오는 중…'
    : filter === 'today'
      ? `남은 ${openTodos.length}건`
      : `남은 ${openTodos.length}건 · 범위 ${scopedTodos.length}건`

  return (
    <section className={styles.planner}>
      <div className={styles.section} style={{ marginBottom: 0 }}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>오늘 할 일</h2>
          <span className={styles.plannerDateLabel}>{headerCount}</span>
        </div>
        <div className={styles.panel}>
          {loadError ? (
            <div className={styles.empty} style={{ color: '#b91c1c', whiteSpace: 'pre-wrap' }}>
              {loadError}
            </div>
          ) : null}

          {prefsReady ? (
            <div className={styles.todoFilters} role="tablist" aria-label="할 일 범위">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  role="tab"
                  aria-selected={filter === f.id}
                  className={`${styles.todoFilterBtn} ${filter === f.id ? styles.todoFilterBtnActive : ''}`}
                  onClick={() => changeFilter(f.id)}
                  disabled={loading || Boolean(loadError)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          ) : null}

          <div className={styles.todoForm}>
            <input
              className={styles.todoInput}
              type="text"
              value={text}
              placeholder="할 일을 입력하세요"
              disabled={loading || busy || Boolean(loadError)}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void addTodo(entryDate || todayYmd())
                }
              }}
            />
            <button
              type="button"
              className={styles.todoUndatedBtn}
              onClick={() => void addTodo(null)}
              disabled={loading || busy || Boolean(loadError)}
              title="날짜 미정으로 등록"
            >
              미정
            </button>
            <input
              className={styles.todoDate}
              type="date"
              value={entryDate}
              disabled={loading || busy || Boolean(loadError)}
              onChange={(e) => {
                const v = e.target.value || todayYmd()
                setEntryDate(v)
                const [y, m] = v.split('-').map(Number)
                if (y && m) {
                  setViewYear(y)
                  setViewMonth(m - 1)
                }
              }}
            />
            <button
              type="button"
              className={styles.todoAddBtn}
              onClick={() => void addTodo(entryDate || todayYmd())}
              disabled={loading || busy || Boolean(loadError)}
            >
              등록
            </button>
          </div>

          {loading ? (
            <div className={styles.empty}>할 일을 불러오는 중…</div>
          ) : todos.length === 0 && !loadError ? (
            <div className={styles.empty}>등록된 할 일이 없습니다.</div>
          ) : visibleTodos.length === 0 && doneTodos.length === 0 && !loadError ? (
            <div className={styles.empty}>
              {filter === 'today'
                ? '오늘·연체된 할 일이 없습니다.'
                : filter === 'undated'
                  ? '미정 할 일이 없습니다.'
                  : filter === 'upcoming'
                    ? '다가오는 할 일이 없습니다.'
                    : '표시할 할 일이 없습니다.'}
            </div>
          ) : (
            <>
              {pagedTodos.map((t) => {
                const isOverdue = Boolean(t.date && !t.done && t.date < today)
                const isLingering = lingeringIds.has(t.id)
                return (
                  <div
                    key={t.id}
                    className={`${styles.todoRow} ${isLingering ? styles.todoRowLinger : ''}`}
                  >
                    <div className={styles.todoCheck}>
                      {assigningId === t.id ? (
                        <input
                          className={styles.todoAssignDate}
                          type="date"
                          autoFocus
                          defaultValue={todayYmd()}
                          onChange={(e) => {
                            const v = e.target.value
                            if (v) void assignDate(t.id, v)
                          }}
                          onBlur={() => {
                            window.setTimeout(
                              () => setAssigningId((cur) => (cur === t.id ? null : cur)),
                              200
                            )
                          }}
                        />
                      ) : t.date ? (
                        <span
                          className={`${styles.todoDateTag} ${isOverdue ? styles.todoDateTagOverdue : ''}`}
                        >
                          {isOverdue ? `연체 ${t.date.slice(5)}` : t.date.slice(5)}
                        </span>
                      ) : (
                        <button
                          type="button"
                          className={styles.todoUndatedTag}
                          onClick={() => setAssigningId(t.id)}
                          title="날짜 지정"
                        >
                          미정
                        </button>
                      )}
                      <span
                        className={`${styles.todoText} ${t.done ? styles.todoDone : ''}`}
                        title={t.text}
                      >
                        {t.text}
                      </span>
                    </div>
                    <button
                      type="button"
                      className={`${styles.todoDoneBtn} ${t.done ? styles.todoDoneBtnActive : ''}`}
                      onClick={() => void toggleDone(t.id)}
                    >
                      {t.done ? '취소' : '완료'}
                    </button>
                    <button
                      type="button"
                      className={styles.todoDelete}
                      onClick={() => void removeTodo(t.id)}
                      aria-label="삭제"
                    >
                      ×
                    </button>
                  </div>
                )
              })}
              {totalPages > 1 && (
                <div className={styles.todoPager}>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`${styles.todoPageBtn} ${n === safePage ? styles.todoPageBtnActive : ''}`}
                      onClick={() => setPage(n)}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              )}
              {doneTodos.length > 0 ? (
                <div className={styles.todoDoneBar}>
                  <button type="button" className={styles.todoDoneToggle} onClick={toggleShowDone}>
                    {showDone ? '완료 목록 접기' : `완료 ${doneTodos.length}건 보기`}
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      <div className={styles.section} style={{ marginBottom: 0 }}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>달력</h2>
          <div className={styles.calHeadRight}>
            <button
              type="button"
              className={`${styles.calDoneToggle} ${showCalDone ? styles.calDoneToggleOn : ''}`}
              onClick={toggleShowCalDone}
              title="완료된 일정을 달력에 표시"
            >
              {showCalDone ? '완료 표시 켜짐' : '완료 표시'}
            </button>
            <div className={styles.calNav}>
              <button type="button" className={styles.calNavBtn} onClick={() => shiftMonth(-1)} aria-label="이전 달">
                ‹
              </button>
              <span className={styles.calMonthLabel}>
                {viewYear}년 {viewMonth + 1}월
              </span>
              <button type="button" className={styles.calNavBtn} onClick={() => shiftMonth(1)} aria-label="다음 달">
                ›
              </button>
            </div>
          </div>
        </div>
        <div className={`${styles.panel} ${styles.calPanel}`}>
          <div className={styles.calWeekdays}>
            {WEEKDAYS.map((w, i) => (
              <div
                key={w}
                className={`${styles.calWeekday} ${i === 0 ? styles.calSun : ''} ${i === 6 ? styles.calSat : ''}`}
              >
                {w}
              </div>
            ))}
          </div>
          <div className={styles.calGrid}>
            {calendarCells.map((cell, idx) => {
              if (!cell) {
                return <div key={`pad-${idx}`} className={styles.calCellEmpty} />
              }
              const dayTodos = todosByDate.get(cell.ymd) || []
              const holidayName = holidays.get(cell.ymd)
              const isHoliday = Boolean(holidayName)
              const isSelected = cell.ymd === selectedDate
              const isToday = cell.ymd === today
              const dayColorClass =
                isHoliday || cell.dow === 0
                  ? styles.calSun
                  : cell.dow === 6
                    ? styles.calSat
                    : ''
              const tipLines = [
                holidayName,
                ...dayTodos.map((t) => (t.done ? `✓ ${t.text}` : t.text)),
              ].filter(Boolean)
              return (
                <button
                  key={cell.ymd}
                  type="button"
                  className={`${styles.calCell} ${isSelected ? styles.calCellSelected : ''} ${isToday ? styles.calCellToday : ''}`}
                  onClick={() => selectCalendarDate(cell.ymd)}
                  title={tipLines.length ? tipLines.join('\n') : undefined}
                >
                  <span className={`${styles.calDayNum} ${dayColorClass}`}>{cell.day}</span>
                  <div className={styles.calDots}>
                    {holidayName ? (
                      <span className={styles.calHoliday} title={holidayName}>
                        {truncate(holidayName, 4)}
                      </span>
                    ) : null}
                    {dayTodos.slice(0, holidayName ? 2 : 3).map((t) => (
                      <span
                        key={t.id}
                        className={`${styles.calChip} ${t.done ? styles.calChipDone : ''}`}
                        title={t.text}
                      >
                        {truncate(t.text)}
                      </span>
                    ))}
                    {dayTodos.length > (holidayName ? 2 : 3) && (
                      <span
                        className={styles.calMore}
                        title={dayTodos.slice(holidayName ? 2 : 3).map((t) => t.text).join('\n')}
                      >
                        +{dayTodos.length - (holidayName ? 2 : 3)}
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          {selectedDate && (
            <div className={styles.calPreview}>
              <div className={styles.calPreviewHead}>{selectedDate}</div>
              {selectedHoliday ? (
                <div className={styles.calPreviewHoliday}>{selectedHoliday}</div>
              ) : null}
              {selectedDayTodos.length === 0 ? (
                <div className={styles.calPreviewEmpty}>
                  {showCalDone ? '등록된 일정이 없습니다.' : '미완료 일정이 없습니다.'}
                </div>
              ) : (
                selectedDayTodos.map((t) => (
                  <div
                    key={t.id}
                    className={`${styles.calPreviewItem} ${t.done ? styles.todoDone : ''}`}
                  >
                    {t.text}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
