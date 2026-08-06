'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  createTodoId,
  loadDashboardTodos,
  saveDashboardTodos,
  todayYmd,
  type DashboardTodo,
} from '@/utils/dashboardTodos'
import { getKoreanHolidays } from '@/utils/koreanHolidays'
import styles from '@/app/home.module.css'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const PAGE_SIZE = 8

function truncate(text: string, max = 6): string {
  const t = text.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}

export default function DashboardPlanner() {
  const [todos, setTodos] = useState<DashboardTodo[]>([])
  const [text, setText] = useState('')
  /** 등록용 날짜 */
  const [entryDate, setEntryDate] = useState(todayYmd())
  /** 달력에서 클릭한 날짜 (노란 강조) */
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth())
  const [page, setPage] = useState(1)
  /** 미정 항목에서 날짜 지정 중인 id */
  const [assigningId, setAssigningId] = useState<string | null>(null)

  useEffect(() => {
    setTodos(loadDashboardTodos())
  }, [])

  const updateTodos = (updater: (prev: DashboardTodo[]) => DashboardTodo[]) => {
    setTodos((prev) => {
      const next = updater(prev)
      saveDashboardTodos(next)
      return next
    })
  }

  /** 날짜 있는 일정만 달력에 표시 */
  const todosByDate = useMemo(() => {
    const map = new Map<string, DashboardTodo[]>()
    for (const t of todos) {
      if (!t.date) continue
      const list = map.get(t.date) || []
      list.push(t)
      map.set(t.date, list)
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    }
    return map
  }, [todos])

  /** 오늘 할 일: 전체 (미정 먼저, 그다음 날짜순) */
  const allTodosSorted = useMemo(
    () =>
      [...todos].sort((a, b) => {
        if (!a.date && b.date) return -1
        if (a.date && !b.date) return 1
        if (a.date && b.date && a.date !== b.date) return a.date.localeCompare(b.date)
        return a.createdAt.localeCompare(b.createdAt)
      }),
    [todos]
  )

  const totalPages = Math.max(1, Math.ceil(allTodosSorted.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pagedTodos = allTodosSorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

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

  const selectedDayTodos = selectedDate ? todosByDate.get(selectedDate) || [] : []
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

  const addTodo = (date: string | null) => {
    const trimmed = text.trim()
    if (!trimmed) return
    updateTodos((prev) => [
      ...prev,
      {
        id: createTodoId(),
        text: trimmed,
        date,
        done: false,
        createdAt: new Date().toISOString(),
      },
    ])
    setText('')
    setPage(Math.max(1, Math.ceil((allTodosSorted.length + 1) / PAGE_SIZE)))
  }

  const toggleDone = (id: string) => {
    updateTodos((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)))
  }

  const removeTodo = (id: string) => {
    updateTodos((prev) => prev.filter((t) => t.id !== id))
    if (assigningId === id) setAssigningId(null)
  }

  const assignDate = (id: string, date: string) => {
    updateTodos((prev) => prev.map((t) => (t.id === id ? { ...t, date } : t)))
    setAssigningId(null)
    const [y, m] = date.split('-').map(Number)
    if (y && m) {
      setViewYear(y)
      setViewMonth(m - 1)
      setSelectedDate(date)
    }
  }

  const today = todayYmd()

  return (
    <section className={styles.planner}>
      <div className={styles.section} style={{ marginBottom: 0 }}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>오늘 할 일</h2>
          <span className={styles.plannerDateLabel}>전체 {allTodosSorted.length}건</span>
        </div>
        <div className={styles.panel}>
          <div className={styles.todoForm}>
            <input
              className={styles.todoInput}
              type="text"
              value={text}
              placeholder="할 일을 입력하세요"
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addTodo(entryDate || todayYmd())
                }
              }}
            />
            <button
              type="button"
              className={styles.todoUndatedBtn}
              onClick={() => addTodo(null)}
              title="날짜 미정으로 등록"
            >
              미정
            </button>
            <input
              className={styles.todoDate}
              type="date"
              value={entryDate}
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
            <button type="button" className={styles.todoAddBtn} onClick={() => addTodo(entryDate || todayYmd())}>
              등록
            </button>
          </div>

          {allTodosSorted.length === 0 ? (
            <div className={styles.empty}>등록된 할 일이 없습니다.</div>
          ) : (
            <>
              {pagedTodos.map((t) => (
                <div key={t.id} className={styles.todoRow}>
                  <div className={styles.todoCheck}>
                    {assigningId === t.id ? (
                      <input
                        className={styles.todoAssignDate}
                        type="date"
                        autoFocus
                        defaultValue={todayYmd()}
                        onChange={(e) => {
                          const v = e.target.value
                          if (v) assignDate(t.id, v)
                        }}
                        onBlur={() => {
                          // 날짜 선택 UI가 열린 동안 blur가 먼저 올 수 있어 약간 지연
                          window.setTimeout(() => setAssigningId((cur) => (cur === t.id ? null : cur)), 200)
                        }}
                      />
                    ) : t.date ? (
                      <span className={styles.todoDateTag}>{t.date.slice(5)}</span>
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
                    onClick={() => toggleDone(t.id)}
                  >
                    {t.done ? '취소' : '완료'}
                  </button>
                  <button
                    type="button"
                    className={styles.todoDelete}
                    onClick={() => removeTodo(t.id)}
                    aria-label="삭제"
                  >
                    ×
                  </button>
                </div>
              ))}
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
            </>
          )}
        </div>
      </div>

      <div className={styles.section} style={{ marginBottom: 0 }}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>달력</h2>
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
                <div className={styles.calPreviewEmpty}>등록된 일정이 없습니다.</div>
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
