'use client'

import React, { useState, useEffect } from 'react'
import { getConsumablesAction, deleteConsumableAction } from '@/app/actions/consumable'
import ConsumableForm from './ConsumableForm'
import styles from './InventoryList.module.css' // 기존 스타일 재활용 (통일감 유지)

interface Props {
  tab: 'consumables' | 'parts' | 'others'
}

export default function ConsumableList({ tab }: Props) {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<any>(null)
  const [searchTerm, setSearchTerm] = useState('')

  // 탭 변경 시 데이터 다시 불러오기
  useEffect(() => {
    fetchItems()
  }, [tab])

  const fetchItems = async () => {
    setLoading(true)
    const res = await getConsumablesAction(tab)
    if (res.success) {
      setItems(res.data)
    }
    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return
    const res = await deleteConsumableAction(id)
    if (res.success) {
      alert('삭제되었습니다.')
      fetchItems()
    } else {
      alert(res.message)
    }
  }

  // 검색 필터링 (모델명, 코드명)
  const filteredItems = items.filter(item => 
    item.model_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.code && item.code.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  // 탭에 따른 제목 및 기본 카테고리 설정
  const config = {
    consumables: { title: '소모품 (토너/드럼)', defaultCategory: '토너' },
    parts: { title: '수리 부품', defaultCategory: '부품' },
    others: { title: '기타 자재', defaultCategory: '기타' }
  }

  return (
    <div className={styles.container}>
      {/* 헤더 영역 */}
      <div className={styles.header} style={{ cursor: 'default' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>📋 {config[tab].title} 목록 ({filteredItems.length}개)</span>
        </span>
        <button 
          onClick={() => { setSelectedItem(null); setIsModalOpen(true); }}
          style={{
            padding:'6px 12px', backgroundColor:'#0070f3', color:'white', 
            border:'none', borderRadius:'4px', cursor:'pointer', fontWeight:'600', fontSize:'0.85rem'
          }}
        >
          + 자재 등록
        </button>
      </div>

      {/* 검색창 */}
      <div className={styles.searchContainer}>
        <input 
          className={styles.searchInput}
          placeholder="모델명, 관리코드 검색..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      {/* 엑셀 스타일 리스트 테이블 */}
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr className={styles.theadTr}>
              <th className={styles.th} style={{width:'50px', textAlign:'center'}}>No.</th>
              <th className={styles.th} style={{width:'100px'}}>카테고리</th>
              <th className={styles.th}>모델명 (품명)</th>
              <th className={styles.th} style={{width:'120px'}}>관리코드</th>
              <th className={styles.th} style={{width:'100px', textAlign:'right', backgroundColor:'#f0f8ff'}}>현재고</th>
              <th className={styles.th} style={{width:'120px', textAlign:'right'}}>단가</th>
              <th className={styles.th} style={{width:'120px', textAlign:'right'}}>재고금액</th>
              <th className={styles.th} style={{width:'100px', textAlign:'center'}}>관리</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className={styles.noDataRow}>데이터를 불러오는 중...</td></tr>
            ) : filteredItems.length === 0 ? (
              <tr><td colSpan={8} className={styles.noDataRow}>등록된 자재가 없습니다.</td></tr>
            ) : (
              filteredItems.map((item, index) => (
                <tr key={item.id} className={styles.dataRow}>
                  <td className={styles.td} style={{textAlign:'center', color:'#888'}}>{index + 1}</td>
                  <td className={styles.td} style={{textAlign:'center'}}>
                    <span style={{
                      padding:'2px 8px', borderRadius:'4px', fontSize:'0.75rem', fontWeight:'500',
                      backgroundColor: '#f5f5f5', color: '#555', border: '1px solid #e0e0e0'
                    }}>
                      {item.category}
                    </span>
                  </td>
                  <td className={styles.td} style={{fontWeight:'600', color:'#333'}}>
                    {item.model_name}
                  </td>
                  <td className={styles.td} style={{color:'#666', fontSize:'0.85rem'}}>
                    {item.code || '-'}
                  </td>
                  <td className={styles.td} style={{textAlign:'right', fontWeight:'bold', backgroundColor:'#f9fdff', color: item.current_stock < 5 ? '#d93025' : '#0070f3'}}>
                    {item.current_stock.toLocaleString()}
                  </td>
                  <td className={styles.td} style={{textAlign:'right', color:'#666'}}>
                    {item.unit_price?.toLocaleString()}원
                  </td>
                  <td className={styles.td} style={{textAlign:'right', fontWeight:'500'}}>
                    {(item.current_stock * item.unit_price).toLocaleString()}원
                  </td>
                  <td className={styles.td} style={{textAlign:'center'}}>
                    <div style={{display:'flex', gap:'4px', justifyContent:'center'}}>
                      <button 
                        onClick={() => { setSelectedItem(item); setIsModalOpen(true); }}
                        style={{
                          background:'white', border:'1px solid #ddd', color:'#0070f3', 
                          cursor:'pointer', borderRadius:'4px', fontSize:'0.7rem', padding:'2px 6px'
                        }}
                      >
                        수정
                      </button>
                      <button 
                        onClick={() => handleDelete(item.id)}
                        style={{
                          background:'white', border:'1px solid #ddd', color:'#d93025', 
                          cursor:'pointer', borderRadius:'4px', fontSize:'0.7rem', padding:'2px 6px'
                        }}
                      >
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 등록/수정 모달 */}
      {isModalOpen && (
        <ConsumableForm 
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={fetchItems}
          editData={selectedItem}
          defaultCategory={config[tab].defaultCategory}
        />
      )}
    </div>
  )
}