'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/utils/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { loadAppSettings } from '@/utils/appSettings'
import { getPendingPartsAction } from '@/app/actions/service'
import styles from './home.module.css'

type RecentLog = {
  id: string
  visit_date: string | null
  status: string | null
  service_type: string | null
  client?: { name?: string | null } | null
  inventory?: { model_name?: string | null } | null
}

type LowStockItem = {
  id: string
  model_name: string
  category: string | null
  color: string | null
  current_stock: number
}

interface DashboardData {
  clientCount: number
  inventoryInstalled: number
  inventoryWarehouse: number
  inventoryOther: number
  currentMonthAmount: number
  unpaidCount: number
  unpaidAmount: number
  serviceMonthTotal: number
  serviceMonthDone: number
  serviceMonthOpen: number
  serviceMonthHold: number
  pendingStockCount: number
  pendingStockQty: number
  lowStock: LowStockItem[]
  incompleteConsumables: number
  recentLogs: RecentLog[]
}

const emptyData: DashboardData = {
  clientCount: 0,
  inventoryInstalled: 0,
  inventoryWarehouse: 0,
  inventoryOther: 0,
  currentMonthAmount: 0,
  unpaidCount: 0,
  unpaidAmount: 0,
  serviceMonthTotal: 0,
  serviceMonthDone: 0,
  serviceMonthOpen: 0,
  serviceMonthHold: 0,
  pendingStockCount: 0,
  pendingStockQty: 0,
  lowStock: [],
  incompleteConsumables: 0,
  recentLogs: [],
}

function monthRange(d = new Date()) {
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const start = `${y}-${String(m).padStart(2, '0')}-01`
  const last = new Date(y, m, 0).getDate()
  const end = `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`
  return { y, m, start, end }
}

function statusBadge(status: string | null) {
  if (status === '완료') return styles.badgeDone
  if (status === '보류') return styles.badgeHold
  return styles.badgeOpen
}

