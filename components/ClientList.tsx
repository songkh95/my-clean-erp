'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase'
import ClientForm from './ClientForm'
import PlanSettingModal from './PlanSettingModal'

export default function ClientList() {
  const supabase = createClient()

  // ... (상태 관리 로직은 기존과 동일) ...
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

  const fetchClients = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user?.id).single()
    if (profile?.organization_id) {
      const { data: clientData } = await supabase.from('clients').select('*').eq('organization_id', profile.organization_id).order('created_at', { ascending: false })
      if (clientData) setClients(clientData)
      const { data: assetData } = await supabase.from('inventory').select('*').eq('organization_id', profile.organization_id).not('client_id', 'is', null).order('created_at', { ascending: true })
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
    <div style={{ width: '100%', padding: '30px', backgroundColor: '#FFFFFF', borderRadius: '12px', boxShadow: '0 4px 10px rgba(0,0,0,0.02)', border: '1px solid #E5E5E5' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '25px', alignItems:'center' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#171717' }}>🏢 거래처 관리</h2>
        <button 
          onClick={() => { setSelectedClient(null); setIsRegModalOpen(true); }}
          style={{ padding: '10px 20px', backgroundColor: '#171717', color: '#FFFFFF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
        >
          + 신규 거래처 등록
        </button>
      </div>

      <input 
        placeholder="검색어 입력 (거래처명, 주소)" 
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        style={{ width: '100%', padding: '12px', marginBottom: '25px', border: '1px solid #E5E5E5', borderRadius: '6px', fontSize: '0.95rem', outline: 'none' }}
      />

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
        <thead>
          <tr style={{ backgroundColor: '#FFFFFF', textAlign: 'left', borderBottom: '1px solid #E5E5E5' }}>
            <th style={{ padding: '15px 12px', color: '#666666', fontWeight: '600' }}>순번 / 거래처명</th>
            <th style={{ padding: '15px 12px', color: '#666666', fontWeight: '600' }}>연락처/주소</th>
            <th style={{ padding: '15px 12px', color: '#666666', fontWeight: '600' }}>청구일</th>
            <th style={{ padding: '15px 12px', color: '#666666', fontWeight: '600' }}>설치기기</th>
            <th style={{ padding: '15px 12px', color: '#666666', fontWeight: '600' }}>관리</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={5} style={{ padding: '30px', textAlign: 'center', color: '#666' }}>로딩 중...</td></tr>
          ) : filteredClients.map((client, index) => (
            <React.Fragment key={client.id}>
              <tr 
                onClick={() => toggleExpand(client.id)}
                style={{ borderBottom: '1px solid #E5E5E5', cursor: 'pointer', backgroundColor: expandedRows.has(client.id) ? '#FAFAFA' : 'transparent', transition:'background-color 0.2s' }}
              >
                <td style={{ padding: '15px 12px', color: '#171717' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#666666', minWidth: '20px' }}>{index + 1}.</span>
                    {client.parent_id ? (
                      <span style={{ fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#F5F5F5', color: '#666666', border:'1px solid #E5E5E5' }}>지사</span>
                    ) : (
                      <span style={{ fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(0, 112, 243, 0.1)', color: '#0070f3', border:'1px solid rgba(0, 112, 243, 0.2)' }}>본사</span>
                    )}
                    <span style={{ fontWeight: '600', fontSize: '1rem', color:'#171717' }}>{client.name}</span>
                    <span style={{ fontSize: '0.7rem', color: '#666666' }}>{expandedRows.has(client.id) ? '▲' : '▼'}</span>
                  </div>
                </td>
                <td style={{ padding: '15px 12px' }}>
                  <div style={{color:'#171717', fontWeight:'500'}}>{client.contact_person} ({client.contact_number})</div>
                  <div style={{ fontSize: '0.85rem', color: '#666666' }}>{client.address}</div>
                </td>
                <td style={{ padding: '15px 12px', color:'#171717' }}>매월 {client.billing_date}일</td>
                <td style={{ padding: '15px 12px', color:'#171717' }}>{assetsMap[client.id]?.length || 0}대</td>
                <td style={{ padding: '15px 12px' }}>
                  <button onClick={(e) => handleEdit(e, client)} style={{ marginRight: '8px', border: '1px solid #E5E5E5', background: '#FFFFFF', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', color:'#171717', fontWeight:'500' }}>수정</button>
                  <button onClick={(e) => handleDelete(e, client.id, client.name)} style={{ border: '1px solid #E5E5E5', background: '#FFFFFF', color: '#666666', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight:'500' }}>삭제</button>
                </td>
              </tr>

              {expandedRows.has(client.id) && (
                <tr>
                  <td colSpan={5} style={{ backgroundColor: '#FAFAFA', padding: '30px', borderBottom:'1px solid #E5E5E5' }}>
                    
                    <div style={{ marginBottom: '20px', backgroundColor: '#FFFFFF', padding: '25px', borderRadius: '8px', border: '1px solid #E5E5E5' }}>
                      <div style={{ fontSize: '1rem', fontWeight: '700', color: '#171717', marginBottom: '15px', paddingBottom:'10px', borderBottom:'1px solid #E5E5E5', display:'flex', alignItems:'center', gap:'6px' }}>
                        ℹ️ 거래처 상세 정보
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', fontSize: '0.9rem' }}>
                        <div><span style={{color:'#666666', fontWeight:'600', display:'inline-block', width:'60px'}}>이메일</span> {client.email || '-'}</div>
                        <div><span style={{color:'#666666', fontWeight:'600', display:'inline-block', width:'60px'}}>담당자</span> {client.contact_person} ({client.contact_number})</div>
                        <div><span style={{color:'#666666', fontWeight:'600', display:'inline-block', width:'60px'}}>주소</span> {client.address}</div>
                        <div><span style={{color:'#666666', fontWeight:'600', display:'inline-block', width:'60px'}}>청구일</span> 매월 {client.billing_date}일</div>
                        <div style={{gridColumn: 'span 2', marginTop:'10px', padding:'15px', backgroundColor:'#FAFAFA', borderRadius:'6px', color:'#171717', border:'1px solid #E5E5E5'}}>
                          <span style={{fontWeight:'700', marginRight:'10px', color:'#0070f3'}}>📝 메모</span> 
                          {client.memo || '등록된 메모가 없습니다.'}
                        </div>
                      </div>
                    </div>

                    <div style={{ marginBottom: '15px', fontSize: '1rem', fontWeight: '700', color: '#171717' }}>📦 설치된 자산 목록</div>
                    {(!assetsMap[client.id] || assetsMap[client.id].length === 0) ? (
                      <div style={{ color: '#666666', padding: '20px', backgroundColor:'#FFFFFF', borderRadius:'8px', textAlign:'center', border:'1px solid #E5E5E5' }}>설치된 기기가 없습니다.</div>
                    ) : (
                      assetsMap[client.id].map((asset: any) => (
                        <div key={asset.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FFFFFF', padding: '20px', marginBottom: '12px', borderRadius: '8px', border: '1px solid #E5E5E5', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                          <div>
                            <div style={{marginBottom:'6px'}}>
                              <span style={{ fontWeight: '700', color: '#171717', fontSize:'1.05rem' }}>[{asset.type}]</span> 
                              <span style={{ marginLeft: '8px', fontSize:'1.05rem', color:'#171717' }}>{asset.model_name}</span>
                            </div>
                            <div style={{ fontSize: '0.85rem', color: '#666666', marginBottom:'8px' }}>S/N: {asset.serial_number}</div>
                            
                            <div style={{fontSize:'0.85rem', color:'#0070f3', display:'flex', gap:'10px', alignItems:'center', background:'rgba(0,112,243,0.05)', padding:'6px 12px', borderRadius:'6px', width:'fit-content'}}>
                              <span>{asset.plan_basic_fee > 0 ? `💰 기본료: ${asset.plan_basic_fee.toLocaleString()}원` : '⚠️ 요금제 미설정'}</span>
                              {asset.billing_group_id && (<span style={{backgroundColor:'#0070f3', color:'white', padding:'2px 6px', borderRadius:'4px', fontWeight:'700', fontSize:'0.75rem'}}>🔗 합산청구중</span>)}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <div style={{ padding: '6px 10px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: '600', backgroundColor: asset.status === '설치' ? 'rgba(0,112,243,0.1)' : '#FFF1F0', color: asset.status === '설치' ? '#0070f3' : '#F5222D' }}>{asset.status}</div>
                            <button onClick={() => { setSelectedAssetForPlan({ id: asset.id, clientId: client.id }); setPlanModalOpen(true) }} style={{ padding:'8px 14px', border:'1px solid #0070f3', color:'#0070f3', background:'#FFFFFF', borderRadius:'6px', cursor:'pointer', fontSize:'0.85rem', display:'flex', alignItems:'center', gap:'4px', fontWeight:'600' }}>⚙️ 요금제</button>
                            <button onClick={() => handleReplace(asset.id)} style={{ padding: '8px 14px', border: '1px solid #E5E5E5', background: '#FFFFFF', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', color:'#171717' }}>🔄 교체</button>
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