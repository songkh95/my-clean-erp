'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Button from '@/components/ui/Button'
import ServiceForm from '@/components/service/ServiceForm'
import PartsEditModal from '@/components/service/PartsEditModal'
import ServiceImageGallery from '@/components/service/ServiceImageGallery'
import ServiceExcelModal from '@/components/service/ServiceExcelModal'
import EditableCell from '@/components/service/EditableCell'
import ResizableTh from '@/components/service/ResizableTh'
import styles from './service.module.css'
import {
  getServiceLogsAction,
  deleteServiceLogAction,
  patchServiceLogAction,
  createServiceLogAction,
  getEmployeesAction,
  getClientMachinesAction,
  checkServiceSchemaAction,
} from '@/app/actions/service'
import { ServiceLog } from '@/app/types'
import { useAppSettings } from '@/hooks/useAppSettings'
import { getMyProfileAction } from '@/app/actions/auth'

const STATUS_OPTIONS = [
  { value: '접수', label: '접수' },
  { value: '완료', label: '완료' },
  { value: '보류', label: '보류' },
]

const STATUS_OPTIONS_WITH_UNVISITED = [
  { value: '미방문', label: '미방문' },
  ...STATUS_OPTIONS,
]

type PendingFields = Record<string, string | number | null>
type PeriodPreset = 'all' | 'month' | 'custom'

const COL_KEYS = [
  'no', 'status', 'visit', 'type', 'client', 'machine',
  'symptom', 'action', 'parts', 'manager', 'stock', 'photos', 'memo',
] as const
type ColKey = (typeof COL_KEYS)[number]

const DEFAULT_COL_WIDTHS: Record<ColKey, number> = {
  no: 40,
  status: 56,
  visit: 96,
  type: 72,
  client: 120,
  machine: 130,
  symptom: 140,
  action: 150,
  parts: 110,
  manager: 72,
  stock: 100,
  photos: 56,
  memo: 110,
}

const COL_WIDTHS_KEY = 'service-log-col-widths'

function isDummyId(id: string) {
  return id.startsWith('dummy_')
}

