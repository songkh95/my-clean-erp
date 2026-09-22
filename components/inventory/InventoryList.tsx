'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase'
import styles from './InventoryList.module.css'
import Button from './../ui/Button'
import { Inventory, Client } from '@/app/types'
// ✅ Server Actions 임포트
import { deleteInventoryAction, restoreInventoryAction } from '@/app/actions/inventory'
// ✅ 팝업 컴포넌트 재사용
import InventoryForm from './InventoryForm'
import { useSortableData } from '@/utils/tableSort'

interface InventoryListProps {
  type: string
  refreshTrigger: number
  onCountChange?: (count: number) => void
}

type SortKey =
  | 'model_name' | 'serial_number' | 'status' | 'client'
  | 'department' | 'contract_type' | 'category' | 'brand' | 'purchase_price'

export default function InventoryList({ type, refreshTrigger, onCountChange }: InventoryListProps) {
  const [items, setItems] = useState<Inventory[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  // 상세 보기 상태 (단순 조회용)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  
  // ✅ 팝업(모달) 수정용 상태
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<Inventory | null>(null)

  // 데이터 불러오기
  const fetchItems = async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
      if (!profile?.organization_id) return

      // type이 'all'이면 전체 자산, 아니면 해당 type만
      let query = supabase
        .from('inventory')
        .select('*, client:client_id(name)')
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false })

      if (type && type !== 'all' && type !== '복합기') {
        query = query.eq('type', type)
      }

      const { data, error } = await query
      if (error) {
        console.error('Inventory fetch error:', error)
        return
      }
      if (data) setItems(data as Inventory[])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchItems()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, refreshTrigger])

  // 삭제(휴지통 이동) 액션
  const handleDelete = async (id: string) => {
    if (confirm('삭제하면 휴지통으로 이동합니다. 계속할까요? (거래처에 설치된 기기는 먼저 철수해야 삭제할 수 있습니다)')) {
      try {
        const result = await deleteInventoryAction(id);
        if (result.success) {
          alert(result.message); // "휴지통으로 이동되었습니다." — 설정 > 휴지통에서 복구·완전삭제 가능
          fetchItems();
        } else {
          throw new Error(result.message);
        }
      } catch (e: any) {
        alert('삭제 실패: ' + e.message);
      }
    }
  }

  // 휴지통에서 복구
  const handleRestore = async (id: string) => {
    if (!confirm('이 기기를 휴지통에서 복구할까요?')) return
    try {
      const result = await restoreInventoryAction(id);
      if (result.success) {
        alert(result.message);
        fetchItems();
      } else {
        throw new Error(result.message);
      }
    } catch (e: any) {
      alert('복구 실패: ' + e.message);
    }
  }

  // ✅ [수정] 버튼 클릭 시 모달 열기
  const handleEditClick = (e: React.MouseEvent, item: Inventory) => {
    e.stopPropagation(); // 행 클릭(상세보기) 이벤트 방지
    setSelectedItem(item);
    setIsModalOpen(true);
  }

  // 모달 닫기
  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedItem(null);
  }

  // 모달 저장 성공 시 목록 새로고침
  const handleModalSuccess = () => {
    fetchItems();
  }

  const displayStatus = (item: Inventory) => (item.is_deleted ? '휴지통' : item.status)

  const filteredItems = items.filter(item => {
    const term = searchTerm.toLowerCase()
    return (
      (item.model_name?.toLowerCase().includes(term)) ||
      (item.brand?.toLowerCase().includes(term)) ||
      (item.serial_number?.toLowerCase().includes(term)) ||
      ((item as any).department?.toLowerCase().includes(term)) ||
      (item.client?.name?.toLowerCase().includes(term)) ||
      (displayStatus(item)?.includes(term))
    )
  })

  // 표 헤더 클릭 정렬
  const { sortedItems, requestSort, sortIndicator } = useSortableData<Inventory, SortKey>(
    filteredItems,
    (item, key) => {
      if (key === 'status') return displayStatus(item)
      if (key === 'client') return item.client?.name || ''
      if (key === 'department') return (item as any).department || ''
      if (key === 'purchase_price') return item.purchase_price ?? null
      return (item as any)[key] ?? ''
    }
  )

  const sortableTh = (key: SortKey, label: string, extraStyle?: React.CSSProperties) => (
    <th
      className={styles.th}
      style={{ cursor: 'pointer', userSelect: 'none', ...extraStyle }}
      onClick={() => requestSort(key)}
      title="클릭하여 정렬"
    >
      {label}{sortIndicator(key)}
    </th>
  )

  useEffect(() => {
    onCountChange?.(filteredItems.length)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredItems.length])

  if (loading) return <div className={styles.noDataRow}>데이터를 불러오는 중...</div>

  return (
    <div className={styles.container}>
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
                  <th className={styles.th}>No</th>
                  {sortableTh('model_name', '제품명')}
                  {sortableTh('serial_number', 'S/N')}
                  {sortableTh('status', '상태')}
                  {sortableTh('client', '설치처')}
                  {sortableTh('department', '부서')}
                  {sortableTh('contract_type', '계약 구분')}
                  {sortableTh('category', '분류')}
                  {sortableTh('brand', '브랜드')}
                  {sortableTh('purchase_price', '매입가')}
                  <th className={styles.th} style={{textAlign: 'center'}}>관리</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr><td colSpan={11} className={styles.noDataRow}>검색 결과가 없습니다.</td></tr>
                ) : (
                  sortedItems.map((item, index) => {
                    const isExpanded = expandedId === item.id
                    
                    return (
                      <React.Fragment key={item.id}>
                        <tr 
                          onClick={() => setExpandedId(isExpanded ? null : item.id)}
                          className={`${styles.dataRow} ${isExpanded ? styles.dataRowExpanded : ''}`}
                        >
                          <td className={styles.td}>{index + 1}</td>
                          <td className={`${styles.td} ${styles.modelName}`}>{item.model_name}</td>
                          <td className={styles.td}>{item.serial_number}</td>
                          <td className={styles.td}>
                            <span
                              className={`${styles.statusBadge} ${
                                item.is_deleted
                                  ? styles.statusTrash
                                  : item.status === '창고'
                                    ? styles.statusWarehouse
                                    : styles.statusInstalled
                              }`}
                            >
                              {displayStatus(item)}
                            </span>
                          </td>
                          <td className={styles.td}>{item.client?.name || '-'}</td>
                          <td className={styles.td}>{(item as any).department || '-'}</td>
                          <td className={styles.td}>{item.contract_type || '-'}</td>
                          <td className={styles.td}>{item.category}</td>
                          <td className={styles.td}>{item.brand}</td>
                          <td className={styles.td}>{item.purchase_price?.toLocaleString()}원</td>
                          <td className={styles.td} style={{textAlign: 'center'}}>
                             <div style={{display:'flex', gap:'6px', justifyContent:'center'}}>
                                {item.is_deleted ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => { e.stopPropagation(); handleRestore(item.id); }}
                                   
                                  >
                                    복구
                                  </Button>
                                ) : (
                                  <>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={(e) => handleEditClick(e, item)}
                                     
                                    >
                                      수정
                                    </Button>
                                    <Button
                                      variant="danger"
                                      size="sm"
                                      onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                                     
                                    >
                                      삭제
                                    </Button>
                                  </>
                                )}
                             </div>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr className={styles.expandedRow}>
                            <td colSpan={11} className={styles.expandedCell}>
                              <div className={styles.formGrid}>
                                <DetailField label="부서" value={(item as any).department} />
                                <DetailField label="종류" value={item.type} />
                                <DetailField label="제품 상태" value={item.product_condition} />
                                <DetailField label="매입일" value={item.purchase_date} />
                                <DetailField label="매입가" value={item.purchase_price?.toLocaleString() + '원'} />
                                <DetailField label="메모" value={item.memo} fullWidth />
                                
                                {/* 초기 카운터 정보 */}
                                <div className={styles.fullWidthItem} style={{marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed #ddd'}}>
                                   <span className={styles.editableLabel} style={{color: '#0070f3', fontWeight:'bold'}}>🔢 초기 카운터</span>
                                   <div style={{display:'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginTop: '4px'}}>
                                      <DetailField label="흑백(A4)" value={item.initial_count_bw?.toLocaleString()} />
                                      <DetailField label="칼라(A4)" value={item.initial_count_col?.toLocaleString()} />
                                      <DetailField label="흑백(A3)" value={item.initial_count_bw_a3?.toLocaleString()} />
                                      <DetailField label="칼라(A3)" value={item.initial_count_col_a3?.toLocaleString()} />
                                   </div>
                                </div>

                                {/* 설치 상태일 때 요금제 정보 표시 */}
                                {item.status === '설치' && (
                                  <div className={styles.fullWidthItem} style={{marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed #ddd'}}>
                                      <span className={styles.editableLabel} style={{color: '#0070f3', fontWeight:'bold'}}>📅 요금제 정보 (수정은 '수정' 버튼 이용)</span>
                                      <div style={{display:'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginTop: '4px'}}>
                                          <DetailField label="기본료" value={item.plan_basic_fee?.toLocaleString() + '원'} />
                                          <DetailField label="청구일" value={item.billing_date ? `매월 ${item.billing_date}일` : '-'} />
                                          <DetailField label="무료(흑/칼)" value={`${item.plan_basic_cnt_bw?.toLocaleString()} / ${item.plan_basic_cnt_col?.toLocaleString()}`} />
                                          <DetailField label="초과단가(흑/칼)" value={`${item.plan_price_bw}원 / ${item.plan_price_col}원`} />
                                      </div>
                                  </div>
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

      {/* ✅ 수정용 팝업 (InventoryForm 재사용) */}
      <InventoryForm 
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSuccess={handleModalSuccess}
        editData={selectedItem}
      />
    </div>
  )
}

// 단순 조회용 필드 컴포넌트
function DetailField({ label, value, fullWidth = false }: { label: string, value: any, fullWidth?: boolean }) {
  return (
    <div className={styles.editableItem} style={fullWidth ? { gridColumn: '1 / -1' } : {}}>
      <span className={styles.editableLabel}>{label}</span>
      <span className={styles.editableValue}>{value || '-'}</span>
    </div>
  )
}