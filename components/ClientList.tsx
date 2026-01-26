'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase'
import ClientForm from './ClientForm'
import PlanSettingModal from './PlanSettingModal'

export default function ClientList() {
  const supabase = createClient()

  // --- 상태 관리 ---
  const [clients, setClients] = useState<any[]>([])
  const [assetsMap, setAssetsMap] = useState<{[key: string]: any[]}>({})
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  // 모달 상태
  const [isRegModalOpen, setIsRegModalOpen] = useState(false)
  const [selectedClient, setSelectedClient] = useState<any>(null)
  const [planModalOpen, setPlanModalOpen] = useState(false)
  const [selectedAssetForPlan, setSelectedAssetForPlan] = useState<{id: string, clientId: string} | null>(null)

  useEffect(() => {
    fetchClients()
  }, [])

  // 데이터 불러오기
  const fetchClients = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user?.id).single()
    const orgId = profile?.organization_id

    if (orgId) {
      const { data: clientData } = await supabase.from('clients').select('*').eq('organization_id', orgId).order('created_at', { ascending: false })
      if (clientData) setClients(clientData)

      const { data: assetData } = await supabase.from('inventory').select('*').eq('organization_id', orgId).not('client_id', 'is', null).order('created_at', { ascending: true })
      
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

  // 삭제 기능
  const handleDelete = async (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation() // 행 클릭 이벤트(펼치기) 방지
    if (confirm(`'${name}' 거래처를 정말로 삭제하시겠습니까?`)) { 
      const { error } = await supabase.from('clients').delete().eq('id', id);
      if (error) alert('삭제 실패: ' + error.message);
      else { alert('삭제되었습니다.'); fetchClients(); }
    }
  }

  // 아코디언 토글
  const toggleExpand = (clientId: string) => {
    const newSet = new Set(expandedRows)
    if (newSet.has(clientId)) newSet.delete(clientId)
    else newSet.add(clientId)
    setExpandedRows(newSet)
  }

  // 기계 교체
  const handleReplace = async (assetId: string) => {
    if (!confirm('이 기계를 교체(철수) 상태로 변경하시겠습니까?')) return
    const { error } = await supabase.from('inventory').update({ status: '교체전(철수)' }).eq('id', assetId)
    if (error) alert('오류 발생: ' + error.message)
    else { alert('상태가 변경되었습니다.'); fetchClients() }
  }

  // 수정 모달 열기
  const handleEdit = (e: React.MouseEvent, client: any) => {
    e.stopPropagation() // 행 클릭 이벤트(펼치기) 방지
    setSelectedClient(client)
    setIsRegModalOpen(true)
  }

  // 검색 필터
  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.address?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div style={{ width: '100%', padding: '20px', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>🏢 거래처 관리</h2>
        <button 
          onClick={() => { setSelectedClient(null); setIsRegModalOpen(true); }}
          style={{ padding: '10px 20px', backgroundColor: '#333', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          + 신규 거래처 등록
        </button>
      </div>

      <input 
        placeholder="검색어 입력 (거래처명, 주소)" 
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        style={{ width: '100%', padding: '10px', marginBottom: '20px', border: '1px solid #ddd', borderRadius: '4px' }}
      />

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
        <thead>
          <tr style={{ backgroundColor: '#f5f5f5', textAlign: 'left' }}>
            {/* 🔴 [수정] 헤더에 순번 타이틀 추가 */}
            <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>순번 / 거래처명</th>
            <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>연락처/주소</th>
            <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>청구일</th>
            <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>설치기기</th>
            <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>관리</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={5} style={{ padding: '20px', textAlign: 'center' }}>로딩 중...</td></tr>
          ) : filteredClients.map((client, index) => (
            <React.Fragment key={client.id}>
              {/* 🔴 [수정] tr(행) 자체에 onClick 이벤트를 걸어서 어디든 누르면 펼쳐지게 함 */}
              <tr 
                onClick={() => toggleExpand(client.id)}
                style={{ borderBottom: '1px solid #eee', cursor: 'pointer', backgroundColor: expandedRows.has(client.id) ? '#f0f9ff' : 'transparent' }}
              >
                <td style={{ padding: '12px', color: '#333' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {/* 순번 */}
                    <span style={{ color: '#888', minWidth: '20px' }}>{index + 1}.</span>
                    
                    {/* 🔴 [복구] 본사/지사 구분 뱃지 */}
                    {client.parent_id ? (
                      <span style={{ fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#e9ecef', color: '#495057', border:'1px solid #ced4da' }}>지사</span>
                    ) : (
                      <span style={{ fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#e3f2fd', color: '#0d6efd', border:'1px solid #9ec5fe' }}>본사</span>
                    )}

                    {/* 거래처명 */}
                    <span style={{ fontWeight: 'bold', fontSize: '1rem' }}>{client.name}</span>
                    
                    {/* 화살표 아이콘 */}
                    <span style={{ fontSize: '0.8rem', color: '#999' }}>{expandedRows.has(client.id) ? '▲' : '▼'}</span>
                  </div>
                </td>
                <td style={{ padding: '12px' }}>
                  <div>{client.contact_person} ({client.contact_number})</div>
                  <div style={{ fontSize: '0.8rem', color: '#666' }}>{client.address}</div>
                </td>
                <td style={{ padding: '12px' }}>매월 {client.billing_date}일</td>
                <td style={{ padding: '12px' }}>{assetsMap[client.id]?.length || 0}대</td>
                <td style={{ padding: '12px' }}>
                  {/* 버튼 클릭 시 행 클릭 이벤트가 발생하지 않도록 e.stopPropagation() 추가 */}
                  <button onClick={(e) => handleEdit(e, client)} style={{ marginRight: '8px', border: '1px solid #ccc', background: '#fff', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}>수정</button>
                  <button onClick={(e) => handleDelete(e, client.id, client.name)} style={{ border: '1px solid #ff6b6b', background: '#fff', color: '#ff6b6b', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}>삭제</button>
                </td>
              </tr>

              {/* 확장 영역 */}
              {expandedRows.has(client.id) && (
                <tr>
                  <td colSpan={5} style={{ backgroundColor: '#f8f9fa', padding: '20px', borderBottom:'2px solid #e9ecef' }}>
                    
                    {/* 거래처 상세 정보 섹션 */}
                    <div style={{ marginBottom: '20px', backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #dee2e6', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                      <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#333', marginBottom: '15px', paddingBottom:'10px', borderBottom:'1px solid #eee', display:'flex', alignItems:'center', gap:'6px' }}>
                        ℹ️ 거래처 상세 정보
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', fontSize: '0.9rem' }}>
                        <div><span style={{color:'#666', fontWeight:'600', display:'inline-block', width:'60px'}}>이메일</span> {client.email || '-'}</div>
                        <div><span style={{color:'#666', fontWeight:'600', display:'inline-block', width:'60px'}}>담당자</span> {client.contact_person} ({client.contact_number})</div>
                        <div><span style={{color:'#666', fontWeight:'600', display:'inline-block', width:'60px'}}>주소</span> {client.address}</div>
                        <div><span style={{color:'#666', fontWeight:'600', display:'inline-block', width:'60px'}}>청구일</span> 매월 {client.billing_date}일</div>
                        <div style={{gridColumn: 'span 2', marginTop:'5px', padding:'10px', backgroundColor:'#f8f9fa', borderRadius:'6px', color:'#555'}}>
                          <span style={{fontWeight:'bold', marginRight:'10px'}}>📝 메모</span> 
                          {client.memo || '등록된 메모가 없습니다.'}
                        </div>
                      </div>
                    </div>

                    {/* 자산 목록 섹션 */}
                    <div style={{ marginBottom: '10px', fontSize: '1rem', fontWeight: 'bold', color: '#495057' }}>📦 설치된 자산 목록</div>
                    {(!assetsMap[client.id] || assetsMap[client.id].length === 0) ? (
                      <div style={{ color: '#888', padding: '15px', backgroundColor:'#fff', borderRadius:'8px', textAlign:'center', border:'1px solid #eee' }}>설치된 기기가 없습니다.</div>
                    ) : (
                      assetsMap[client.id].map((asset: any) => (
                        <div key={asset.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '15px', marginBottom: '10px', borderRadius: '8px', border: '1px solid #e0e0e0', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                          <div>
                            <div style={{marginBottom:'5px'}}>
                              <span style={{ fontWeight: 'bold', color: '#333', fontSize:'1.05rem' }}>[{asset.type}]</span> 
                              <span style={{ marginLeft: '8px', fontSize:'1.05rem' }}>{asset.model_name}</span>
                            </div>
                            <div style={{ fontSize: '0.85rem', color: '#666', marginBottom:'8px' }}>S/N: {asset.serial_number}</div>
                            
                            <div style={{fontSize:'0.85rem', color:'#0070f3', display:'flex', gap:'10px', alignItems:'center', background:'#f0f7ff', padding:'5px 10px', borderRadius:'4px', width:'fit-content'}}>
                              <span>{asset.plan_basic_fee > 0 ? `💰 기본료: ${asset.plan_basic_fee.toLocaleString()}원` : '⚠️ 요금제 미설정'}</span>
                              {asset.billing_group_id && (<span style={{backgroundColor:'#0070f3', color:'white', padding:'2px 6px', borderRadius:'4px', fontWeight:'bold', fontSize:'0.75rem'}}>🔗 합산청구중</span>)}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <div style={{ padding: '6px 10px', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 'bold', backgroundColor: asset.status === '설치' ? '#e6fffa' : '#fff5f5', color: asset.status === '설치' ? '#00b894' : '#d63031' }}>{asset.status}</div>
                            <button onClick={() => { setSelectedAssetForPlan({ id: asset.id, clientId: client.id }); setPlanModalOpen(true) }} style={{ padding:'6px 12px', border:'1px solid #0070f3', color:'#0070f3', background:'white', borderRadius:'4px', cursor:'pointer', fontSize:'0.85rem', display:'flex', alignItems:'center', gap:'4px' }}>⚙️ 요금제</button>
                            <button onClick={() => handleReplace(asset.id)} style={{ padding: '6px 12px', border: '1px solid #ccc', background: '#fff', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>🔄 교체</button>
                          </div>
                        </div>
                      ))
                    )}
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>

      {isRegModalOpen && <ClientForm isOpen={isRegModalOpen} onClose={() => setIsRegModalOpen(false)} onSuccess={fetchClients} editData={selectedClient} />}
      {planModalOpen && selectedAssetForPlan && <PlanSettingModal inventoryId={selectedAssetForPlan.id} clientId={selectedAssetForPlan.clientId} onClose={() => { setPlanModalOpen(false); setSelectedAssetForPlan(null) }} onUpdate={fetchClients} />}
    </div>
  )
}