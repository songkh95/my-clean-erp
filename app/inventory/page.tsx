'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase'
import InventoryForm from '@/components/inventory/InventoryForm'
import styles from './inventory.module.css'

export default function InventoryPage() {
  const supabase = createClient()
  
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<any>(null)
  
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchInventory()
  }, [])

  const fetchInventory = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user?.id).single()
    
    if (profile?.organization_id) {
      const { data } = await supabase
        .from('inventory')
        .select(`*, client:client_id (name)`)
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false })
      
      if (data) setItems(data)
    }
    setLoading(false)
  }

  const toggleExpand = (id: string) => {
    const newSet = new Set(expandedRows)
    if (newSet.has(id)) newSet.delete(id)
    else newSet.add(id)
    setExpandedRows(newSet)
  }

  const handleEdit = (e: React.MouseEvent, item: any) => {
    e.stopPropagation() 
    setSelectedItem(item) 
    setIsModalOpen(true) 
  }

  const handleRegister = () => {
    setSelectedItem(null) 
    setIsModalOpen(true)
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation() 
    if (confirm('정말 삭제하시겠습니까?')) {
      await supabase.from('inventory').delete().eq('id', id)
      fetchInventory()
    }
  }

  const filteredItems = items.filter(item => {
    const matchesSearch = 
      item.model_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.serial_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.client?.name && item.client.name.includes(searchTerm))
    const matchesStatus = statusFilter === 'all' ? true : item.status === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <div className={styles.container}>
      
      <div style={{ marginTop: '30px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          
          <div className={styles.controls}>
            <select 
              value={statusFilter} 
              onChange={e => setStatusFilter(e.target.value)}
              className={styles.select}
            >
              <option value="all">전체 상태</option>
              <option value="창고">창고</option>
              <option value="설치">설치됨</option>
              <option value="수리중">수리중</option>
              <option value="폐기">폐기</option>
              <option value="분실">분실</option>
            </select>

            <input 
              placeholder="모델명, S/N, 거래처 검색" 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className={styles.input}
              style={{ width: '250px' }}
            />

            <button onClick={handleRegister} className={styles.primaryBtn}>
              + 장비 추가
            </button>
          </div>
        </div>

        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>종류/구분</th>
                <th className={styles.th}>브랜드</th>
                <th className={styles.th}>모델명</th>
                <th className={styles.th}>Serial Number</th>
                <th className={styles.th} style={{textAlign:'center'}}>상태</th>
                <th className={styles.th}>설치 위치</th>
                <th className={styles.th} style={{textAlign:'center'}}>관리</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#666' }}>데이터를 불러오는 중...</td></tr>
              ) : filteredItems.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#666' }}>등록된 장비가 없습니다.</td></tr>
              ) : (
                filteredItems.map(item => (
                  <React.Fragment key={item.id}>
                    <tr 
                      onClick={() => toggleExpand(item.id)}
                      className={`${styles.tr} ${expandedRows.has(item.id) ? styles.trSelected : ''}`}
                    >
                      <td className={styles.td}>
                        <div style={{fontWeight:'500'}}>{item.type}</div>
                        <div style={{ fontSize:'0.8rem', color:'#666666' }}>{item.category}</div>
                      </td>
                      <td className={styles.td} style={{ color: '#666666' }}>{item.brand}</td>
                      <td className={styles.td}>
                         <span style={{ fontWeight: '600', color:'#171717' }}>{item.model_name}</span>
                         <span style={{ fontSize:'0.7rem', color:'#666666', marginLeft:'6px' }}>{expandedRows.has(item.id) ? '▲' : '▼'}</span>
                      </td>
                      <td className={styles.td} style={{ color: '#666666' }}>{item.serial_number}</td>
                      <td className={styles.td} style={{ textAlign: 'center' }}>
                        {/* 상태 뱃지는 기능적 색상 유지하되 톤 다운 */}
                        <span style={{
                          padding: '4px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '600',
                          backgroundColor: item.status === '설치' ? 'rgba(0, 112, 243, 0.1)' : (item.status === '창고' ? '#FFF8E1' : '#FFF1F0'),
                          color: item.status === '설치' ? '#0070f3' : (item.status === '창고' ? '#F57F17' : '#F5222D'),
                          border: item.status === '설치' ? '1px solid rgba(0, 112, 243, 0.2)' : 'none'
                        }}>
                          {item.status}
                        </span>
                      </td>
                      <td className={styles.td}>
                        {item.client ? (
                          <span style={{ fontWeight: '600', color: '#0070f3' }}>{item.client.name}</span>
                        ) : (
                          <span style={{ color: '#E5E5E5' }}>-</span>
                        )}
                      </td>
                      <td className={styles.td} style={{ textAlign: 'center' }}>
                         <div style={{display:'flex', gap:'8px', justifyContent:'center'}}>
                           <button onClick={(e) => handleEdit(e, item)} className={styles.secondaryBtn}>수정</button>
                           <button onClick={(e) => handleDelete(e, item.id)} className={styles.deleteBtn}>삭제</button>
                         </div>
                      </td>
                    </tr>

                    {expandedRows.has(item.id) && (
                      <tr className={styles.detailRow}>
                        <td colSpan={7} className={styles.detailContent}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '20px' }}>
                            <div>
                              <div className={styles.label}>제품 상태</div>
                              <div className={styles.value}>{item.product_condition}</div>
                            </div>
                            <div>
                              <div className={styles.label}>매입일</div>
                              <div className={styles.value}>{item.purchase_date || '-'}</div>
                            </div>
                            <div>
                              <div className={styles.label}>매입가</div>
                              <div className={styles.value}>{item.purchase_price ? `${Number(item.purchase_price).toLocaleString()}원` : '0원'}</div>
                            </div>
                            <div>
                              <div className={styles.label}>현재 상태</div>
                              <div className={styles.value} style={{color: item.status === '설치' ? '#0070f3' : '#171717'}}>{item.status}</div>
                            </div>
                          </div>

                          {/* 초기 카운터 정보 박스 */}
                          <div className={styles.detailBox} style={{marginBottom: '20px'}}>
                            <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#171717', marginBottom: '15px', paddingBottom:'10px', borderBottom:'1px solid #E5E5E5', display:'flex', alignItems:'center', gap:'8px' }}>
                              <span style={{color:'#0070f3'}}>🔢</span> 초기 카운터 (Meter Reading)
                            </div>
                            <div style={{ display: 'flex', gap: '40px' }}>
                              <div>
                                <span style={{ color: '#666666', marginRight: '8px', fontSize:'0.9rem' }}>흑백 A4</span>
                                <b style={{fontSize:'1rem', color:'#171717'}}>{item.initial_count_bw?.toLocaleString() || 0}</b>
                              </div>
                              <div>
                                <span style={{ color: '#0070f3', marginRight: '8px', fontSize:'0.9rem' }}>칼라 A4</span>
                                <b style={{fontSize:'1rem', color:'#171717'}}>{item.initial_count_col?.toLocaleString() || 0}</b>
                              </div>
                              <div style={{ borderLeft:'1px solid #E5E5E5', paddingLeft:'40px' }}>
                                <span style={{ color: '#666666', marginRight: '8px', fontSize:'0.9rem' }}>흑백 A3</span>
                                <b style={{fontSize:'1rem', color:'#171717'}}>{item.initial_count_bw_a3?.toLocaleString() || 0}</b>
                              </div>
                              <div>
                                <span style={{ color: '#0070f3', marginRight: '8px', fontSize:'0.9rem' }}>칼라 A3</span>
                                <b style={{fontSize:'1rem', color:'#171717'}}>{item.initial_count_col_a3?.toLocaleString() || 0}</b>
                              </div>
                            </div>
                          </div>

                          {/* 메모 박스 */}
                          <div className={styles.detailBox}>
                            <div className={styles.label}>📝 비고 (특이사항)</div>
                            <div style={{ fontSize: '0.95rem', whiteSpace: 'pre-wrap', color: '#171717', lineHeight:'1.5' }}>
                              {item.memo || '등록된 메모가 없습니다.'}
                            </div>
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
      </div>

      <InventoryForm 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchInventory}
        editData={selectedItem}
      />

    </div>
  )
}