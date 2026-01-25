'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase'
// 🔴 [변경] CSS 모듈 불러오기
import styles from './InventoryList.module.css'

export default function InventoryList({ type, refreshTrigger }: { type: string, refreshTrigger: number }) {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [isListOpen, setIsListOpen] = useState(true)

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editData, setEditData] = useState<any>(null)
  const [clients, setClients] = useState<any[]>([])

  const [clientSearchTerm, setClientSearchTerm] = useState('')
  const [showClientList, setShowClientList] = useState(false)

  const supabase = createClient()

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

  return (
    <div className={styles.container}>
      
      {/* 아코디언 헤더 */}
      <div 
        onClick={() => setIsListOpen(!isListOpen)} 
        className={`${styles.header} ${!isListOpen ? styles.headerClosed : ''}`}
      >
        <span>📋 {type} 목록 ({searchTerm ? filteredItems.length : items.length}개)</span>
        <span>{isListOpen ? '▲' : '▼'}</span>
      </div>
      
      {isListOpen && (
        <>
          {/* 검색창 */}
          <div className={styles.searchContainer}>
            <input 
              placeholder="모델명, 브랜드, S/N, 설치처 등으로 검색..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr className={styles.theadTr}>
                  <th className={styles.th}>번호</th>
                  <th className={styles.th}>분류</th>
                  <th className={styles.th}>브랜드</th>
                  <th className={styles.th}>제품명</th>
                  <th className={styles.th}>S/N</th>
                  <th className={styles.th}>상태</th>
                  <th className={styles.th}>설치처</th>
                  <th className={styles.th}>매입가</th>
                  <th className={styles.th}>A/S</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr><td colSpan={9} className={styles.noDataRow}>검색 결과가 없습니다.</td></tr>
                ) : (
                  filteredItems.map((item, index) => (
                    <React.Fragment key={item.id}>
                      <tr 
                        onClick={() => { if (!editingId) setExpandedId(expandedId === item.id ? null : item.id) }}
                        className={`${styles.dataRow} ${expandedId === item.id ? styles.dataRowExpanded : ''}`}
                      >
                        <td className={styles.td}>{index + 1}</td>
                        <td className={styles.td}>{item.category}</td>
                        <td className={styles.td}>{item.brand}</td>
                        <td className={`${styles.td} ${styles.modelName}`}>{item.model_name}</td>
                        <td className={styles.td}>{item.serial_number}</td>
                        <td className={styles.td}>
                          <span className={`${styles.statusBadge} ${item.status === '창고' ? styles.statusWarehouse : styles.statusInstalled}`}>
                            {item.status}
                          </span>
                        </td>
                        <td className={styles.td}>{item.client?.name || '-'}</td>
                        <td className={styles.td}>{item.purchase_price?.toLocaleString()}원</td>
                        <td className={styles.td}>0회</td>
                      </tr>

                      {expandedId === item.id && (
                        <tr className={styles.expandedRow}>
                          <td colSpan={9} className={styles.expandedCell}>
                            <div className={styles.formGrid}>
                              <EditableItem label="분류" name="category" val={item.category} isEdit={editingId === item.id} editData={editData} setEditData={setEditData} />
                              <EditableItem label="브랜드" name="brand" val={item.brand} isEdit={editingId === item.id} editData={editData} setEditData={setEditData} />
                              <EditableItem label="모델명" name="model_name" val={item.model_name} isEdit={editingId === item.id} editData={editData} setEditData={setEditData} />
                              <EditableItem label="S/N" name="serial_number" val={item.serial_number} isEdit={editingId === item.id} editData={editData} setEditData={setEditData} />
                              <EditableItem label="매입가" name="purchase_price" val={item.purchase_price} isEdit={editingId === item.id} editData={editData} setEditData={setEditData} />
                              
                              {/* 설치처 검색 및 선택 */}
                              <div className={styles.formItem}>
                                <span className={styles.formLabel}>설치처</span>
                                {editingId === item.id ? (
                                  <div className={styles.dropdownContainer}>
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
                                      className={styles.formInput}
                                    />
                                    {showClientList && (
                                      <div className={styles.dropdownMenu}>
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
                                                className={styles.dropdownItem}
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
                              <div className={styles.formItem}>
                                <span className={styles.formLabel}>상태</span>
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
                                    className={styles.formInput}
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
                              <div className={styles.fullWidthItem}>
                                <span className={styles.formLabel}>메모</span>
                                {editingId === item.id ? (
                                  <input value={editData.memo || ''} onChange={e => setEditData({ ...editData, memo: e.target.value })} className={styles.formInput} />
                                ) : (
                                  <span>{item.memo || '-'}</span>
                                )}
                              </div>
                            </div>

                            <div className={styles.buttonArea}>
                              {editingId === item.id ? (
                                <>
                                  <button onClick={handleUpdate} className={`${styles.btn} ${styles.btnSave}`}>💾 저장</button>
                                  <button onClick={() => setEditingId(null)} className={`${styles.btn} ${styles.btnCancel}`}>취소</button>
                                </>
                              ) : (
                                <>
                                  <button onClick={() => startEditing(item)} className={`${styles.btn} ${styles.btnEdit}`}>✏️ 수정</button>
                                  <button onClick={() => handleDelete(item.id)} className={`${styles.btn} ${styles.btnDelete}`}>🗑️ 삭제</button>
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

// 조수 컴포넌트 (CSS 모듈 사용)
function EditableItem({ label, name, val, isEdit, editData, setEditData }: any) {
  return (
    <div className={styles.editableItem}>
      <span className={styles.editableLabel}>{label}</span>
      {isEdit ? (
        <input 
          value={editData[name] || ''} 
          onChange={e => setEditData({ ...editData, [name]: e.target.value })} 
          className={styles.formInput} 
        />
      ) : (
        <span className={styles.editableValue}>{val || '-'}</span>
      )}
    </div>
  )
}