export default function HomePage() {
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState('')
  const [orgName, setOrgName] = useState('')
  const [dashboardNote, setDashboardNote] = useState('')
  const [data, setData] = useState<DashboardData>(emptyData)
  const supabase = createClient()
  const router = useRouter()
  const { m: month } = useMemo(() => monthRange(), [])

  useEffect(() => {
    setDashboardNote(loadAppSettings().general.dashboardNote)
    const onChange = () => setDashboardNote(loadAppSettings().general.dashboardNote)
    window.addEventListener('app-settings-changed', onChange)
    return () => window.removeEventListener('app-settings-changed', onChange)
  }, [])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/login')
          return
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('name, organizations ( id, name )')
          .eq('id', user.id)
          .single()

        if (!profile) return

        setUserName(profile.name || '사용자')
        const orgData = profile.organizations as any
        const org = Array.isArray(orgData) ? orgData[0] : orgData
        setOrgName(org?.name || '소속 없음')
        const orgId = org?.id
        if (!orgId) return

        const { y, m, start, end } = monthRange()
        const lowThreshold = loadAppSettings().stock.lowStockThreshold

        const [
          clientsRes,
          inventoryRes,
          settlementRes,
          unpaidRes,
          serviceMonthRes,
          recentLogsRes,
          consumablesRes,
          pendingRes,
        ] = await Promise.all([
          supabase
            .from('clients')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', orgId)
            .eq('is_deleted', false),
          supabase.from('inventory').select('status').eq('organization_id', orgId),
          supabase
            .from('settlements')
            .select('total_amount')
            .eq('organization_id', orgId)
            .eq('billing_year', y)
            .eq('billing_month', m),
          supabase
            .from('settlements')
            .select('total_amount, is_paid')
            .eq('organization_id', orgId)
            .eq('is_paid', false),
          supabase
            .from('service_logs')
            .select('id, status')
            .eq('organization_id', orgId)
            .gte('visit_date', start)
            .lte('visit_date', end),
          supabase
            .from('service_logs')
            .select('id, visit_date, status, service_type, client:clients(name), inventory:inventory(model_name)')
            .eq('organization_id', orgId)
            .order('visit_date', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(8),
          supabase
            .from('consumables')
            .select('id, model_name, category, color, current_stock, is_active, compatible_models:consumable_compatible_models(machine_model)')
            .eq('organization_id', orgId)
            .or('is_active.is.null,is_active.eq.true'),
          getPendingPartsAction(),
        ])

        const invData = inventoryRes.data || []
        const installed = invData.filter((i: any) => i.status === '설치').length
        const warehouse = invData.filter((i: any) => i.status === '창고').length

        const settlementData = settlementRes.data || []
        const totalAmount = settlementData.reduce(
          (sum: number, row: any) => sum + (Number(row.total_amount) || 0),
          0
        )
        const unpaidRows = unpaidRes.data || []
        const unpaidAmount = unpaidRows.reduce(
          (sum: number, row: any) => sum + (Number(row.total_amount) || 0),
          0
        )

        const serviceRows = serviceMonthRes.data || []
        const serviceDone = serviceRows.filter((r: any) => r.status === '완료').length
        const serviceHold = serviceRows.filter((r: any) => r.status === '보류').length
        const serviceOpenAll = serviceRows.length - serviceDone - serviceHold

        let consumables = consumablesRes.data || []
        if (consumablesRes.error) {
          const fallback = await supabase
            .from('consumables')
            .select('id, model_name, category, color, current_stock, is_active')
            .eq('organization_id', orgId)
          consumables = (fallback.data || []).filter((c: any) => c.is_active !== false) as typeof consumables
        }

        const lowStock = (consumables as any[])
          .filter((c) => Number(c.current_stock) < lowThreshold)
          .sort((a, b) => Number(a.current_stock) - Number(b.current_stock))
          .slice(0, 8)
          .map((c) => ({
            id: c.id,
            model_name: c.model_name,
            category: c.category,
            color: c.color,
            current_stock: Number(c.current_stock) || 0,
          }))

        const incompleteConsumables = (consumables as any[]).filter((c) => {
          const models = Array.isArray(c.compatible_models)
            ? c.compatible_models.map((x: any) => x?.machine_model || x).filter(Boolean)
            : []
          const noCompat = models.length === 0
          const tonerDrum = c.category === '토너' || c.category === '드럼'
          const noColor = tonerDrum && (!c.color || String(c.color).trim() === '')
          return noCompat || noColor
        }).length

        const pendingRows = pendingRes?.data || []
        const pendingStockQty = pendingRows.reduce(
          (s: number, r: any) => s + (Number(r.quantity) || 0),
          0
        )

        setData({
          clientCount: clientsRes.count || 0,
          inventoryInstalled: installed,
          inventoryWarehouse: warehouse,
          inventoryOther: Math.max(0, invData.length - installed - warehouse),
          currentMonthAmount: totalAmount,
          unpaidCount: unpaidRows.length,
          unpaidAmount,
          serviceMonthTotal: serviceRows.length,
          serviceMonthDone: serviceDone,
          serviceMonthOpen: serviceOpenAll,
          serviceMonthHold: serviceHold,
          pendingStockCount: pendingRows.length,
          pendingStockQty,
          lowStock,
          incompleteConsumables,
          recentLogs: (recentLogsRes.data || []) as RecentLog[],
        })
      } catch (error) {
        console.error('데이터 로딩 실패:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [router, supabase])

  if (loading) {
    return <div className="pageShell" style={{ color: '#666' }}>데이터를 불러오는 중...</div>
  }

  const alerts: { href: string; text: string; kind: 'warn' | 'danger' | 'info' }[] = []
  if (data.pendingStockCount > 0) {
    alerts.push({
      href: '/inventory',
      kind: 'warn',
      text: `미입고(가출고) ${data.pendingStockCount}건 · ${data.pendingStockQty}개 대기`,
    })
  }
  if (data.lowStock.length > 0) {
    alerts.push({
      href: '/inventory',
      kind: 'danger',
      text: `재고 부족 ${data.lowStock.length}품목 이상`,
    })
  }
  if (data.unpaidCount > 0) {
    alerts.push({
      href: '/accounting',
      kind: 'danger',
      text: `미수금 ${data.unpaidCount}건 · ${data.unpaidAmount.toLocaleString()}원`,
    })
  }
  if (data.incompleteConsumables > 0) {
    alerts.push({
      href: '/inventory',
      kind: 'info',
      text: `소모품 정리 필요 ${data.incompleteConsumables}건 (색상/호환)`,
    })
  }
  if (data.serviceMonthOpen > 0) {
    alerts.push({
      href: '/service',
      kind: 'info',
      text: `이번 달 미완료 일지 ${data.serviceMonthOpen}건`,
    })
  }

  return (
    <div className={`pageShell ${styles.wrap}`}>
      <section className={styles.header}>
        <h1 className={styles.title}>안녕하세요, {userName}님</h1>
        <p className={styles.sub}>
          <strong style={{ color: '#0070f3' }}>{orgName}</strong>
          {' · '}
          {month}월 운영 현황
        </p>
        {dashboardNote ? <p className={styles.note}>{dashboardNote}</p> : null}
      </section>

      {alerts.length > 0 && (
        <section className={styles.alerts}>
          {alerts.map((a) => (
            <Link
              key={a.text}
              href={a.href}
              className={`${styles.alert} ${
                a.kind === 'danger'
                  ? styles.alertDanger
                  : a.kind === 'warn'
                    ? styles.alertWarn
                    : styles.alertInfo
              }`}
            >
              {a.text}
            </Link>
          ))}
        </section>
      )}

      <section className={styles.grid}>
        <Link href="/clients" className={`${styles.card} ${styles.cardLink}`}>
          <div className={styles.cardLabel}>거래처</div>
          <div className={styles.cardValue}>
            {data.clientCount} <span className={styles.cardUnit}>곳</span>
          </div>
        </Link>

        <Link href="/inventory" className={`${styles.card} ${styles.cardLink}`}>
          <div className={styles.cardLabel}>설치 기기</div>
          <div className={styles.cardValue}>
            {data.inventoryInstalled} <span className={styles.cardUnit}>대</span>
          </div>
          <div className={styles.cardHint}>
            창고 {data.inventoryWarehouse}
            {data.inventoryOther > 0 ? ` · 기타 ${data.inventoryOther}` : ''}
          </div>
        </Link>

        <Link href="/service" className={`${styles.card} ${styles.cardLink}`}>
          <div className={styles.cardLabel}>{month}월 서비스 일지</div>
          <div className={styles.cardValue}>
            {data.serviceMonthTotal} <span className={styles.cardUnit}>건</span>
          </div>
          <div className={styles.statLine}>
            <span>완료</span>
            <strong>{data.serviceMonthDone}</strong>
          </div>
          <div className={styles.statLine}>
            <span>미완료</span>
            <strong>{data.serviceMonthOpen}</strong>
          </div>
          {data.serviceMonthHold > 0 && (
            <div className={styles.statLine}>
              <span>보류</span>
              <strong>{data.serviceMonthHold}</strong>
            </div>
          )}
        </Link>

        <Link href="/accounting" className={`${styles.card} ${styles.cardLink}`}>
          <div className={styles.cardLabel}>{month}월 청구액</div>
          <div className={styles.cardValue} style={{ fontSize: '1.35rem', color: '#0070f3' }}>
            {data.currentMonthAmount.toLocaleString()}
            <span className={styles.cardUnit}> 원</span>
          </div>
          <div className={styles.cardHint}>
            {data.unpaidCount > 0
              ? `미수 ${data.unpaidCount}건`
              : '미수금 없음'}
          </div>
        </Link>

        <Link href="/inventory" className={`${styles.card} ${styles.cardLink}`}>
          <div className={styles.cardLabel}>미입고(가출고)</div>
          <div className={styles.cardValue}>
            {data.pendingStockCount} <span className={styles.cardUnit}>건</span>
          </div>
          <div className={styles.cardHint}>
            {data.pendingStockQty > 0 ? `수량 ${data.pendingStockQty}개 대기` : '대기 없음'}
          </div>
        </Link>

        <Link href="/inventory" className={`${styles.card} ${styles.cardLink}`}>
          <div className={styles.cardLabel}>재고 부족</div>
          <div className={styles.cardValue} style={{ color: data.lowStock.length ? '#b91c1c' : undefined }}>
            {data.lowStock.length} <span className={styles.cardUnit}>품목</span>
          </div>
          <div className={styles.cardHint}>설정 기준 미만</div>
        </Link>
      </section>

      <section className={styles.twoCol}>
        <div className={styles.section} style={{ marginBottom: 0 }}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>최근 서비스 일지</h2>
            <Link href="/service" className={styles.sectionMore}>전체 보기</Link>
          </div>
          <div className={styles.panel}>
            {data.recentLogs.length === 0 ? (
              <div className={styles.empty}>등록된 일지가 없습니다.</div>
            ) : (
              data.recentLogs.map((log) => (
                <div key={log.id} className={styles.row}>
                  <div className={styles.rowMain}>
                    <div className={styles.rowTitle}>{log.client?.name || '거래처 없음'}</div>
                    <div className={styles.rowMeta}>
                      {log.visit_date || '-'}
                      {log.inventory?.model_name ? ` · ${log.inventory.model_name}` : ''}
                      {log.service_type ? ` · ${log.service_type}` : ''}
                    </div>
                  </div>
                  <span className={`${styles.badge} ${statusBadge(log.status)}`}>
                    {log.status || '접수'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className={styles.section} style={{ marginBottom: 0 }}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>재고 주의</h2>
            <Link href="/inventory" className={styles.sectionMore}>재고 관리</Link>
          </div>
          <div className={styles.panel}>
            {data.lowStock.length === 0 ? (
              <div className={styles.empty}>부족한 재고가 없습니다.</div>
            ) : (
              data.lowStock.map((item) => (
                <div key={item.id} className={styles.row}>
                  <div className={styles.rowMain}>
                    <div className={styles.rowTitle}>{item.model_name}</div>
                    <div className={styles.rowMeta}>
                      {[item.category, item.color].filter(Boolean).join(' · ') || '소모품'}
                    </div>
                  </div>
                  <strong style={{ color: '#b91c1c', fontSize: '0.9rem' }}>
                    {item.current_stock}
                  </strong>
                </div>
              ))
            )}
            {data.incompleteConsumables > 0 && (
              <div className={styles.row} style={{ background: '#fffbeb' }}>
                <div className={styles.rowMain}>
                  <div className={styles.rowTitle}>색상/호환 미설정</div>
                  <div className={styles.rowMeta}>일지 매칭을 위해 정리가 필요합니다</div>
                </div>
                <strong style={{ color: '#92400e' }}>{data.incompleteConsumables}</strong>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>바로가기</h2>
        </div>
        <div className={styles.shortcuts}>
          <Link href="/service" className={styles.shortcut}>
            <span className={styles.shortcutTitle}>서비스 일지</span>
            <span className={styles.shortcutDesc}>방문·교체·배송·미입고 연동</span>
          </Link>
          <Link href="/inventory" className={styles.shortcut}>
            <span className={styles.shortcutTitle}>자산·재고</span>
            <span className={styles.shortcutDesc}>기기·소모품·호환·미입고 확정</span>
          </Link>
          <Link href="/clients" className={styles.shortcut}>
            <span className={styles.shortcutTitle}>거래처</span>
            <span className={styles.shortcutDesc}>거래처·설치 기기 관리</span>
          </Link>
          <Link href="/accounting" className={styles.shortcut}>
            <span className={styles.shortcutTitle}>정산·회계</span>
            <span className={styles.shortcutDesc}>월별 청구·미수 확인</span>
          </Link>
          <Link href="/settings" className={styles.shortcut}>
            <span className={styles.shortcutTitle}>설정</span>
            <span className={styles.shortcutDesc}>계정·카테고리·일지 옵션</span>
          </Link>
        </div>
      </section>
    </div>
  )
}
