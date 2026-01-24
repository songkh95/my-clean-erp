'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase'

export default function InventoryList({ type, refreshTrigger }: { type: string, refreshTrigger: number }) {
  // --- 상태 관리 ---
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('') // 목록 검색용
  
  // 🔴 [추가] 아코디언 상태 (true: 펼침, false: 접힘)
  const [isListOpen, setIsListOpen] = useState(true)

  // 상세/수정 상태
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editData, setEditData] = useState<any>(null)
  const [clients, setClients] = useState<any[]>([])

  // 수정 시 거래처 검색을 위한 상태
  const [clientSearchTerm, setClientSearchTerm] = useState('')
  const [showClientList, setShowClientList] = useState(false)

  const supabase = createClient()

  // 데이터 가져오기
  const fetchItems = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
      
      const { data } = await supabase
        .from('inventory')
        .select('*, client:client_id(name)')
        .eq('type', type)
        .eq('organization_id', profile?.organization_id)
        .order('created_at', { ascending: false })
      if (data) setItems(data)

      const { data: cData } = await supabase.from('clients').select('id, name')
      if (cData) setClients(cData)
    }
    setLoading(false)
  }

  useEffect(() => { fetchItems() }, [type, refreshTrigger])

  const handleDelete = async (id: string) => {
    if (confirm('정말 삭제하시겠습니까? 복구할 수 없습니다.')) {
      await supabase.from('inventory').delete().eq('id', id)
      alert('삭제되었습니다.')
      fetchItems()
    }
  }

  const startEditing = (item: any) => {
    setEditingId(item.id)
    setEditData({ ...item })
    setClientSearchTerm(item.client?.name || '')
  }

  const handleUpdate = async () => {
    const { client, id, created_at, organization_id, ...cleanData } = editData
    
    // 규칙: 상태가 '설치'인데 설치처(client_id)가 없으면 저장 불가
    if (cleanData.status === '설치' && !cleanData.client_id) {
      alert("⚠️ 상태가 '설치'일 경우, 설치처를 반드시 입력(선택)해야 합니다.")
      return
    }

    if (!cleanData.client_id) cleanData.client_id = null
    if (cleanData.purchase_price === "") cleanData.purchase_price = null

    const { error } = await supabase.from('inventory').update(cleanData).eq('id', editingId)

    if (!error) {
      alert('수정 완료!')
      setEditingId(null)
      fetchItems()
    } else {
      alert('수정 실패: ' + error.message)
    }
  }

  const filteredItems = items.filter(item => {
    const term = searchTerm.toLowerCase()
    return (
      (item.model_name && item.model_name.toLowerCase().includes(term)) ||
      (item.brand && item.brand.toLowerCase().includes(term)) ||
      (item.serial_number && item.serial_number.toLowerCase().includes(term)) ||
      (item.client?.name && item.client.name.toLowerCase().includes(term)) ||
      (item.status && item.status.includes(term))
    )
  })

  if (loading) return <div style={{ padding: '20px' }}>목록 불러오는 중...</div>

  // 스타일
  const thStyle: React.CSSProperties = { padding: '12px 10px', textAlign: 'left', color: '#666', fontWeight: 'bold' }
  const tdStyle: React.CSSProperties = { padding: '12px 10px', color: '#333' }
  const editInputStyle = { padding: '6px', borderRadius: '4px', border: '1px solid #dddddd', width: '100%', boxSizing: 'border-box' as const }
  const dropdownStyle: React.CSSProperties = {
    position: 'absolute', width: '100%', backgroundColor: '#fff', border: '1px solid #dddddd', 
    zIndex: 100, maxHeight: '150px', overflowY: 'auto', borderRadius: '4px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', top: '100%'
  }

  return (
    <div style={{ border: '1px solid #e0e0e0', borderRadius: '12px', backgroundColor: '#fff', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
      
      {/* 🔴 [수정] 아코디언 헤더 (클릭 가능) */}
      <div 
        onClick={() => setIsListOpen(!isListOpen)} 
        style={{ 
          padding: '15px 20px', 
          backgroundColor: '#fcfcfc', 
          borderBottom: isListOpen ? '1px solid #eee' : 'none', 
          fontWeight: 'bold', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          cursor: 'pointer' // 🔴 마우스 포인터 추가
        }}
      >
        <span>📋 {type} 목록 ({searchTerm ? filteredItems.length : items.length}개)</span>
        {/* 🔴 화살표 아이콘 */}
        <span>{isListOpen ? '▲' : '▼'}</span>
      </div>
      
      {/* 🔴 아코디언 본문 (검색창 + 테이블) */}
      {isListOpen && (
        <>
          {/* 검색창 */}
          <div style={{ padding: '10px 20px', backgroundColor: '#fafafa', borderBottom: '1px solid #eee' }}>
            <input 
              placeholder="모델명, 브랜드, S/N, 설치처 등으로 검색..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{
                width: '100%', padding: '8px 12px', borderRadius: '6px', 
                border: '1px solid #dddddd', 
                fontSize: '0.9rem', outline: 'none'
              }}
            />
          </div>

          <div style={{ overflowX: 'auto', minHeight: '300px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f9f9f9', borderBottom: '2px solid #eee' }}>
                  <th style={thStyle}>번호</th>
                  <th style={thStyle}>분류</th>
                  <th style={thStyle}>브랜드</th>
                  <th style={thStyle}>제품명</th>
                  <th style={thStyle}>S/N</th>
                  <th style={thStyle}>상태</th>
                  <th style={thStyle}>설치처</th>
                  <th style={thStyle}>매입가</th>
                  <th style={thStyle}>A/S</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr><td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: '#999' }}>검색 결과가 없습니다.</td></tr>
                ) : (
                  filteredItems.map((item, index) => (
                    <React.Fragment key={item.id}>
                      <tr 
                        onClick={() => { if (!editingId) setExpandedId(expandedId === item.id ? null : item.id) }}
                        style={{ borderBottom: '1px solid #eee', cursor: 'pointer', backgroundColor: expandedId === item.id ? '#f0f7ff' : 'transparent' }}
                      >
                        <td style={tdStyle}>{index + 1}</td>
                        <td style={tdStyle}>{item.category}</td>
                        <td style={tdStyle}>{item.brand}</td>
                        <td style={{ ...tdStyle, fontWeight: 'bold' }}>{item.model_name}</td>
                        <td style={tdStyle}>{item.serial_number}</td>
                        <td style={tdStyle}>
                          <span style={{ 
                            padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem',
                            backgroundColor: item.status === '창고' ? '#eee' : '#e3f2fd',
                            color: item.status === '창고' ? '#666' : '#0070f3'
                          }}>
                            {item.status}
                          </span>
                        </td>
                        <td style={tdStyle}>{item.client?.name || '-'}</td>
                        <td style={tdStyle}>{item.purchase_price?.toLocaleString()}원</td>
                        <td style={tdStyle}>0회</td>
                      </tr>

                      {expandedId === item.id && (
                        <tr style={{ backgroundColor: '#fcfcfc', borderBottom: '1px solid #ddd' }}>
                          <td colSpan={9} style={{ padding: '20px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                              <EditableItem label="분류" name="category" val={item.category} isEdit={editingId === item.id} editData={editData} setEditData={setEditData} editStyle={editInputStyle} />
                              <EditableItem label="브랜드" name="brand" val={item.brand} isEdit={editingId === item.id} editData={editData} setEditData={setEditData} editStyle={editInputStyle} />
                              <EditableItem label="모델명" name="model_name" val={item.model_name} isEdit={editingId === item.id} editData={editData} setEditData={setEditData} editStyle={editInputStyle} />
                              <EditableItem label="S/N" name="serial_number" val={item.serial_number} isEdit={editingId === item.id} editData={editData} setEditData={setEditData} editStyle={editInputStyle} />
                              <EditableItem label="매입가" name="purchase_price" val={item.purchase_price} isEdit={editingId === item.id} editData={editData} setEditData={setEditData} editStyle={editInputStyle} />
                              
                              {/* 설치처 검색 및 선택 */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ color: '#888', minWidth: '60px', fontSize: '0.85rem' }}>설치처</span>
                                {editingId === item.id ? (
                                  <div style={{ position: 'relative', width: '100%' }}>
                                    <input
                                      placeholder="거래처 검색..."
                                      value={clientSearchTerm}
                                      onChange={e => {
                                        setClientSearchTerm(e.target.value)
                                        setEditData({ ...editData, client_id: null }) 
                                        setShowClientList(true)
                                      }}
                                      onFocus={() => setShowClientList(true)}
                                      onBlur={() => setTimeout(() => setShowClientList(false), 200)}
                                      style={editInputStyle}
                                    />
                                    {showClientList && (
                                      <div style={dropdownStyle}>
                                        {clients.filter(c => c.name.includes(clientSearchTerm)).length === 0 ? (
                                          <div style={{ padding: '10px', color: '#999', fontSize: '0.85rem' }}>검색 결과 없음</div>
                                        ) : (
                                          clients
                                            .filter(c => c.name.includes(clientSearchTerm))
                                            .map(c => (
                                              <div 
                                                key={c.id} 
                                                onClick={() => {
                                                  setClientSearchTerm(c.name)
                                                  setEditData({ ...editData, client_id: c.id, status: '설치' })
                                                  setShowClientList(false)
                                                }}
                                                style={{ padding: '8px 10px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0', fontSize: '0.9rem' }}
                                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                              >
                                                {c.name}
                                              </div>
                                            ))
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span>{item.client?.name || '-'}</span>
                                )}
                              </div>

                              {/* 상태 수정 */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ color: '#888', minWidth: '60px', fontSize: '0.85rem' }}>상태</span>
                                {editingId === item.id ? (
                                  <select 
                                    value={editData.status} 
                                    onChange={e => {
                                      const newStatus = e.target.value
                                      if (newStatus !== '설치') {
                                        setEditData({ ...editData, status: newStatus, client_id: null })
                                        setClientSearchTerm('')
                                      } else {
                                        setEditData({ ...editData, status: newStatus })
                                      }
                                    }}
                                    style={editInputStyle}
                                  >
                                    <option value="창고">창고</option>
                                    <option value="설치">설치</option>
                                    <option value="수리중">수리중</option>
                                    <option value="폐기">폐기</option>
                                  </select>
                                ) : (
                                  <span>{item.status}</span>
                                )}
                              </div>

                              {/* 메모 */}
                              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '10px', alignItems: 'center' }}>
                                <span style={{ color: '#888', minWidth: '60px', fontSize: '0.85rem' }}>메모</span>
                                {editingId === item.id ? (
                                  <input value={editData.memo || ''} onChange={e => setEditData({ ...editData, memo: e.target.value })} style={editInputStyle} />
                                ) : (
                                  <span>{item.memo || '-'}</span>
                                )}
                              </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                              {editingId === item.id ? (
                                <>
                                  <button onClick={handleUpdate} style={btnStyle.save}>💾 저장</button>
                                  <button onClick={() => setEditingId(null)} style={btnStyle.cancel}>취소</button>
                                </>
                              ) : (
                                <>
                                  <button onClick={() => startEditing(item)} style={btnStyle.edit}>✏️ 수정</button>
                                  <button onClick={() => handleDelete(item.id)} style={btnStyle.delete}>🗑️ 삭제</button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

function EditableItem({ label, name, val, isEdit, editData, setEditData, editStyle }: any) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <span style={{ color: '#888', minWidth: '60px', fontSize: '0.85rem' }}>{label}</span>
      {isEdit ? (
        <input value={editData[name] || ''} onChange={e => setEditData({ ...editData, [name]: e.target.value })} style={editStyle} />
      ) : (
        <span style={{ fontWeight: '500' }}>{val || '-'}</span>
      )}
    </div>
  )
}

const btnStyle = {
  edit: { padding: '6px 12px', border: '1px solid #0070f3', color: '#0070f3', backgroundColor: '#fff', borderRadius: '4px', cursor: 'pointer' },
  delete: { padding: '6px 12px', border: '1px solid #d93025', color: '#d93025', backgroundColor: '#fff', borderRadius: '4px', cursor: 'pointer' },
  save: { padding: '6px 12px', border: 'none', color: '#fff', backgroundColor: '#0070f3', borderRadius: '4px', cursor: 'pointer' },
  cancel: { padding: '6px 12px', border: '1px solid #888', color: '#666', backgroundColor: '#fff', borderRadius: '4px', cursor: 'pointer' }
}