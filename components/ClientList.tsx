'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase'
import ClientForm from './ClientForm'
import PlanSettingModal from './PlanSettingModal'
import Button from './ui/Button'
import styles from './ClientList.module.css'

export default function ClientList() {
  const supabase = createClient()

  // 상태 관리 로직 (기능 보존)
  const [clients, setClients] = useState<any[]>([])
  const [assetsMap, setAssetsMap] = useState<{[key: string]: any[]}>({})
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [isRegModalOpen, setIsRegModalOpen] = useState(false)
  const [selectedClient, setSelectedClient] = useState<any>(null)
  const [planModalOpen, setPlanModalOpen] = useState(false)
  const [selectedAssetForPlan, setSelectedAssetForPlan] = useState<{id: string, clientId: string} | null>(null)

  useEffect(() => { fetchClients() }, [])

  // 데이터 로딩 로직 (기능 보존)
  const fetchClients = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user?.id).single()
    
    if (profile?.organization_id) {
      // 거래처 목록 조회
      const { data: clientData } = await supabase.from('clients')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false })
      
      if (clientData) setClients(clientData)

      // 자산 목록 조회 및 매핑 (기능 보존)
      const { data: assetData } = await supabase.from('inventory')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .not('client_id', 'is', null)
        .order('created_at', { ascending: true })
      
      const map: {[key: string]: any[]} = {}
      if (assetData) {
        assetData.forEach((asset: any) => {
          if (!map[asset.client_id]) map[asset.client_id] = []
          map[asset.client_id].push(asset)
        })
      }
      setAssetsMap(map)
    }
    setLoading(false)
  }

  const handleDelete = async (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation()
    if (confirm(`'${name}' 거래처를 정말로 삭제하시겠습니까?`)) { 
      const { error } = await supabase.from('clients').delete().eq('id', id);
      if (error) alert('삭제 실패: ' + error.message);
      else { alert('삭제되었습니다.'); fetchClients(); }
    }
  }

  const toggleExpand = (clientId: string) => {
    const newSet = new Set(expandedRows)
    if (newSet.has(clientId)) newSet.delete(clientId)
    else newSet.add(clientId)
    setExpandedRows(newSet)
  }

  const handleReplace = async (assetId: string) => {
    if (!confirm('이 기계를 교체(철수) 상태로 변경하시겠습니까?')) return
    const { error } = await supabase.from('inventory').update({ status: '교체전(철수)' }).eq('id', assetId)
    if (error) alert('오류: ' + error.message)
    else { alert('상태가 변경되었습니다.'); fetchClients() }
  }

  const handleEdit = (e: React.MouseEvent, client: any) => {
    e.stopPropagation()
    setSelectedClient(client)
    setIsRegModalOpen(true)
  }

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.address?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span>🏢 거래처 관리</span>
        <Button variant="primary" size="sm" onClick={() => { setSelectedClient(null); setIsRegModalOpen(true); }}>
          + 등록
        </Button>
      </div>

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
        <div>청구일</div>
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
              <div style={{ display: 'flex', alignItems: 'center', fontWeight: '600' }}>
                {client.parent_id ? (
                  <span className={`${styles.badge} ${styles.badgeBranch}`}>지사</span>
                ) : (
                  <span className={`${styles.badge} ${styles.badgeHead}`}>본사</span>
                )}
                {client.name}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--notion-sub-text)' }}>
                {client.phone || client.contact_person || '-'}
              </div>
              <div>매월 {client.billing_date}일</div>
              <div>{assets.length}대</div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
                <Button variant="ghost" size="sm" onClick={(e) => handleEdit(e, client)}>수정</Button>
                <Button variant="danger" size="sm" onClick={(e) => handleDelete(e, client.id, client.name)}>삭제</Button>
              </div>
            </div>

            {isExpanded && (
              <div className={styles.detailsContainer}>
                <div className={styles.sectionTitle}>ℹ️ 상세 정보</div>
                <div className={styles.gridForm}>
                  <div className={styles.fieldContainer}>
                    <span className={styles.label}>이메일</span>
                    <span className={styles.valueText}>{client.email || '-'}</span>
                  </div>
                  <div className={styles.fieldContainer}>
                    <span className={styles.label}>담당자</span>
                    <span className={styles.valueText}>{client.contact_person || '-'}</span>
                  </div>
                  <div className={styles.fieldContainer} style={{ gridColumn: 'span 2' }}>
                    <span className={styles.label}>주소</span>
                    <span className={styles.valueText}>{client.address || '-'}</span>
                  </div>
                </div>

                <div className={styles.divider} />

                <div className={styles.sectionTitle}>📦 설치된 자산 목록</div>
                {assets.length === 0 ? (
                  <div className={styles.assetEmpty}>설치된 기기가 없습니다.</div>
                ) : (
                  <table className={styles.assetTable}>
                    <thead>
                      <tr>
                        <th className={styles.assetTh}>종류</th>
                        <th className={styles.assetTh}>모델명 / S.N</th>
                        <th className={styles.assetTh}>기본료</th>
                        <th className={styles.assetTh} style={{ textAlign: 'right' }}>작업</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assets.map((asset) => (
                        <tr key={asset.id}>
                          <td className={styles.assetTd}>[{asset.type}]</td>
                          <td className={styles.assetTd}>
                            <div style={{ fontWeight: '600' }}>{asset.model_name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--notion-sub-text)' }}>{asset.serial_number}</div>
                          </td>
                          <td className={styles.assetTd}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span>{asset.plan_basic_fee?.toLocaleString()}원</span>
                              {asset.billing_group_id && (
                                <span className={`${styles.badge} ${styles.badgeHead}`} style={{ margin: 0 }}>합산</span>
                              )}
                            </div>
                          </td>
                          <td className={styles.assetTd} style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '4px' }}>
                              <Button variant="outline" size="sm" onClick={() => { 
                                setSelectedAssetForPlan({ id: asset.id, clientId: client.id }); 
                                setPlanModalOpen(true); 
                              }}>요금제</Button>
                              <Button variant="outline" size="sm" onClick={() => handleReplace(asset.id)}>교체</Button>
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
    </div>
  )
}