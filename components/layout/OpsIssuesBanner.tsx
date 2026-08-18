'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { getOpsIssuesSummaryAction, type OpsIssueGroup } from '@/app/actions/opsIssues'
import { loadAppSettings } from '@/utils/appSettings'
import styles from './OpsIssuesBanner.module.css'

export default function OpsIssuesBanner() {
  const [groups, setGroups] = useState<OpsIssueGroup[]>([])
  const [open, setOpen] = useState(true)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const threshold = loadAppSettings().stock.lowStockThreshold
    const res = await getOpsIssuesSummaryAction(threshold)
    setGroups(res.groups || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)
    window.addEventListener('ops-issues-refresh', load)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('ops-issues-refresh', load)
    }
  }, [load])

  const sorted = useMemo(() => {
    return [...groups].sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === 'error' ? -1 : 1
      return b.count - a.count
    })
  }, [groups])

  const total = sorted.reduce((s, g) => s + g.count, 0)

  if ((loading && groups.length === 0) || total === 0) return null

  return (
    <div className={styles.wrap} data-severity={sorted.some((g) => g.severity === 'error') ? 'error' : 'warn'}>
      <div className={styles.header}>
        <div className={styles.title}>
          문제 해결이 필요한 내용 <span className={styles.count}>{total}건</span>
        </div>
        <button type="button" className={styles.toggle} onClick={() => setOpen((v) => !v)}>
          {open ? '접기' : '펼치기'}
        </button>
      </div>
      {!open ? (
        <div className={styles.summaryLine}>
          {sorted.slice(0, 4).map((g) => (
            <Link key={g.id} href={g.href} className={styles.summaryChip}>
              {g.title} {g.count}
            </Link>
          ))}
          {sorted.length > 4 ? <span className={styles.more}>…</span> : null}
        </div>
      ) : (
        <div className={styles.groups}>
          {sorted.map((g) => (
            <div key={g.id} className={styles.group}>
              <div className={styles.groupHead}>
                <Link href={g.href} className={styles.groupTitle}>
                  {g.title} {g.count}건
                </Link>
                <Link href={g.href} className={styles.go}>
                  바로가기 →
                </Link>
              </div>
              {g.items.length > 0 ? (
                <div className={styles.chips}>
                  {g.items.map((item) => (
                    <Link key={item.id} href={g.href} className={styles.chip} title={item.detail}>
                      {item.label}
                      {item.detail ? <span className={styles.chipDetail}> ·{item.detail}</span> : null}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
