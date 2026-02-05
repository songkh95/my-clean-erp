'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase'
import styles from './InventoryList.module.css'
import Button from './../ui/Button'
import { Inventory, Client } from '@/app/types'
// ✅ [최적화] Server Actions 임포트
import { deleteInventoryAction, updateInventoryAction } from '@/app/actions/inventory'

interface InventoryListProps {
  type: string
  refreshTrigger: number
}

interface EditableFieldProps {
  label: string
  name: keyof Inventory
  val: string | number | undefined | null
  isEdit: boolean
  editData: Inventory | null
  setEditData: (data: Inventory) => void
  type?: 'text' | 'number' | 'date'
}

export default function InventoryList({ type, refreshTrigger }: InventoryListProps) {
  const [items, setItems] = useState<Inventory[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [isListOpen, setIsListOpen] = useState(true)

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editData, setEditData] = useState<Inventory | null>(null)
  const [clients, setClients] = useState<Client[]>([])

  const [clientSearchTerm, setClientSearchTerm] = useState('')
  const [showClientList, setShowClientList] = useState(false)

  const supabase = createClient()

  const fetchItems = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
      
      if (profile?.organization_id) {
        // 클라이언트 사이드 조회는 허용 (단순 조회이므로)
        const { data } = await supabase
          .from('inventory')
          .select('*, client:client_id(name)')
          .eq('type', type)
          .eq('organization_id', profile.organization_id)
          .order('created_at', { ascending: false })
        
        if (data) setItems(data as Inventory[])
      }

      const { data: cData } = await supabase.from('clients').select('*').eq('status', 'active')
      if (cData) setClients(cData as Client[])
    }
    setLoading(false)
  }

  useEffect(() => { fetchItems() }, [type, refreshTrigger])

  // ✅ [최적화] Server Action으로 삭제 (보안 강화)
  const handleDelete = async (id: string) => {
    if (confirm('정말 삭제하시겠습니까? 복구할 수 없습니다.')) {
      try {
        const result = await deleteInventoryAction(id);
        if (result.success) {
          alert(result.message);
          fetchItems();
        } else {
          throw new Error(result.message);
        }
      } catch (e: any) {
        alert('삭제 실패: ' + e.message);
      }
    }
  }

  const startEditing = (item: Inventory) => {
    setEditingId(item.id)
    setEditData({ ...item })
    setClientSearchTerm(item.client?.name || '')
  }

  // ✅ [최적화] Server Action으로 수정 (데이터 무결성 보장)
  const handleUpdate = async () => {
    if (!editData || !editingId) return;

    // Server Action에 보낼 데이터 정제
    const payload: Partial<Inventory> = { ...editData };
    
    // 관계형 데이터나 불필요한 필드 제거
    delete payload.client;
    delete payload.created_at;
    
    // 유효성 검사
    if (payload.status === '설치' && !payload.client_id) {
      alert("⚠️ 상태가 '설치'일 경우, 설치처를 반드시 입력(선택)해야 합니다.")
      return
    }

    try {
      // payload에서 필요한 값만 추출하여 전송
      const updateData = {
        ...payload,
        client_id: payload.client_id || null,
        purchase_price: payload.purchase_price === undefined || payload.purchase_price === null ? null : Number(payload.purchase_price),
        purchase_date: payload.purchase_date === '' ? null : payload.purchase_date,
      }

      const result = await updateInventoryAction(editingId, updateData);

      if (result.success) {
        alert(result.message);
        setEditingId(null);
        setExpandedId(null);
        fetchItems();
      } else {
        throw new Error(result.message);
      }
    } catch (e: any) {
      alert('수정 실패: ' + e.message);
    }
  }

  const filteredItems = items.filter(item => {
    const term = searchTerm.toLowerCase()
    return (
      (item.model_name?.toLowerCase().includes(term)) ||
      (item.brand?.toLowerCase().includes(term)) ||
      (item.serial_number?.toLowerCase().includes(term)) ||
      (item.client?.name?.toLowerCase().includes(term)) ||
      (item.status?.includes(term))
    )
  })

  if (loading) return <div className={styles.noDataRow}>데이터를 불러오는 중...</div>

  return (
    <div className={styles.container}>
      <div 
        onClick={() => setIsListOpen(!isListOpen)} 
        className={`${styles.header} ${!isListOpen ? styles.headerClosed : ''}`}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>{isListOpen ? '▼' : '▶'}</span>
          📋 {type} 목록 ({filteredItems.length}개)
        </span>
      </div>
      
      {isListOpen && (
        <>
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
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr><td colSpan={8} className={styles.noDataRow}>검색 결과가 없습니다.</td></tr>
                ) : (
                  filteredItems.map((item, index) => {
                    const isExpanded = expandedId === item.id
                    const isEditing = editingId === item.id
                    return (
                      <React.Fragment key={item.id}>
                        <tr 
                          onClick={() => { if (!editingId) setExpandedId(isExpanded ? null : item.id) }}
                          className={`${styles.dataRow} ${isExpanded ? styles.dataRowExpanded : ''}`}
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
                        </tr>

                        {isExpanded && (
                          <tr className={styles.expandedRow}>
                            <td colSpan={8} className={styles.expandedCell}>
                              <div className={styles.formGrid}>
                                <EditableField label="분류" name="category" val={item.category} isEdit={isEditing} editData={editData} setEditData={setEditData} />
                                <EditableField label="브랜드" name="brand" val={item.brand} isEdit={isEditing} editData={editData} setEditData={setEditData} />
                                <EditableField label="모델명" name="model_name" val={item.model_name} isEdit={isEditing} editData={editData} setEditData={setEditData} />
                                <EditableField label="S/N" name="serial_number" val={item.serial_number} isEdit={isEditing} editData={editData} setEditData={setEditData} />
                                <EditableField label="매입가" name="purchase_price" val={item.purchase_price} isEdit={isEditing} editData={editData} setEditData={setEditData} type="number" />
                                <EditableField label="매입일" name="purchase_date" val={item.purchase_date} isEdit={isEditing} editData={editData} setEditData={setEditData} type="date" />
                                
                                <div className={styles.editableItem}>
                                  <span className={styles.editableLabel}>설치처</span>
                                  {isEditing && editData ? (
                                    <div className={styles.dropdownContainer}>
                                      <input
                                        placeholder="거래처 검색..."
                                        value={clientSearchTerm}
                                        className={styles.formInput}
                                        onChange={e => {
                                          setClientSearchTerm(e.target.value)
                                          setEditData({ ...editData, client_id: null }) 
                                          setShowClientList(true)
                                        }}
                                        onFocus={() => setShowClientList(true)}
                                        onBlur={() => setTimeout(() => setShowClientList(false), 200)}
                                      />
                                      {showClientList && (
                                        <div className={styles.dropdownMenu}>
                                          {clients.filter(c => c.name.includes(clientSearchTerm)).map(c => (
                                            <div key={c.id} onClick={() => {
                                              setClientSearchTerm(c.name)
                                              setEditData({ ...editData, client_id: c.id, status: '설치' })
                                              setShowClientList(false)
                                            }} className={styles.dropdownItem}>
                                              {c.name}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <span className={styles.editableValue}>{item.client?.name || '-'}</span>
                                  )}
                                </div>

                                <div className={styles.editableItem}>
                                  <span className={styles.editableLabel}>상태</span>
                                  {isEditing && editData ? (
                                    <select 
                                      value={editData.status} 
                                      onChange={e => setEditData({ ...editData, status: e.target.value, client_id: e.target.value === '설치' ? editData.client_id : null })}
                                      className={styles.formInput}
                                    >
                                      <option value="창고">창고</option>
                                      <option value="설치">설치</option>
                                      <option value="수리중">수리중</option>
                                      <option value="폐기">폐기</option>
                                    </select>
                                  ) : (
                                    <span className={styles.editableValue}>{item.status}</span>
                                  )}
                                </div>

                                <div className={styles.fullWidthItem}>
                                  <span className={styles.editableLabel}>메모</span>
                                  {isEditing && editData ? (
                                    <input value={editData.memo || ''} onChange={e => setEditData({ ...editData, memo: e.target.value })} className={styles.formInput} />
                                  ) : (
                                    <span className={styles.editableValue}>{item.memo || '-'}</span>
                                  )}
                                </div>
                              </div>

                              <div className={styles.buttonArea}>
                                {isEditing ? (
                                  <>
                                    <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>취소</Button>
                                    <Button variant="primary" size="sm" onClick={handleUpdate}>💾 저장</Button>
                                  </>
                                ) : (
                                  <>
                                    <Button variant="outline" size="sm" onClick={() => startEditing(item)}>✏️ 수정</Button>
                                    <Button variant="danger" size="sm" onClick={() => handleDelete(item.id)}>🗑️ 삭제</Button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

function EditableField({ label, name, val, isEdit, editData, setEditData, type = "text" }: EditableFieldProps) {
  return (
    <div className={styles.editableItem}>
      <span className={styles.editableLabel}>{label}</span>
      {isEdit && editData ? (
        <input 
          type={type}
          value={(editData[name] as string | number) ?? ''} 
          onChange={e => setEditData({ ...editData, [name]: type === "number" ? Number(e.target.value) : e.target.value })} 
          className={styles.formInput} 
        />
      ) : (
        <span className={styles.editableValue}>{type === "number" ? (val as number)?.toLocaleString() + '원' : (val || '-')}</span>
      )}
    </div>
  )
}