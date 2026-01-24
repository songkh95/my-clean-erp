'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase'

export default function ClientList({ refreshTrigger }: { refreshTrigger: number }) {
  const [isListOpen, setIsListOpen] = useState(true)
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editData, setEditData] = useState<any>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [clientAssets, setClientAssets] = useState<any[]>([])

  const supabase = createClient()

  // 데이터 가져오기 (기존과 동일)
  const fetchClients = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
      if (profile?.organization_id) {
        const { data } = await supabase
          .from('clients')
          .select('*, parent:parent_id(name)')
          .eq('organization_id', profile.organization_id)
          .order('created_at', { ascending: false })
        if (data) setClients(data)
      }
    }
    setLoading(false)
  }

  useEffect(() => { fetchClients() }, [refreshTrigger])

  const fetchClientAssets = async (clientId: string) => {
    const { data } = await supabase.from('inventory').select('*').eq('client_id', clientId).order('created_at', { ascending: false })
    if (data) setClientAssets(data)
    else setClientAssets([])
  }

  const handleWithdrawAsset = async (assetId: string, modelName: string) => {
    if (confirm(`[${modelName}] 장비를 철수하시겠습니까?\n(상태가 '창고'로 변경되고 목록에서 사라집니다.)`)) {
      const { error } = await supabase.from('inventory').update({ status: '창고', client_id: null }).eq('id', assetId)
      if (!error) {
        alert('철수 완료! 자산 관리 페이지의 창고로 이동되었습니다.')
        if (expandedId) fetchClientAssets(expandedId)
      } else {
        alert('오류 발생: ' + error.message)
      }
    }
  }

  const startEditing = (client: any) => {
    setEditingId(client.id)
    setEditData({ ...client })
  }

  const handleUpdate = async () => {
    if (!editData.name) return alert('업체명은 필수입니다.')
    const { parent, id, created_at, organization_id, ...cleanData } = editData
    if (cleanData.parent_id === "") cleanData.parent_id = null
    const { error } = await supabase.from('clients').update(cleanData).eq('id', editingId)
    if (!error) { alert('수정완료'); setEditingId(null); fetchClients(); }
  }

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`'${name}' 거래처를 삭제하시겠습니까?`)) { 
      await supabase.from('clients').delete().eq('id', id); 
      fetchClients(); 
    }
  }

  const filteredClients = clients.filter(client => {
    const searchLower = searchTerm.toLowerCase()
    return (
      (client.name && String(client.name).toLowerCase().includes(searchLower)) ||
      (client.contact_person && String(client.contact_person).toLowerCase().includes(searchLower)) ||
      (client.business_number && String(client.business_number).includes(searchTerm))
    )
  })

  if (loading) return <div style={{ padding: '20px' }}>데이터 로딩 중...</div>

  return (
    <div style={{ border: '1px solid #e0e0e0', borderRadius: '12px', backgroundColor: '#fff', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
      
      {/* 아코디언 헤더 */}
      <div onClick={() => setIsListOpen(!isListOpen)} style={{ padding: '15px 20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', backgroundColor: '#fcfcfc', borderBottom: isListOpen ? '1px solid #eee' : 'none', fontWeight: 'bold' }}>
        <span>📋 등록된 거래처 목록 ({searchTerm ? filteredClients.length : clients.length})</span>
        <span>{isListOpen ? '▲' : '▼'}</span>
      </div>

      {isListOpen && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          
          {/* 🔴 [수정] 검색창 스타일 (#dddddd 적용) */}
          <div style={{ padding: '10px 20px', borderBottom: '1px solid #eee', backgroundColor: '#fafafa' }}>
            <input
              type="text"
              placeholder="업체명, 담당자명, 번호 등으로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #dddddd', fontSize: '0.9rem', outline: 'none' }}
            />
          </div>

          <div style={{ display: 'flex', padding: '12px 20px', backgroundColor: '#f9f9f9', borderBottom: '1px solid #eee', fontSize: '0.85rem', color: '#666', fontWeight: 'bold' }}>
            <div style={{ flex: 2 }}>업체명 (본사/지사)</div>
            <div style={{ flex: 1 }}>담당자</div>
            <div style={{ flex: 1, textAlign: 'right' }}>등록일</div>
          </div>

          {filteredClients.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>결과가 없습니다.</div>
          ) : (
            filteredClients.map((client) => {
              const isHead = !client.parent_id;
              return (
                <div key={client.id} style={{ borderBottom: '1px solid #eee' }}>
                  <div 
                    onClick={() => { 
                      const newId = expandedId === client.id ? null : client.id;
                      setExpandedId(newId); 
                      setEditingId(null);
                      if (newId) fetchClientAssets(newId);
                    }} 
                    style={{ display: 'flex', padding: '15px 20px', cursor: 'pointer', alignItems: 'center', backgroundColor: expandedId === client.id ? '#f0f7ff' : '#fff' }}
                  >
                    <div style={{ flex: 2, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 'bold' }}>{client.name}</span>
                      <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: isHead ? '#333' : '#e2e8f0', color: isHead ? '#fff' : '#475569' }}>{isHead ? '본사' : '지사'}</span>
                    </div>
                    <div style={{ flex: 1 }}>{client.contact_person || '-'}</div>
                    <div style={{ flex: 1, textAlign: 'right', fontSize: '0.8rem', color: '#888' }}>{new Date(client.created_at).toLocaleDateString()}</div>
                  </div>

                  {expandedId === client.id && (
                    <div style={{ padding: '20px', backgroundColor: '#fcfcfc', borderTop: '1px solid #eef2f6' }}>
                      
                      {/* 기본 정보 수정 */}
                      <div style={{ marginBottom: '20px' }}>
                         <div style={{ marginBottom: '10px', fontSize: '0.85rem', fontWeight: 'bold', color: '#0070f3' }}>👤 거래처 기본 정보</div>
                         <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                            <EditableItem label="업체명" name="name" value={client.name} isEditing={editingId === client.id} editData={editData} setEditData={setEditData} />
                            <EditableItem label="사업자번호" name="business_number" value={client.business_number} isEditing={editingId === client.id} editData={editData} setEditData={setEditData} />
                            <EditableItem label="대표자명" name="representative_name" value={client.representative_name} isEditing={editingId === client.id} editData={editData} setEditData={setEditData} />
                            <EditableItem label="담당자명" name="contact_person" value={client.contact_person} isEditing={editingId === client.id} editData={editData} setEditData={setEditData} />
                            <EditableItem label="휴대폰" name="phone" value={client.phone} isEditing={editingId === client.id} editData={editData} setEditData={setEditData} />
                            <EditableItem label="사무실" name="office_phone" value={client.office_phone} isEditing={editingId === client.id} editData={editData} setEditData={setEditData} />
                            <EditableItem label="이메일" name="email" value={client.email} isEditing={editingId === client.id} editData={editData} setEditData={setEditData} />
                            <EditableItem label="상태" name="status" value={client.status} isEditing={editingId === client.id} editData={editData} setEditData={setEditData} isSelect />
                            <EditableItem label="주소" name="address" value={client.address} isEditing={editingId === client.id} editData={editData} setEditData={setEditData} fullWidth />
                            <EditableItem label="알림메모" name="popup_memo" value={client.popup_memo} isEditing={editingId === client.id} editData={editData} setEditData={setEditData} fullWidth />
                         </div>
                         <div style={{ marginTop: '15px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                          {editingId === client.id ? 
                            ( <><button onClick={handleUpdate} style={btnStyle.save}>저장</button><button onClick={()=>setEditingId(null)} style={btnStyle.cancel}>취소</button></> ) : 
                            ( <><button onClick={()=>startEditing(client)} style={btnStyle.edit}>정보 수정</button><button onClick={()=>handleDelete(client.id, client.name)} style={btnStyle.delete}>거래처 삭제</button></> )
                          }
                        </div>
                      </div>

                      <hr style={{ border: 'none', borderTop: '1px solid #eee', margin: '20px 0' }} />

                      {/* 설치된 장비 목록 */}
                      <div>
                        <div style={{ marginBottom: '10px', fontSize: '0.85rem', fontWeight: 'bold', color: '#0070f3' }}>📦 설치된 자산 목록 ({clientAssets.length})</div>
                        {clientAssets.length === 0 ? (
                          <div style={{ padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '6px', color: '#888', fontSize: '0.85rem', textAlign: 'center' }}>설치된 장비가 없습니다.</div>
                        ) : (
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                            <thead>
                              <tr style={{ backgroundColor: '#f1f3f5', borderBottom: '1px solid #ddd' }}>
                                <th style={thStyle}>분류</th>
                                <th style={thStyle}>브랜드</th>
                                <th style={thStyle}>모델명</th>
                                <th style={thStyle}>S/N</th>
                                <th style={thStyle}>상태</th>
                                <th style={{...thStyle, textAlign: 'center'}}>관리</th>
                              </tr>
                            </thead>
                            <tbody>
                              {clientAssets.map((asset) => (
                                <tr key={asset.id} style={{ borderBottom: '1px solid #eee', backgroundColor: '#fff' }}>
                                  <td style={tdStyle}>{asset.category}</td>
                                  <td style={tdStyle}>{asset.brand}</td>
                                  <td style={{...tdStyle, fontWeight: 'bold'}}>{asset.model_name}</td>
                                  <td style={tdStyle}>{asset.serial_number}</td>
                                  <td style={tdStyle}>{asset.status}</td>
                                  <td style={{...tdStyle, textAlign: 'center'}}>
                                    <button onClick={() => handleWithdrawAsset(asset.id, asset.model_name)} style={{ padding: '4px 8px', backgroundColor: '#fff', border: '1px solid #d93025', color: '#d93025', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}>철수(반환)</button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

function EditableItem({ label, name, value, isEditing, editData, setEditData, fullWidth = false, isSelect = false }: any) {
  const handleChange = (e: any) => setEditData({ ...editData, [name]: e.target.value })
  // 🔴 [수정] 입력창 스타일 통일 (#dddddd)
  const editStyle = { padding: '6px 10px', borderRadius: '4px', border: '1px solid #dddddd', width: '100%', fontSize: '0.9rem', backgroundColor: '#fff', boxSizing: 'border-box' as const }

  return (
    <div style={{ gridColumn: fullWidth ? '1/3' : 'auto', display: 'flex', gap: '10px', alignItems: 'center' }}>
      <span style={{ color: '#888', minWidth: '85px', fontSize: '0.85rem' }}>{label}</span>
      {isEditing ? (
        isSelect ? (
          <select value={editData[name]} onChange={handleChange} style={editStyle}>
            <option value="정상">정상</option><option value="중지">중지</option><option value="해지">해지</option>
          </select>
        ) : (
          <input value={editData[name] || ''} onChange={handleChange} style={editStyle} />
        )
      ) : (
        <span style={{ color: '#333', fontWeight: '500', fontSize: '0.9rem' }}>{value || '-'}</span>
      )}
    </div>
  )
}

const thStyle: React.CSSProperties = { padding: '8px 10px', textAlign: 'left', color: '#555', fontSize: '0.8rem' }
const tdStyle: React.CSSProperties = { padding: '8px 10px', color: '#333' }
const btnStyle = {
  edit: { padding: '7px 14px', backgroundColor: '#fff', border: '1px solid #0070f3', color: '#0070f3', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' as const },
  delete: { padding: '7px 14px', backgroundColor: '#fff', border: '1px solid #d93025', color: '#d93025', borderRadius: '6px', cursor: 'pointer' },
  save: { padding: '7px 14px', backgroundColor: '#0070f3', border: 'none', color: '#fff', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' as const },
  cancel: { padding: '7px 14px', backgroundColor: '#eee', border: 'none', color: '#666', borderRadius: '6px', cursor: 'pointer' }
}