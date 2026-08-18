import type { Client } from '@/app/types'

export type ClientIssueKind =
  | 'dup_name'
  | 'dup_biz'
  | 'no_address'
  | 'no_contact'
  | 'orphan_parent'

export type ClientIssue = {
  kind: ClientIssueKind
  clientId: string
  label: string
  detail: string
}

function normName(name: string) {
  return String(name || '').trim().toLowerCase()
}

function normBiz(biz: string) {
  return String(biz || '').replace(/[\s-]/g, '').toLowerCase()
}

const KIND_TITLE: Record<ClientIssueKind, string> = {
  dup_name: '중복 거래처명',
  dup_biz: '중복 사업자번호',
  no_address: '주소 없음',
  no_contact: '연락처 부족',
  orphan_parent: '소속본사 오류',
}

export function clientIssueKindTitle(kind: ClientIssueKind) {
  return KIND_TITLE[kind]
}

/** 거래처 목록에서 중복·오류·부족 항목 검출 */
export function detectClientIssues(clients: Client[]): ClientIssue[] {
  const issues: ClientIssue[] = []
  const byId = new Map(clients.map((c) => [c.id, c]))

  const nameGroups = new Map<string, Client[]>()
  const bizGroups = new Map<string, Client[]>()

  for (const c of clients) {
    const nk = normName(c.name)
    if (nk) {
      const list = nameGroups.get(nk) || []
      list.push(c)
      nameGroups.set(nk, list)
    }
    const bk = normBiz(c.business_number || '')
    if (bk) {
      const list = bizGroups.get(bk) || []
      list.push(c)
      bizGroups.set(bk, list)
    }
  }

  for (const [, group] of nameGroups) {
    if (group.length < 2) continue
    for (const c of group) {
      issues.push({
        kind: 'dup_name',
        clientId: c.id,
        label: c.name,
        detail: `동일 상호 ${group.length}건`,
      })
    }
  }

  for (const [, group] of bizGroups) {
    if (group.length < 2) continue
    for (const c of group) {
      issues.push({
        kind: 'dup_biz',
        clientId: c.id,
        label: `${c.name} (${c.business_number})`,
        detail: `동일 사업자번호 ${group.length}건`,
      })
    }
  }

  for (const c of clients) {
    if (!String(c.address || '').trim()) {
      issues.push({
        kind: 'no_address',
        clientId: c.id,
        label: c.name,
        detail: '주소 미입력',
      })
    }

    const hasPhone = Boolean(String(c.phone || '').trim() || String(c.office_phone || '').trim())
    if (!hasPhone) {
      issues.push({
        kind: 'no_contact',
        clientId: c.id,
        label: c.name,
        detail: '연락처 미입력',
      })
    }

    if (c.parent_id && !byId.has(c.parent_id)) {
      issues.push({
        kind: 'orphan_parent',
        clientId: c.id,
        label: c.name,
        detail: '소속 본사를 찾을 수 없음',
      })
    }
  }

  return issues
}

export function groupClientIssues(issues: ClientIssue[]) {
  const order: ClientIssueKind[] = [
    'dup_name',
    'dup_biz',
    'orphan_parent',
    'no_address',
    'no_contact',
  ]
  return order
    .map((kind) => ({
      kind,
      title: KIND_TITLE[kind],
      items: issues.filter((i) => i.kind === kind),
    }))
    .filter((g) => g.items.length > 0)
}