function daysBetween(from: string, to: string) {
  const a = new Date(from)
  const b = new Date(to)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

function formatLocalDate(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function todayStr() {
  return formatLocalDate(new Date())
}

function getPeriodRange(
  preset: PeriodPreset,
  year: number,
  month: number,
  customFrom: string,
  customTo: string
): {
  from: string | null
  to: string | null
  includeUnvisited: boolean
} {
  const today = todayStr()
  if (preset === 'all') return { from: null, to: null, includeUnvisited: true }
  if (preset === 'custom') {
    const from = customFrom || '0000-01-01'
    const to = customTo || '9999-12-31'
    return { from, to, includeUnvisited: today >= from && today <= to }
  }
  // month
  const m = String(month).padStart(2, '0')
  const from = `${year}-${m}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const to = `${year}-${m}-${String(lastDay).padStart(2, '0')}`
  return { from, to, includeUnvisited: true }
}

function groupKeyOf(log: ServiceLog) {
  return log.inventory_id ? `i:${log.inventory_id}` : `c:${log.client_id || log.id}`
}

function loadColWidths(): Record<ColKey, number> {
  try {
    const raw = localStorage.getItem(COL_WIDTHS_KEY)
    if (!raw) return { ...DEFAULT_COL_WIDTHS }
    const parsed = JSON.parse(raw) as Partial<Record<ColKey, number>>
    return { ...DEFAULT_COL_WIDTHS, ...parsed }
  } catch {
    return { ...DEFAULT_COL_WIDTHS }
  }
}

export default function ServicePage() {
  const { settings } = useAppSettings()
  const [logs, setLogs] = useState<ServiceLog[]>([])
  const [pending, setPending] = useState<Record<string, PendingFields>>({})
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [partsModalLog, setPartsModalLog] = useState<ServiceLog | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedLog, setSelectedLog] = useState<ServiceLog | null>(null)
  const [employees, setEmployees] = useState<{ id: string; name: string | null }[]>([])
  const [machineOptions, setMachineOptions] = useState<Record<string, { value: string; label: string }[]>>({})
  const [query, setQuery] = useState('')
  const [locked, setLocked] = useState(false)
  const [clientSort, setClientSort] = useState<'asc' | 'desc'>('asc')
  const [visitPin, setVisitPin] = useState<'none' | 'visited' | 'unvisited'>('none')
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('all')
  const [periodYear, setPeriodYear] = useState(() => new Date().getFullYear())
  const [periodMonth, setPeriodMonth] = useState(() => new Date().getMonth() + 1)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [colWidths, setColWidths] = useState<Record<ColKey, number>>(DEFAULT_COL_WIDTHS)
  const [deleteMode, setDeleteMode] = useState(false)
  const [galleryLog, setGalleryLog] = useState<ServiceLog | null>(null)
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({})
  const [orgLabel, setOrgLabel] = useState('')
  const [myUserId, setMyUserId] = useState<string | null>(null)
  const [schemaWarning, setSchemaWarning] = useState<string | null>(null)
  const [excelOpen, setExcelOpen] = useState(false)
  const widthsReady = useRef(false)
  const machineCache = React.useRef<Record<string, { value: string; label: string }[]>>({})

  const typeOptions = useMemo(
    () => (settings.service.serviceTypes.length > 0
      ? settings.service.serviceTypes
      : ['A/S', '정기점검', '설치', '철수', '배송']
    ).map((t) => ({ value: t, label: t })),
    [settings.service.serviceTypes]
  )

  useEffect(() => {
    try {
      setLocked(localStorage.getItem('service-log-locked') === '1')
      setColWidths(loadColWidths())
      widthsReady.current = true
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (!widthsReady.current) return
    try {
      localStorage.setItem(COL_WIDTHS_KEY, JSON.stringify(colWidths))
    } catch { /* ignore */ }
  }, [colWidths])

  const setColWidth = (key: ColKey, next: number) => {
    setColWidths((prev) => ({ ...prev, [key]: next }))
  }

  const fetchLogs = useCallback(async (opts?: { clearPending?: boolean }) => {
    setLoading(true)
    const result = await getServiceLogsAction()
    if (result.success) {
      setLogs(result.data as unknown as ServiceLog[])
      if (opts?.clearPending !== false) {
        setPending({})
      }
    }
    setLoading(false)
    return result.success
  }, [])

  useEffect(() => {
    fetchLogs()
    getEmployeesAction().then(setEmployees)
    getMyProfileAction().then((res) => {
      if (res.success && res.profile) {
        const label = res.profile.organizationName || res.email || ''
        setOrgLabel(label)
        setMyUserId(res.profile.id)
      }
    })
    checkServiceSchemaAction().then((res) => {
      if (res.success && !res.ok) setSchemaWarning(res.message)
      else setSchemaWarning(null)
    })
  }, [fetchLogs])

  const ensureMachines = async (clientId: string) => {
    if (machineCache.current[clientId]) {
      setMachineOptions((prev) => ({ ...prev, [clientId]: machineCache.current[clientId] }))
      return
    }
    const machines = await getClientMachinesAction(clientId)
    const opts = [
      { value: '', label: '(기기 없음)' },
      ...machines.map((m: { id: string; model_name: string; serial_number: string }) => ({
        value: m.id,
        label: `${m.model_name} (${m.serial_number})`,
      })),
    ]
    machineCache.current[clientId] = opts
    setMachineOptions((prev) => ({ ...prev, [clientId]: opts }))
  }

  const displayLogs = useMemo(() => {
    return logs.map((log) => {
      const patch = pending[log.id]
      if (!patch) return log
      const next = { ...log, ...patch } as ServiceLog
      if ('manager_id' in patch) {
        const emp = employees.find((e) => e.id === patch.manager_id)
        next.manager = { name: emp?.name || '' }
      }
      if ('inventory_id' in patch) {
        const opts = machineCache.current[log.client_id] || machineOptions[log.client_id] || []
        const opt = opts.find((o) => o.value === patch.inventory_id)
        if (!patch.inventory_id) {
          next.inventory = undefined
          next.inventory_id = null
        } else if (opt) {
          const match = opt.label.match(/^(.*) \((.*)\)$/)
          next.inventory = match
            ? { model_name: match[1], serial_number: match[2] }
            : { model_name: opt.label, serial_number: '' }
        }
      }
      return next
    })
  }, [logs, pending, employees, machineOptions])

  const periodRange = useMemo(
    () => getPeriodRange(periodPreset, periodYear, periodMonth, customFrom, customTo),
    [periodPreset, periodYear, periodMonth, customFrom, customTo]
  )

  const periodLogs = useMemo(() => {
    const { from, to, includeUnvisited } = periodRange
    if (!from || !to) return displayLogs
    return displayLogs.filter((log) => {
      const isUnvisited = log.status === '미방문' || isDummyId(log.id) || !log.visit_date
      if (isUnvisited) return includeUnvisited
      return log.visit_date >= from && log.visit_date <= to
    })
  }, [displayLogs, periodRange])

  const filteredLogs = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return periodLogs
    return periodLogs.filter((log) => {
      const hay = [
        log.status,
        log.visit_date,
        log.prev_visit_date,
        log.service_type,
        log.client?.name,
        log.inventory?.model_name,
        log.inventory?.serial_number,
        log.symptom,
        log.action_detail,
        log.memo,
        log.manager?.name,
        ...(log.parts_usage || []).map((p) => p.consumable?.model_name),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [periodLogs, query])

  const sortedLogs = useMemo(() => {
    const list = [...filteredLogs]
    const dir = clientSort === 'asc' ? 1 : -1
    list.sort((a, b) => {
      const nameA = a.client?.name || ''
      const nameB = b.client?.name || ''
      const byName = nameA.localeCompare(nameB, 'ko')
      if (byName !== 0) return byName * dir
      const dateA = a.visit_date || ''
      const dateB = b.visit_date || ''
      if (dateA !== dateB) {
        if (!dateA) return 1
        if (!dateB) return -1
        return dateB.localeCompare(dateA)
      }
      const modelA = a.inventory?.model_name || ''
      const modelB = b.inventory?.model_name || ''
      return modelA.localeCompare(modelB, 'ko')
    })
    return list
  }, [filteredLogs, clientSort])

  /** 기계(또는 거래처)당 대표 1행 + 펼침 시 과거 방문 */
  const rowGroups = useMemo(() => {
    const buckets = new Map<string, ServiceLog[]>()
    const order: string[] = []
    for (const log of sortedLogs) {
      const key = groupKeyOf(log)
      if (!buckets.has(key)) {
        buckets.set(key, [])
        order.push(key)
      }
      buckets.get(key)!.push(log)
    }

    return order.map((key) => {
      const items = buckets.get(key) || []
      const dummies = items.filter((l) => isDummyId(l.id))
      const reals = items
        .filter((l) => !isDummyId(l.id))
        .sort((a, b) => String(b.visit_date || '').localeCompare(String(a.visit_date || '')))
      // 방문 기록이 있으면 최신 방문이 대표, 없으면 미방문
      const primary = reals[0] || dummies[0] || items[0]
      const history = reals.filter((l) => l.id !== primary.id)
      return { key, primary, history }
    })
  }, [sortedLogs])

  const currentMonthPrefix = useMemo(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  }, [])

  const isMonthUnvisitedLog = (log: ServiceLog) =>
    log.status === '미방문' || isDummyId(log.id) || !log.visit_date

  const isMonthVisitedLog = (log: ServiceLog) =>
    !isMonthUnvisitedLog(log) && String(log.visit_date || '').startsWith(currentMonthPrefix)

  /** 이번 달 방문/미방문 클릭 시 해당 그룹을 위로 */
  const displayRowGroups = useMemo(() => {
    if (visitPin === 'none') return rowGroups
    const scored = rowGroups.map((g, index) => {
      const unvisited = isMonthUnvisitedLog(g.primary)
      const visited = isMonthVisitedLog(g.primary)
      let rank = 1
      if (visitPin === 'visited') rank = visited ? 0 : 1
      if (visitPin === 'unvisited') rank = unvisited ? 0 : 1
      return { g, index, rank }
    })
    scored.sort((a, b) => (a.rank - b.rank) || (a.index - b.index))
    return scored.map((s) => s.g)
  }, [rowGroups, visitPin, currentMonthPrefix])

  const summaryStats = useMemo(() => {
    const source = periodLogs
    const clientIds = new Set<string>()
    const machineIds = new Set<string>()

    let monthVisited = 0
    let monthUnvisited = 0

    for (const log of source) {
      if (log.client_id) clientIds.add(log.client_id)
      if (log.inventory_id) machineIds.add(log.inventory_id)

      if (isMonthUnvisitedLog(log)) {
        monthUnvisited += 1
        continue
      }
      if (isMonthVisitedLog(log)) {
        monthVisited += 1
      }
    }

    return {
      clientCount: clientIds.size,
      machineCount: machineIds.size,
      monthVisited,
      monthUnvisited,
      rowCount: rowGroups.length,
    }
  }, [periodLogs, rowGroups.length, currentMonthPrefix])

  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const tableMinWidth = useMemo(
    () => COL_KEYS.reduce((sum, key) => sum + colWidths[key], 0),
    [colWidths]
  )

  const dirtyCount = Object.keys(pending).length

  const queueEdit = (log: ServiceLog, fields: PendingFields) => {
    if (locked) return
    setPending((prev) => {
      const merged: PendingFields = { ...(prev[log.id] || {}), ...fields }

      if ('spare_stock' in fields && !('spare_stock_at' in fields)) {
        merged.spare_stock_at = todayStr()
      }

      if (isDummyId(log.id)) {
        const status = String(merged.status ?? log.status)
        if (status === '미방문' && !('status' in fields)) {
          merged.status = '접수'
        }
        const visit = merged.visit_date ?? log.visit_date
        if (!visit && !('visit_date' in fields)) {
          merged.visit_date = todayStr()
        }
        if (!merged.service_type && !log.service_type && !('service_type' in fields)) {
          merged.service_type = 'A/S'
        }
      }

      return { ...prev, [log.id]: merged }
    })
  }

  const openLogEditor = (log: ServiceLog) => {
    if (locked) return
    if (isDummyId(log.id)) {
      alert('미방문 행은 표에서 내용을 입력·저장해 일지를 먼저 등록한 뒤 수정할 수 있습니다.')
      return
    }
    setSelectedLog(log)
    setIsModalOpen(true)
  }

  const handleSaveAll = async () => {
    if (locked) return alert('잠금 상태입니다. 잠금을 해제한 뒤 저장하세요.')
    if (dirtyCount === 0) return alert('저장할 변경 사항이 없습니다.')

    setSaving(true)
    const savedIds: string[] = []
    const errors: string[] = []

    try {
      for (const [id, fields] of Object.entries(pending)) {
        const base = logs.find((l) => l.id === id)
        if (!base) {
          errors.push('일부 행을 찾을 수 없습니다. 새로고침 후 다시 시도하세요.')
          continue
        }

        if (isDummyId(id)) {
          const merged = { ...base, ...fields } as ServiceLog
          if (!merged.client_id) {
            errors.push(`${merged.client?.name || '거래처'}: 거래처 정보가 없습니다.`)
            continue
          }
          // 담당자 미선택 시 로그인 사용자로 자동 지정
          if (!merged.manager_id) {
            merged.manager_id = myUserId || employees[0]?.id || null
          }
          if (!merged.manager_id) {
            errors.push(`${merged.client?.name || '거래처'}: 담당자를 선택해 주세요.`)
            continue
          }
          const status = merged.status === '미방문' ? '접수' : merged.status
          const result = await createServiceLogAction(
            {
              client_id: merged.client_id,
              inventory_id: merged.inventory_id || null,
              status,
              service_type: merged.service_type || 'A/S',
              visit_date: merged.visit_date || todayStr(),
              symptom: merged.symptom || '',
              action_detail: merged.action_detail || '',
              memo: merged.memo || '',
              spare_stock: merged.spare_stock || '',
              spare_stock_at: merged.spare_stock_at || (merged.spare_stock ? todayStr() : null),
              meter_bw: merged.meter_bw || 0,
              meter_col: merged.meter_col || 0,
              manager_id: merged.manager_id,
            },
            []
          )
          if (!result.success) {
            errors.push(`등록 실패 (${merged.client?.name}): ${result.message}`)
            continue
          }
          savedIds.push(id)
        } else {
          const result = await patchServiceLogAction(id, fields)
          if (!result.success) {
            errors.push(result.message)
            continue
          }
          savedIds.push(id)
        }
      }

      // 성공한 항목만 pending에서 제거 (실패분은 화면 내용 유지)
      if (savedIds.length > 0) {
        setPending((prev) => {
          const next = { ...prev }
          for (const id of savedIds) delete next[id]
          return next
        })
        await fetchLogs({ clearPending: false })
      }

      if (errors.length > 0 && savedIds.length > 0) {
        alert(`일부만 저장되었습니다.\n\n${errors.join('\n')}`)
      } else if (errors.length > 0) {
        alert(`저장되지 않았습니다.\n\n${errors.join('\n')}`)
      } else if (savedIds.length > 0) {
        alert('저장되었습니다.')
      } else {
        alert('저장할 수 있는 항목이 없습니다.')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (locked) return
    if (!confirm('정말 삭제하시겠습니까? (완료된 건은 재고가 복구됩니다)')) return
    const result = await deleteServiceLogAction(id)
    if (result.success) {
      setPending((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      fetchLogs()
    } else {
      alert(result.message)
    }
  }

  const handleClose = () => {
    setIsModalOpen(false)
    setSelectedLog(null)
  }

  const openPartsEdit = (log: ServiceLog) => {
    if (locked) return
    if (isDummyId(log.id)) {
      alert('미방문 행은 먼저 표에서 내용을 입력·저장해 일지를 등록한 뒤, 교체/배송을 추가할 수 있습니다.')
      return
    }
    setPartsModalLog(log)
  }

  const toggleLock = () => {
    setLocked((prev) => {
      const next = !prev
      try {
        localStorage.setItem('service-log-locked', next ? '1' : '0')
      } catch { /* ignore */ }
      return next
    })
  }

  const employeeOptions = [
    { value: '', label: '(미지정)' },
    ...employees.map((e) => ({ value: e.id, label: e.name || '(이름 없음)' })),
  ]

  const renderVisitDisplay = (log: ServiceLog) => {
    const current = log.visit_date || ''
    const prev = log.prev_visit_date
    const gap = current && prev ? daysBetween(prev, current) : (prev ? daysBetween(prev, todayStr()) : null)

    return (
      <div className={styles.visitStack}>
        <span>{current || <span className={styles.emptyCell}>-</span>}</span>
        {prev ? (
          <span className={styles.prevVisit}>
            이전 {prev}
            {gap !== null && gap >= 0 ? <span className={styles.prevGap}> · {gap}일</span> : null}
          </span>
        ) : (
          <span className={styles.prevVisit}>이전 없음</span>
        )}
      </div>
    )
  }

  const renderLogRow = (
    log: ServiceLog,
    displayNo: number | string,
    opts: {
      groupKey: string
      historyCount: number
      expanded: boolean
      isHistory: boolean
    }
  ) => {
    const dummy = isDummyId(log.id)
    const dirty = Boolean(pending[log.id])
    const completed = log.status === '완료' && !dummy
    const hasImages = Array.isArray(log.images) && log.images.length > 0
    const imageCount = hasImages ? log.images!.length : 0
    const machineOpts = machineOptions[log.client_id] || machineCache.current[log.client_id] || [
      { value: '', label: '(기기 없음)' },
      ...(log.inventory_id && log.inventory
        ? [{ value: log.inventory_id, label: `${log.inventory.model_name} (${log.inventory.serial_number})` }]
        : []),
    ]
    const canExpand = !opts.isHistory && opts.historyCount > 0

    return (
      <tr
        key={log.id}
        className={`${styles.tr} ${completed ? styles.trCompleted : styles.trNormal} ${dirty ? styles.trDirty : ''}`}
      >
        <td
          className={`${styles.td} ${styles.tdCenter} ${styles.tdNo}`}
          onDoubleClick={() => openLogEditor(log)}
          title="더블클릭: 일지 수정"
        >
          <div className={styles.noCell}>
            {deleteMode && !dummy ? (
              <button
                type="button"
                className={styles.deleteBtn}
                title="삭제"
                disabled={locked}
                onClick={(e) => {
                  e.stopPropagation()
                  handleDelete(log.id)
                }}
              >
                ✕
              </button>
            ) : null}
            <span className={opts.isHistory ? styles.historyNo : undefined}>{displayNo}</span>
          </div>
        </td>
        <EditableCell
          value={log.status}
          type="select"
          options={dummy ? STATUS_OPTIONS_WITH_UNVISITED : STATUS_OPTIONS}
          disabled={locked}
          className={styles.tdCenter}
          display={
            <span className={`${styles.badge} ${
              log.status === '완료' ? styles.statusCompleted :
              log.status === '보류' ? styles.statusHold :
              log.status === '미방문' ? styles.statusUnvisited : styles.statusReceived
            }`}>
              {log.status}
            </span>
          }
          onSave={(v) => queueEdit(log, { status: v })}
        />

        <EditableCell
          value={log.visit_date || ''}
          type="date"
          disabled={locked}
          className={styles.tdCenter}
          display={renderVisitDisplay(log)}
          onSave={(v) => queueEdit(log, { visit_date: v })}
        />

        <EditableCell
          value={log.service_type || ''}
          type="select"
          options={typeOptions}
          disabled={locked}
          className={styles.tdCenter}
          display={log.service_type || <span className={styles.emptyCell}>-</span>}
          onSave={(v) => queueEdit(log, { service_type: v })}
        />

        <td
          className={styles.td}
          onDoubleClick={() => openLogEditor(log)}
          title={canExpand ? '클릭: 과거 방문 펼치기 · 더블클릭: 일지 수정' : '더블클릭: 일지 수정'}
        >
          <span className={styles.clientNameCell}>
            {opts.isHistory ? <span className={styles.historyIndent}>↳</span> : null}
            {log.client?.is_deleted ? (
              <span className={styles.clientWarn} title="삭제된 거래처 — 일지 데이터는 유지됩니다">!</span>
            ) : null}
            <button
              type="button"
              className={`${styles.clientNameBtn} ${canExpand ? styles.clientNameExpandable : ''} ${log.client?.is_deleted ? styles.clientDeletedName : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                if (canExpand) toggleExpand(opts.groupKey)
              }}
              disabled={!canExpand}
            >
              {canExpand ? (
                <span className={styles.expandChevron} aria-hidden>
                  {opts.expanded ? '▾' : '▸'}
                </span>
              ) : null}
              <span>{log.client?.name || '(거래처 없음)'}</span>
              {canExpand ? (
                <span className={styles.historyCountBadge}>{opts.historyCount}</span>
              ) : null}
            </button>
          </span>
        </td>

        <EditableCell
          value={log.inventory_id || ''}
          type="select"
          options={machineOpts}
          disabled={locked}
          onBeforeEdit={() => ensureMachines(log.client_id)}
          display={
            log.inventory
              ? <>{log.inventory.model_name} <span className={styles.sn}>({log.inventory.serial_number})</span></>
              : <span className={styles.emptyCell}>-</span>
          }
          onSave={(v) => queueEdit(log, { inventory_id: v || null })}
        />

        <EditableCell
          value={log.symptom || ''}
          type="textarea"
          clamp
          disabled={locked}
          className={styles.tdWrap}
          onSave={(v) => queueEdit(log, { symptom: v })}
        />

        <EditableCell
          value={log.action_detail || ''}
          type="textarea"
          clamp
          disabled={locked}
          className={styles.tdWrap}
          onSave={(v) => queueEdit(log, { action_detail: v })}
        />

        <td
          className={`${styles.td} ${styles.tdClamp} ${!locked && !dummy ? styles.tdEditable : styles.tdReadonly} ${styles.tdWrap}`}
          onClick={() => openPartsEdit(log)}
          title={
            dummy
              ? '일지 등록 후 교체/배송을 추가할 수 있습니다'
              : '클릭하여 토너·드럼·부품 선택'
          }
        >
          <div className={styles.clampInner}>
            {log.parts_usage && log.parts_usage.length > 0
              ? (() => {
                  const merged = new Map<string, { name: string; qty: number; pending: boolean }>()
                  for (const p of log.parts_usage) {
                    const id = p.consumable?.id || p.consumable_id || p.consumable?.model_name || '?'
                    const name = p.consumable?.model_name || '?'
                    const prev = merged.get(id)
                    const pendingStock = p.stock_status === 'pending'
                    if (prev) {
                      prev.qty += Number(p.quantity) || 0
                      prev.pending = prev.pending || pendingStock
                    } else {
                      merged.set(id, { name, qty: Number(p.quantity) || 0, pending: pendingStock })
                    }
                  }
                  return Array.from(merged.values()).map((p, i) => (
                    <span key={`${log.id}-part-${i}`}>
                      {i > 0 ? ', ' : ''}
                      {p.name}({p.qty})
                      {p.pending ? <span className={styles.pendingTag}> 미입고</span> : null}
                    </span>
                  ))
                })()
              : <span className={styles.emptyCell}>-</span>}
          </div>
        </td>

        <EditableCell
          value={log.manager_id || ''}
          type="select"
          options={employeeOptions}
          disabled={locked}
          className={styles.tdCenter}
          display={log.manager?.name || <span className={styles.emptyCell}>-</span>}
          onSave={(v) => queueEdit(log, { manager_id: v || null })}
        />

        <EditableCell
          value={log.spare_stock || ''}
          type="text"
          clamp
          disabled={locked}
          className={styles.tdWrap}
          display={
            log.spare_stock ? (
              <span>
                {log.spare_stock}
                <span className={styles.spareDate}>
                  {' '}({log.spare_stock_at || log.visit_date || '-'})
                </span>
              </span>
            ) : (
              <span className={styles.emptyCell}>-</span>
            )
          }
          onSave={(v) => queueEdit(log, { spare_stock: v })}
        />

        <td className={`${styles.td} ${styles.tdCenter}`}>
          {dummy ? (
            <span className={styles.emptyCell}>-</span>
          ) : (
            <button
              type="button"
              className={hasImages ? styles.photoBtnHas : styles.photoBtn}
              title={hasImages ? `사진 ${imageCount}장 — 클릭하여 보기` : '사진 없음 — 클릭 후 추가 안내'}
              onClick={() => setGalleryLog(log)}
            >
              {hasImages ? (
                <>
                  <svg className={styles.photoSvg} width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
                    <circle cx="9" cy="10" r="1.5" fill="currentColor" />
                    <path d="M5 17l4.5-4.5L13 16l2.5-2.5L19 17" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  </svg>
                  <span className={styles.photoCount}>{imageCount}</span>
                </>
              ) : (
                <span className={styles.photoEmpty}>없음</span>
              )}
            </button>
          )}
        </td>

        <EditableCell
          value={log.memo || ''}
          type="textarea"
          disabled={locked}
          className={styles.tdWrap}
          onSave={(v) => queueEdit(log, { memo: v })}
        />
      </tr>
    )
  }

  return (
    <div className={styles.container}>
      {schemaWarning ? (
        <div
          style={{
            marginBottom: 10,
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid #fcd34d',
            background: '#fffbeb',
            color: '#92400e',
            fontSize: '0.82rem',
            lineHeight: 1.45,
            whiteSpace: 'pre-wrap',
          }}
        >
          <strong>DB 설정 필요</strong>
          {'\n'}
          {schemaWarning}
        </div>
      ) : null}
      <div className={styles.headerSection}>
        <div className={styles.headerLeft}>
          <h2 className={styles.title}>서비스 / A.S 일지</h2>
          <p className={styles.hint}>
            {orgLabel ? <>현재 회사: <strong>{orgLabel}</strong> · </> : null}
            {locked
              ? '잠금 중 — 조회만 가능합니다.'
              : '셀을 클릭해 수정한 뒤 [저장]을 누르세요. 헤더 오른쪽 세로바를 드래그하면 열 너비를 조절할 수 있습니다.'}
          </p>
          <div className={styles.toolbar}>
            <input
              className={styles.searchInput}
              type="search"
              placeholder="찾기 (거래처, 증상, S/N, 담당자…)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <span className={styles.hint}>
                {sortedLogs.length}건 표시
                <button
                  type="button"
                  className={styles.actionBtn}
                  style={{ marginLeft: 6 }}
                  onClick={() => setQuery('')}
                >
                  초기화
                </button>
              </span>
            )}
            {dirtyCount > 0 && !locked && (
              <span className={styles.dirtyBadge}>미저장 {dirtyCount}건</span>
            )}
          </div>
        </div>

        <div className={styles.headerActions}>
          <Button
            variant="outline"
            size="sm"
            className={locked ? styles.lockOn : undefined}
            style={locked ? { backgroundColor: '#fef2f2', color: '#b91c1c', borderColor: '#fecaca' } : undefined}
            onClick={toggleLock}
          >
            {locked ? '잠금 해제' : '잠금'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setSelectedLog(null); setIsModalOpen(true) }}
            disabled={locked}
          >
            + 일지 작성
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExcelOpen(true)}
          >
            엑셀
          </Button>
          <Button
            variant="outline"
            size="sm"
            className={deleteMode ? styles.deleteModeOn : undefined}
            onClick={() => {
              if (locked) return alert('잠금 상태입니다.')
              setDeleteMode((v) => !v)
            }}
            disabled={locked}
          >
            {deleteMode ? '삭제 취소' : '삭제'}
          </Button>
          <Button
            variant="primary"
            size="sm"
            className={styles.saveBtn}
            onClick={handleSaveAll}
            disabled={locked || saving || dirtyCount === 0}
          >
            {saving ? '저장 중…' : '저장'}
          </Button>
        </div>
      </div>

      <div className={styles.filterStatsRow}>
        <div className={styles.periodBar}>
          <span className={styles.periodLabel}>기간</span>
          <div className={styles.periodYear}>
            <button
              type="button"
              className={styles.periodYearBtn}
              title="이전 해"
              onClick={() => {
                setPeriodYear((y) => y - 1)
                if (periodPreset === 'all') setPeriodPreset('month')
              }}
            >
              ‹
            </button>
            <span className={styles.periodYearLabel}>{periodYear}년</span>
            <button
              type="button"
              className={styles.periodYearBtn}
              title="다음 해"
              onClick={() => {
                setPeriodYear((y) => y + 1)
                if (periodPreset === 'all') setPeriodPreset('month')
              }}
            >
              ›
            </button>
          </div>
          <div className={styles.periodBtns}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <button
                key={m}
                type="button"
                className={`${styles.periodBtn} ${periodPreset === 'month' && periodMonth === m ? styles.periodBtnActive : ''}`}
                onClick={() => {
                  setPeriodPreset('month')
                  setPeriodMonth(m)
                }}
              >
                {m}월
              </button>
            ))}
            <button
              type="button"
              className={`${styles.periodBtn} ${periodPreset === 'all' ? styles.periodBtnActive : ''}`}
              onClick={() => setPeriodPreset('all')}
            >
              전체
            </button>
            <button
              type="button"
              className={`${styles.periodBtn} ${periodPreset === 'custom' ? styles.periodBtnActive : ''}`}
              onClick={() => setPeriodPreset('custom')}
            >
              기간지정
            </button>
          </div>
          {periodPreset === 'custom' && (
            <div className={styles.periodCustom}>
              <input
                type="date"
                className={styles.periodDate}
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
              <span className={styles.periodTilde}>~</span>
              <input
                type="date"
                className={styles.periodDate}
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </div>
          )}
        </div>

        <div className={styles.statsBar}>
          <button
            type="button"
            className={`${styles.statBtn} ${visitPin === 'none' ? styles.statBtnActive : ''}`}
            title="클릭: 거래처끼리 묶인 기본 정렬로"
            onClick={() => {
              setVisitPin('none')
              setClientSort('asc')
            }}
          >
            거래처 <strong>{summaryStats.clientCount}</strong>
          </button>
          <span className={styles.statDivider} />
          <span className={styles.statItem}>
            기계 <strong>{summaryStats.machineCount}</strong>
          </span>
          <span className={styles.statDivider} />
          <button
            type="button"
            className={`${styles.statBtn} ${visitPin === 'visited' ? styles.statBtnActive : ''}`}
            title="클릭: 이번 달 방문한 거래처를 위로"
            onClick={() => setVisitPin((v) => (v === 'visited' ? 'none' : 'visited'))}
          >
            이번 달 방문 <strong>{summaryStats.monthVisited}</strong>
          </button>
          <span className={styles.statDivider} />
          <button
            type="button"
            className={`${styles.statBtn} ${styles.statWarnBtn} ${visitPin === 'unvisited' ? styles.statBtnActiveWarn : ''}`}
            title="클릭: 이번 달 미방문을 위로"
            onClick={() => setVisitPin((v) => (v === 'unvisited' ? 'none' : 'unvisited'))}
          >
            이번 달 미방문 <strong>{summaryStats.monthUnvisited}</strong>
          </button>
          <span className={styles.statDivider} />
          <span className={styles.statItem}>
            표시 행 <strong>{summaryStats.rowCount}</strong>
          </span>
        </div>
      </div>

      <div className={`${styles.tableContainer} ${locked ? styles.tableContainerLocked : ''}`}>
        <table className={styles.table} style={{ minWidth: Math.max(tableMinWidth, 100), width: '100%' }}>
          <colgroup>
            {COL_KEYS.map((key) => (
              <col key={key} style={{ width: colWidths[key] }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <ResizableTh className={styles.th} width={colWidths.no} minWidth={32} onResize={(w) => setColWidth('no', w)}>No</ResizableTh>
              <ResizableTh className={styles.th} width={colWidths.status} minWidth={48} onResize={(w) => setColWidth('status', w)}>상태</ResizableTh>
              <ResizableTh className={styles.th} width={colWidths.visit} minWidth={72} onResize={(w) => setColWidth('visit', w)}>방문일자</ResizableTh>
              <ResizableTh className={styles.th} width={colWidths.type} minWidth={52} onResize={(w) => setColWidth('type', w)}>구분</ResizableTh>
              <ResizableTh className={styles.th} width={colWidths.client} minWidth={72} onResize={(w) => setColWidth('client', w)}>
                <button
                  type="button"
                  className={styles.sortThBtn}
                  onClick={() => setClientSort((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                  title="거래처명으로 묶어서 정렬"
                >
                  거래처명 {clientSort === 'asc' ? '↑' : '↓'}
                </button>
              </ResizableTh>
              <ResizableTh className={styles.th} width={colWidths.machine} minWidth={80} onResize={(w) => setColWidth('machine', w)}>기기정보</ResizableTh>
              <ResizableTh className={styles.th} width={colWidths.symptom} minWidth={80} onResize={(w) => setColWidth('symptom', w)}>증상/요청</ResizableTh>
              <ResizableTh className={styles.th} width={colWidths.action} minWidth={80} onResize={(w) => setColWidth('action', w)}>조치내용</ResizableTh>
              <ResizableTh className={styles.th} width={colWidths.parts} minWidth={72} onResize={(w) => setColWidth('parts', w)}>교체/배송</ResizableTh>
              <ResizableTh className={styles.th} width={colWidths.manager} minWidth={52} onResize={(w) => setColWidth('manager', w)}>담당자</ResizableTh>
              <ResizableTh className={styles.th} width={colWidths.stock} minWidth={72} onResize={(w) => setColWidth('stock', w)}>현재 재고</ResizableTh>
              <ResizableTh className={styles.th} width={colWidths.photos} minWidth={48} onResize={(w) => setColWidth('photos', w)}>사진</ResizableTh>
              <ResizableTh className={styles.th} width={colWidths.memo} minWidth={72} onResize={(w) => setColWidth('memo', w)}>메모</ResizableTh>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={13} className={styles.td}>
                  <div className={styles.emptyResult}>로딩 중...</div>
                </td>
              </tr>
            ) : displayRowGroups.length === 0 ? (
              <tr>
                <td colSpan={13} className={styles.td}>
                  <div className={styles.emptyResult}>
                    {query || periodPreset !== 'all'
                      ? '조건에 맞는 기록이 없습니다. 상단에서 「전체」 기간을 눌러 보세요.'
                      : (
                        <>
                          이 회사(조직)에는 아직 일지가 없습니다.
                          <br />
                          새 회원가입(새 회사 만들기)으로 들어오면 데이터가 비어 보입니다.
                          예전에 쓰던 내용이 필요하면 <strong>예전 계정으로 다시 로그인</strong>하세요.
                        </>
                      )}
                  </div>
                </td>
              </tr>
            ) : (
              displayRowGroups.flatMap((group, index) => {
                const expanded = Boolean(expandedKeys[group.key])
                const rows = [
                  renderLogRow(group.primary, index + 1, {
                    groupKey: group.key,
                    historyCount: group.history.length,
                    expanded,
                    isHistory: false,
                  }),
                ]
                if (expanded) {
                  group.history.forEach((h, hi) => {
                    rows.push(
                      renderLogRow(h, `${index + 1}-${hi + 1}`, {
                        groupKey: group.key,
                        historyCount: 0,
                        expanded: true,
                        isHistory: true,
                      })
                    )
                  })
                }
                return rows
              })
            )}
          </tbody>
        </table>
      </div>

      <ServiceExcelModal
        isOpen={excelOpen}
        onClose={() => setExcelOpen(false)}
        logs={logs}
        onImported={() => {
          fetchLogs()
        }}
      />

      <ServiceForm
        isOpen={isModalOpen}
        onClose={handleClose}
        onSuccess={fetchLogs}
        editData={selectedLog}
      />

      <PartsEditModal
        isOpen={Boolean(partsModalLog)}
        log={partsModalLog}
        locked={locked}
        onClose={() => setPartsModalLog(null)}
        onSuccess={fetchLogs}
      />

      {galleryLog && (
        <ServiceImageGallery
          logId={galleryLog.id}
          clientName={galleryLog.client?.name}
          locked={locked}
          onClose={() => {
            setGalleryLog(null)
            fetchLogs()
          }}
          onEditLog={() => {
            const log = galleryLog
            setGalleryLog(null)
            openLogEditor(log)
          }}
        />
      )}
    </div>
  )
}
