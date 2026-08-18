'use server'

import { createClient } from '@/utils/supabase/server'
import { getPendingPartsAction } from '@/app/actions/service'
import { detectClientIssues, groupClientIssues, clientIssueKindTitle } from '@/utils/clientIssues'

export type OpsIssueItem = {
  id: string
  label: string
  detail?: string
}

export type OpsIssueGroup = {
  id: string
  title: string
  count: number
  href: string
  severity: 'warn' | 'error'
  items: OpsIssueItem[]
}

async function requireOrg() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { supabase, orgId: null as string | null }
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()
  return { supabase, orgId: (profile?.organization_id as string) || null }
}

function monthRange(d = new Date()) {
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const start = `${y}-${String(m).padStart(2, '0')}-01`
  const last = new Date(y, m, 0).getDate()
  const end = `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`
  return { y, m, start, end }
}

/** 전 페이지 상단 공통: 해결/수정이 필요한 항목 요약 */
export async function getOpsIssuesSummaryAction(lowStockThreshold = 5): Promise<{
  success: boolean
  message?: string
  groups: OpsIssueGroup[]
}> {
  const { supabase, orgId } = await requireOrg()
  if (!orgId) return { success: false, message: '조직 없음', groups: [] }

  const threshold = Math.max(0, Math.floor(Number(lowStockThreshold) || 0))
  const { start, end } = monthRange()
  const groups: OpsIssueGroup[] = []

  const [clientsRes, unpaidRes, serviceOpenRes, consumablesRes, inventoryRes, quotesRes, pendingRes] =
    await Promise.all([
      supabase
        .from('clients')
        .select(
          'id, name, address, phone, office_phone, business_number, parent_id, status, is_deleted'
        )
        .eq('organization_id', orgId)
        .eq('is_deleted', false),
      supabase
        .from('settlements')
        .select('id, total_amount, billing_year, billing_month')
        .eq('organization_id', orgId)
        .eq('is_paid', false),
      supabase
        .from('service_logs')
        .select('id, status, visit_date, client:clients(name)')
        .eq('organization_id', orgId)
        .gte('visit_date', start)
        .lte('visit_date', end),
      supabase
        .from('consumables')
        .select(
          'id, model_name, category, color, current_stock, is_active, compatible_models:consumable_compatible_models(machine_model)'
        )
        .eq('organization_id', orgId)
        .or('is_active.is.null,is_active.eq.true'),
      supabase
        .from('inventory')
        .select('id, model_name, serial_number, status, client_id, plan_basic_fee')
        .eq('organization_id', orgId),
      supabase
        .from('quotes')
        .select('id, client_name, quote_no, status')
        .eq('organization_id', orgId)
        .eq('status', 'draft'),
      getPendingPartsAction(),
    ])

  // 거래처
  const clients = (clientsRes.data || []) as any[]
  const clientIssues = detectClientIssues(clients as any)
  if (clientIssues.length > 0) {
    const grouped = groupClientIssues(clientIssues)
    for (const g of grouped) {
      groups.push({
        id: `client_${g.kind}`,
        title: clientIssueKindTitle(g.kind),
        count: g.items.length,
        href: '/clients',
        severity: g.kind === 'dup_name' || g.kind === 'dup_biz' || g.kind === 'orphan_parent' ? 'error' : 'warn',
        items: g.items.slice(0, 8).map((i) => ({
          id: `${i.kind}-${i.clientId}`,
          label: i.label,
          detail: i.detail,
        })),
      })
    }
  }

  // 미입고
  const pending = pendingRes.success ? pendingRes.data || [] : []
  if (pending.length > 0) {
    groups.push({
      id: 'pending_stock',
      title: '미입고(가출고) 대기',
      count: pending.length,
      href: '/inventory',
      severity: 'error',
      items: pending.slice(0, 8).map((p: any) => ({
        id: String(p.id),
        label: p.consumable?.model_name || '소모품',
        detail: `${p.quantity || 0}개 · ${p.service_log?.client?.name || ''}`.trim(),
      })),
    })
  }

  // 소모품 정리 / 재고 부족
  const consumables = consumablesRes.data || []
  const incomplete = consumables.filter((c: any) => {
    const comps = c.compatible_models || []
    const noCompat = !Array.isArray(comps) || comps.length === 0
    const needsColor = c.category === '토너' || c.category === '드럼'
    const noColor = needsColor && !String(c.color || '').trim()
    return noCompat || noColor
  })
  if (incomplete.length > 0) {
    groups.push({
      id: 'incomplete_consumables',
      title: '소모품 정리 필요',
      count: incomplete.length,
      href: '/inventory',
      severity: 'warn',
      items: incomplete.slice(0, 8).map((c: any) => ({
        id: c.id,
        label: c.model_name,
        detail:
          [
            !String(c.color || '').trim() && (c.category === '토너' || c.category === '드럼')
              ? '색상없음'
              : '',
            !(c.compatible_models || []).length ? '호환없음' : '',
          ]
            .filter(Boolean)
            .join(' · ') || '정리 필요',
      })),
    })
  }

  const lowStock = consumables.filter(
    (c: any) => Number(c.current_stock) < threshold && Number(c.current_stock) >= 0
  )
  if (lowStock.length > 0) {
    groups.push({
      id: 'low_stock',
      title: '재고 부족',
      count: lowStock.length,
      href: '/inventory',
      severity: 'warn',
      items: lowStock.slice(0, 8).map((c: any) => ({
        id: c.id,
        label: c.model_name,
        detail: `재고 ${c.current_stock}`,
      })),
    })
  }

  // 설치 기기인데 거래처 없음 / 요금 미설정
  const inventory = inventoryRes.data || []
  const installedNoClient = inventory.filter((i: any) => i.status === '설치' && !i.client_id)
  if (installedNoClient.length > 0) {
    groups.push({
      id: 'installed_no_client',
      title: '설치 기기 · 거래처 미연결',
      count: installedNoClient.length,
      href: '/inventory',
      severity: 'error',
      items: installedNoClient.slice(0, 8).map((i: any) => ({
        id: i.id,
        label: i.model_name || i.serial_number || '기기',
        detail: i.serial_number || '',
      })),
    })
  }

  const installedNoPlan = inventory.filter(
    (i: any) => i.status === '설치' && i.client_id && (i.plan_basic_fee == null || i.plan_basic_fee === '')
  )
  if (installedNoPlan.length > 0) {
    groups.push({
      id: 'installed_no_plan',
      title: '설치 기기 · 요금제 미설정',
      count: installedNoPlan.length,
      href: '/inventory',
      severity: 'warn',
      items: installedNoPlan.slice(0, 8).map((i: any) => ({
        id: i.id,
        label: i.model_name || i.serial_number || '기기',
        detail: '기본료 미설정',
      })),
    })
  }

  // 미수금
  const unpaid = unpaidRes.data || []
  if (unpaid.length > 0) {
    const amount = unpaid.reduce((s: number, r: any) => s + (Number(r.total_amount) || 0), 0)
    groups.push({
      id: 'unpaid',
      title: `미수금(미입금 정산) · ₩${amount.toLocaleString('ko-KR')}`,
      count: unpaid.length,
      href: '/accounting/history',
      severity: 'error',
      items: unpaid.slice(0, 8).map((r: any) => ({
        id: r.id,
        label: `${r.billing_year}.${r.billing_month}`,
        detail: `₩${Number(r.total_amount || 0).toLocaleString('ko-KR')}`,
      })),
    })
  }

  // 이번 달 미완료 서비스
  const openLogs = (serviceOpenRes.data || []).filter(
    (l: any) => l.status !== '완료' && l.status !== '보류'
  )
  if (openLogs.length > 0) {
    groups.push({
      id: 'open_service',
      title: '이번 달 미완료 서비스',
      count: openLogs.length,
      href: '/service',
      severity: 'warn',
      items: openLogs.slice(0, 8).map((l: any) => ({
        id: l.id,
        label: l.client?.name || '거래처',
        detail: `${l.status || ''} · ${l.visit_date || ''}`.trim(),
      })),
    })
  }

  // 견적 작성중
  if (!quotesRes.error) {
    const drafts = quotesRes.data || []
    if (drafts.length > 0) {
      groups.push({
        id: 'quote_drafts',
        title: '견적서 작성중',
        count: drafts.length,
        href: '/quotes',
        severity: 'warn',
        items: drafts.slice(0, 8).map((q: any) => ({
          id: q.id,
          label: q.client_name || '수신처 미정',
          detail: q.quote_no || '번호 없음',
        })),
      })
    }
  }

  return { success: true, groups }
}
