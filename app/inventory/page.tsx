'use client'

import React, { useState } from 'react'
import InventoryForm from '@/components/inventory/InventoryForm'
import styles from './inventory.module.css'
import { Inventory } from '@/app/types'
import { useInventory } from './hooks/useInventory'

export default function InventoryPage() {
  const { 
    loading, items, searchTerm, setSearchTerm, statusFilter, setStatusFilter, 
    expandedRows, toggleExpand, fetchInventory, deleteInventory 
  } = useInventory()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<Inventory | null>(null)

  const handleEdit = (e: React.MouseEvent, item: Inventory) => {
    e.stopPropagation() 
    setSelectedItem(item) 
    setIsModalOpen(true) 
  }

  const handleRegister = () => {
    setSelectedItem(null) 
    setIsModalOpen(true)
  }

  return (
    <div className={styles.container}>
      
      <div style={{ marginTop: '30px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 className={styles.title}>📦 자산 및 재고 목록</h2>
          
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
              ) : items.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#666' }}>등록된 장비가 없습니다.</td></tr>
              ) : (
                items.map(item => (
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
                           <button onClick={(e) => { e.stopPropagation(); deleteInventory(item.id); }} className={styles.deleteBtn}>삭제</button>
                         </div>
                      </td>
                    </tr>

                    {expandedRows.has(item.id) && (
                      <tr className={styles.detailRow}>
                        <td colSpan={7} className={styles.detailContent}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '20px' }}>
                            <div>
                              <div className={styles.label}>제품 상태</div>
                              <div className={styles.value}>{(item as any).product_condition || '-'}</div>
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

                          {/* ✅ [수정됨] 초기 카운터 정보 박스 - 한 줄(Flex) 레이아웃 적용 */}
                          <div className={styles.infoBox} style={{
                            marginBottom: '20px', 
                            padding: '16px 20px', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '30px'
                          }}>
                            <div style={{ 
                              fontSize: '0.9rem', 
                              fontWeight: '700', 
                              color: '#171717', 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '6px',
                              minWidth: '150px' 
                            }}>
                              <span style={{color:'#0070f3'}}>🔢</span> 초기 카운터
                            </div>
                            
                            <div style={{ display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
                              <div style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ color: '#666' }}>흑백 A4</span>
                                <b style={{ color: '#171717' }}>{item.initial_count_bw?.toLocaleString() || 0}</b>
                              </div>
                              <div style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ color: '#0070f3' }}>칼라 A4</span>
                                <b style={{ color: '#171717' }}>{item.initial_count_col?.toLocaleString() || 0}</b>
                              </div>
                              {/* 구분선 */}
                              <div style={{ width: '1px', height: '14px', backgroundColor: '#E5E5E5' }}></div>
                              
                              <div style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ color: '#666' }}>흑백 A3</span>
                                <b style={{ color: '#171717' }}>{item.initial_count_bw_a3?.toLocaleString() || 0}</b>
                              </div>
                              <div style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ color: '#0070f3' }}>칼라 A3</span>
                                <b style={{ color: '#171717' }}>{item.initial_count_col_a3?.toLocaleString() || 0}</b>
                              </div>
                            </div>
                          </div>

                          <div className={styles.infoBox}>
                            <div className={styles.label}>📝 비고 (특이사항)</div>
                            <div style={{ fontSize: '0.95rem', whiteSpace: 'pre-wrap', color: '#171717', lineHeight:'1.5', marginTop:'8px' }}>
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