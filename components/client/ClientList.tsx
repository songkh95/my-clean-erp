// components/client/ClientList.tsx
'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/utils/supabase'
import ClientForm from './ClientForm'
import PlanSettingModal from './PlanSettingModal'
import MachineReplaceModal from './MachineReplaceModal'
import MachineWithdrawModal from './MachineWithdrawModal'
import InventoryForm from '../inventory/InventoryForm'
import Button from '@/components/ui/Button' 
import styles from './ClientList.module.css'
import { Client, Inventory } from '@/app/types'
// ✅ [추가] 서버 액션 임포트
import { deleteClientAction } from '@/app/actions/client'
import ClientExcelModal from './ClientExcelModal'
import {
  detectClientIssues,
  groupClientIssues,
  clientIssueKindTitle,
} from '@/utils/clientIssues'

export default function ClientList() {
  const supabase = createClient()

  const [clients, setClients] = useState<Client[]>([])
  const [assetsMap, setAssetsMap] = useState<{[key: string]: Inventory[]}>({})
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  
  // 모달 상태
  const [isRegModalOpen, setIsRegModalOpen] = useState(false)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [planModalOpen, setPlanModalOpen] = useState(false)
  const [selectedAssetForPlan, setSelectedAssetForPlan] = useState<{id: string, clientId: string} | null>(null)
  
  const [addMachineModalOpen, setAddMachineModalOpen] = useState(false)
  const [clientForMachineAdd, setClientForMachineAdd] = useState<Client | null>(null)

  const [replaceModalOpen, setReplaceModalOpen] = useState(false)
  const [selectedAssetForReplace, setSelectedAssetForReplace] = useState<Inventory | null>(null)
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false)
  const [selectedAssetForWithdraw, setSelectedAssetForWithdraw] = useState<Inventory | null>(null)
  const [excelModalOpen, setExcelModalOpen] = useState(false)

  useEffect(() => { fetchClients() }, [])

  const fetchClients = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
      
      if (profile?.organization_id) {
        const { data: clientData } = await supabase.from('clients')
          .select('*')
          .eq('organization_id', profile.organization_id)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false })
        
        if (clientData) setClients(clientData as Client[])

        const { data: assetData } = await supabase.from('inventory')
          .select('*')
          .eq('organization_id', profile.organization_id)
          .not('client_id', 'is', null)
          .order('created_at', { ascending: true })
        
        const map: {[key: string]: Inventory[]} = {}
        if (assetData) {
          (assetData as Inventory[]).forEach((inv) => {
            if (inv.client_id) {
              if (!map[inv.client_id]) map[inv.client_id] = []
              map[inv.client_id].push(inv)
            }
          })
        }
        setAssetsMap(map)
      }
    }
    setLoading(false)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('ops-issues-refresh'))
    }
  }

  // ✅ [수정] 삭제 로직을 Server Action 호출로 변경
  const handleDelete = async (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation()
    if (confirm(`'${name}' 거래처를 정말로 삭제하시겠습니까?`)) { 
      try {
        const result = await deleteClientAction(id)
        if (result.success) {
          alert(result.message)
          fetchClients()
        } else {
          throw new Error(result.message)
        }
      } catch (e: any) {
        alert('삭제 실패: ' + e.message)
      }
    }
  }

  const toggleExpand = (clientId: string) => {
    const newSet = new Set(expandedRows)
    if (newSet.has(clientId)) newSet.delete(clientId)
    else newSet.add(clientId)
    setExpandedRows(newSet)
  }

  const handleAddMachineClick = (e: React.MouseEvent, client: Client) => {
    e.stopPropagation()
    setClientForMachineAdd(client)
    setAddMachineModalOpen(true)
  }

  const handleReplaceClick = (asset: Inventory) => {
    setSelectedAssetForReplace(asset)
    setReplaceModalOpen(true)
  }

  const handleWithdrawClick = (asset: Inventory) => {
    setSelectedAssetForWithdraw(asset)
    setWithdrawModalOpen(true)
  }

  const handleEdit = (e: React.MouseEvent, client: Client) => {
    e.stopPropagation()
    setSelectedClient(client)
    setIsRegModalOpen(true)
  }

  /** 본사 바로 아래에 소속 자사(지사)가 오도록 정렬 */
  const sortClientsByHierarchy = (list: Client[]): Client[] => {
    const byId = new Map(list.map((c) => [c.id, c]))
    const childrenMap = new Map<string, Client[]>()
    const roots: Client[] = []

    for (const c of list) {
      if (c.parent_id && byId.has(c.parent_id)) {
        const kids = childrenMap.get(c.parent_id) || []
        kids.push(c)
        childrenMap.set(c.parent_id, kids)
      } else {
        roots.push(c)
      }
    }

    const byName = (a: Client, b: Client) =>
      (a.name || '').localeCompare(b.name || '', 'ko')

    roots.sort(byName)
    for (const kids of childrenMap.values()) kids.sort(byName)

    const ordered: Client[] = []
    const walk = (node: Client) => {
      ordered.push(node)
      for (const child of childrenMap.get(node.id) || []) walk(child)
    }
    for (const root of roots) walk(root)
    return ordered
  }

  const filteredClients = (() => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return sortClientsByHierarchy(clients)

    const matched = new Set(
      clients
        .filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            (c.address && c.address.toLowerCase().includes(q))
        )
        .map((c) => c.id)
    )

    // 검색된 본사의 자사, 검색된 자사의 본사도 함께 보이게
    for (const c of clients) {
      if (matched.has(c.id) && c.parent_id) matched.add(c.parent_id)
    }
    for (const c of clients) {
      if (c.parent_id && matched.has(c.parent_id)) matched.add(c.id)
    }

    return sortClientsByHierarchy(clients.filter((c) => matched.has(c.id)))
  })()

  const clientIssues = useMemo(() => detectClientIssues(clients), [clients])
  const clientIssueGroups = useMemo(() => groupClientIssues(clientIssues), [clientIssues])

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span>거래처</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Button variant="outline" size="sm" onClick={() => setExcelModalOpen(true)}>
            엑셀
          </Button>
          <Button variant="primary" size="sm" onClick={() => { setSelectedClient(null); setIsRegModalOpen(true); }}>
            + 등록
          </Button>
        </div>
      </div>

      {clientIssueGroups.length > 0 && (
        <div className={styles.issueBanner}>
          <div className={styles.issueTitle}>
            문제 해결이 필요한 내용 {clientIssues.length}건
          </div>
          <p className={styles.issueDesc}>
            중복·오류·부족한 정보가 있습니다. 항목을 누르면 수정 화면이 열립니다.
          </p>
          {clientIssueGroups.map((group) => (
            <div key={group.kind} className={styles.issueGroup}>
              <div className={styles.issueGroupTitle}>
                {clientIssueKindTitle(group.kind)} {group.items.length}건
              </div>
              <div className={styles.issueChips}>
                {group.items.slice(0, 8).map((issue) => (
                  <button
                    key={`${issue.kind}-${issue.clientId}`}
                    type="button"
                    className={styles.issueChip}
                    title={issue.detail}
                    onClick={() => {
                      const client = clients.find((c) => c.id === issue.clientId)
                      if (!client) return
                      setSelectedClient(client)
                      setIsRegModalOpen(true)
                    }}
                  >
                    {issue.label}
                    <span className={styles.issueChipDetail}> ·{issue.detail}</span>
                  </button>
                ))}
                {group.items.length > 8 ? <span className={styles.issueMore}>…</span> : null}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className={styles.searchContainer}>
        <input 
          className={styles.searchInput}
          placeholder="거래처명 또는 주소로 검색..." 
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      <div className={styles.listHeader}>
        <div>거래처명</div>
        <div>연락처/주소</div>
        <div>기기</div>
        <div style={{ textAlign: 'right' }}>관리</div>
      </div>

      {loading ? (
        <div className={styles.noResult}>로딩 중...</div>
      ) : filteredClients.map((client) => {
        const isExpanded = expandedRows.has(client.id)
        const assets = assetsMap[client.id] || []

        return (
          <div key={client.id} className={styles.clientRow}>
            <div 
              className={`${styles.clientSummary} ${isExpanded ? styles.clientSummarySelected : ''}`}
              onClick={() => toggleExpand(client.id)}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  fontWeight: '600',
                  paddingLeft: client.parent_id ? 20 : 0,
                }}
              >
                {client.parent_id ? (
                  <span className={`${styles.badge} ${styles.badgeBranch}`}>자사</span>
                ) : (
                  <span className={`${styles.badge} ${styles.badgeHead}`}>본사</span>
                )}
                {client.name}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--notion-sub-text)' }}>
                {client.phone || client.contact_person || '-'}
              </div>
              <div>{assets.length}대</div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
                <Button variant="ghost" size="sm" onClick={(e) => handleEdit(e, client)}>수정</Button>
                <Button variant="danger" size="sm" onClick={(e) => handleDelete(e, client.id, client.name)}>삭제</Button>
              </div>
            </div>

            {isExpanded && (
              <div className={styles.detailsContainer}>
                <div className={styles.sectionTitle}>ℹ️ 상세 정보</div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                  <div className={styles.fieldContainer}>
                    <span className={styles.label}>대표자명</span>
                    <span className={styles.valueText}>{client.representative_name || '-'}</span>
                  </div>
                  <div className={styles.fieldContainer}>
                    <span className={styles.label}>사업자번호</span>
                    <span className={styles.valueText}>{client.business_number || '-'}</span>
                  </div>
                  <div className={styles.fieldContainer}>
                    <span className={styles.label}>담당자</span>
                    <span className={styles.valueText}>{client.contact_person || '-'}</span>
                  </div>
                  <div className={styles.fieldContainer}>
                    <span className={styles.label}>직책</span>
                    <span className={styles.valueText}>{client.job_title || '-'}</span>
                  </div>
                  <div className={styles.fieldContainer}>
                    <span className={styles.label}>담당자 연락처</span>
                    <span className={styles.valueText}>{client.phone || '-'}</span>
                  </div>
                  <div className={styles.fieldContainer}>
                    <span className={styles.label}>일반 연락처</span>
                    <span className={styles.valueText}>{client.office_phone || '-'}</span>
                  </div>
                  <div className={styles.fieldContainer}>
                    <span className={styles.label}>이메일</span>
                    <span className={styles.valueText}>{client.email || '-'}</span>
                  </div>
                  <div className={styles.fieldContainer} style={{ gridColumn: '1 / -1' }}>
                    <span className={styles.label}>주소</span>
                    <span className={styles.valueText}>{client.address || '-'}</span>
                  </div>
                </div>

                {client.memo && (
                  <div style={{ 
                    backgroundColor: '#fff', 
                    padding: '12px', 
                    borderRadius: '6px', 
                    border: '1px solid #e5e5e5', 
                    marginBottom: '20px',
                    fontSize: '0.9rem'
                  }}>
                    <span className={styles.label} style={{ display:'block', marginBottom:'6px', fontWeight: 'bold' }}>📝 메모</span>
                    <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.5', color: '#171717' }}>{client.memo}</div>
                  </div>
                )}

                <div className={styles.divider} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div className={styles.sectionTitle} style={{ marginBottom: 0 }}>📦 설치된 자산 목록</div>
                  <Button variant="outline" size="sm" onClick={(e) => handleAddMachineClick(e, client)}>
                    + 기계 추가
                  </Button>
                </div>

                {assets.length === 0 ? (
                  <div className={styles.assetEmpty}>설치된 기기가 없습니다.</div>
                ) : (
                  <table className={styles.assetTable}>
                    <thead>
                      <tr>
                        <th className={styles.assetTh}>종류</th>
                        <th className={styles.assetTh}>부서</th>
                        <th className={styles.assetTh}>모델명 / S.N</th>
                        <th className={styles.assetTh}>청구일</th>
                        <th className={styles.assetTh}>기본료</th>
                        <th className={styles.assetTh} style={{ textAlign: 'right' }}>작업</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assets.map((asset) => (
                        <tr key={asset.id}>
                          <td className={styles.assetTd}>[{asset.type}]</td>
                          <td className={styles.assetTd}>
                            {(asset as any).department || '-'}
                          </td>
                          <td className={styles.assetTd}>
                            <div style={{ fontWeight: '600' }}>{asset.model_name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--notion-sub-text)' }}>{asset.serial_number}</div>
                          </td>
                          <td className={styles.assetTd}>
                            {asset.billing_date ? `매월 ${asset.billing_date}일` : '-'}
                          </td>
                          <td className={styles.assetTd}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span>{asset.plan_basic_fee?.toLocaleString()}원</span>
                              {asset.billing_group_id && (
                                <span className={`${styles.badge} ${styles.badgeHead}`} style={{ margin: 0 }} title="합산 청구 그룹">합산</span>
                              )}
                            </div>
                          </td>
                          <td className={styles.assetTd} style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '4px' }}>
                              <Button variant="outline" size="sm" onClick={() => { 
                                if (client.id) {
                                  setSelectedAssetForPlan({ id: asset.id, clientId: client.id }); 
                                  setPlanModalOpen(true); 
                                }
                              }}>요금제</Button>
                              <Button variant="outline" size="sm" onClick={() => handleReplaceClick(asset)}>교체</Button>
                              <Button variant="danger" size="sm" onClick={() => handleWithdrawClick(asset)} style={{ border: '1px solid #ff4d4f', background: 'transparent' }}>철수</Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        )
      })}

      {isRegModalOpen && <ClientForm isOpen={isRegModalOpen} onClose={() => setIsRegModalOpen(false)} onSuccess={fetchClients} editData={selectedClient} />}
      {planModalOpen && selectedAssetForPlan && <PlanSettingModal inventoryId={selectedAssetForPlan.id} clientId={selectedAssetForPlan.clientId} onClose={() => { setPlanModalOpen(false); setSelectedAssetForPlan(null) }} onUpdate={fetchClients} />}
      {addMachineModalOpen && clientForMachineAdd && <InventoryForm isOpen={addMachineModalOpen} onClose={() => { setAddMachineModalOpen(false); setClientForMachineAdd(null) }} onSuccess={fetchClients} editData={{ status: '설치', client_id: clientForMachineAdd.id }} />}
      {replaceModalOpen && selectedAssetForReplace && selectedAssetForReplace.client_id && <MachineReplaceModal oldAsset={selectedAssetForReplace} clientId={selectedAssetForReplace.client_id} onClose={() => { setReplaceModalOpen(false); setSelectedAssetForReplace(null) }} onSuccess={fetchClients} />}
      {withdrawModalOpen && selectedAssetForWithdraw && selectedAssetForWithdraw.client_id && <MachineWithdrawModal asset={selectedAssetForWithdraw} clientId={selectedAssetForWithdraw.client_id} onClose={() => { setWithdrawModalOpen(false); setSelectedAssetForWithdraw(null) }} onSuccess={fetchClients} />}
      <ClientExcelModal
        isOpen={excelModalOpen}
        onClose={() => setExcelModalOpen(false)}
        onImported={fetchClients}
      />
    </div>
  )
}