'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  getConsumablesAction,
  deleteConsumableAction,
  restoreConsumableAction,
} from '@/app/actions/consumable'
import ConsumableForm from './ConsumableForm'
import PendingStockPanel from './PendingStockPanel'
import styles from './InventoryList.module.css'
import { useAppSettings } from '@/hooks/useAppSettings'

interface Props {
  tab: 'consumables' | 'parts' | 'others'
}

export default function ConsumableList({ tab }: Props) {
  const { settings, ready } = useAppSettings()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<any>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  const categoriesForTab = useMemo(() => {
    if (tab === 'consumables') return settings.stock.consumableCategories
    if (tab === 'parts') return settings.stock.partCategories
    return settings.stock.otherCategories
  }, [tab, settings.stock])

  const lowThreshold = settings.stock.lowStockThreshold
  const categoriesKey = categoriesForTab.join('|')

  const fetchItems = async () => {
    setLoading(true)
    try {
      const res = await getConsumablesAction(tab, categoriesForTab, { includeInactive: showInactive })
      if (res.success) setItems(res.data || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!ready) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const res = await getConsumablesAction(tab, categoriesForTab, { includeInactive: showInactive })
        if (cancelled) return
        if (res.success) setItems(res.data || [])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, ready, categoriesKey, showInactive])

  const handleDelete = async (id: string) => {
    if (!confirm('이 자재를 삭제할까요?\n(서비스 일지에서 사용된 경우 완전 삭제 대신 목록에서만 숨깁니다.)')) return
    const res = await deleteConsumableAction(id)
    if (res.success) {
      alert(res.message || '삭제되었습니다.')
      fetchItems()
    } else {
      alert(res.message)
    }
  }

  const handleRestore = async (id: string) => {
    const res = await restoreConsumableAction(id)
    if (res.success) {
      alert(res.message || '복구되었습니다.')
      fetchItems()
    } else {
      alert(res.message)
    }
  }

  const incomplete = useMemo(() => {
    return items.filter((c) => {
      if (c.is_active === false) return false
      const models = Array.isArray(c.compatible_models) ? c.compatible_models : []
      const noCompat = models.length === 0
      const tonerDrum = c.category === '토너' || c.category === '드럼'
      const noColor = tonerDrum && (!c.color || String(c.color).trim() === '')
      return noCompat || noColor
    })
  }, [items])

  const filteredItems = items.filter((item) => {
    const q = searchTerm.toLowerCase()
    const compat = Array.isArray(item.compatible_models)
      ? item.compatible_models.join(' ').toLowerCase()
      : ''
    return (
      item.model_name?.toLowerCase().includes(q) ||
      (item.code && item.code.toLowerCase().includes(q)) ||
      compat.includes(q) ||
      (item.color && String(item.color).toLowerCase().includes(q))
    )
  })

  const config = {
    consumables: { title: '소모품 (토너/드럼)', defaultCategory: categoriesForTab[0] || '토너' },
    parts: { title: '수리 부품', defaultCategory: categoriesForTab[0] || '부품' },
    others: { title: '기타 자재', defaultCategory: categoriesForTab[0] || '기타' },
  }

  return (
    <div className={styles.container}>
      <PendingStockPanel />

      {incomplete.length > 0 && (
        <div style={{
          marginBottom: 12,
          padding: '10px 12px',
          background: '#fffbeb',
          border: '1px solid #fcd34d',
          borderRadius: 8,
          fontSize: '0.82rem',
          color: '#92400e',
        }}>
          <strong>정리 필요 {incomplete.length}건</strong>
          {' — '}토너/드럼 색상 미선택 또는 호환 기기 미등록 품목이 있습니다. 일지 매칭이 안 될 수 있으니 수정해 주세요.
          <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {incomplete.slice(0, 8).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => { setSelectedItem(c); setIsModalOpen(true) }}
                style={{
                  border: '1px solid #fbbf24',
                  background: '#fff',
                  borderRadius: 4,
                  padding: '2px 8px',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                }}
              >
                {c.model_name}
                {!c.color && (c.category === '토너' || c.category === '드럼') ? ' ·색상없음' : ''}
                {!(c.compatible_models || []).length ? ' ·호환없음' : ''}
              </button>
            ))}
            {incomplete.length > 8 ? <span>…</span> : null}
          </div>
        </div>
      )}

      <div className={styles.header} style={{ cursor: 'default' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>📋 {config[tab].title} 목록 ({filteredItems.length}개)</span>
          <label style={{ fontSize: '0.78rem', color: '#666', fontWeight: 500, display: 'flex', gap: 4, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            숨긴 항목 포함
          </label>
        </span>
        <button
          onClick={() => { setSelectedItem(null); setIsModalOpen(true); }}
          style={{
            padding: '6px 12px', backgroundColor: '#0070f3', color: 'white',
            border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem'
          }}
        >
          + 자재 등록
        </button>
      </div>

      <div className={styles.searchContainer}>
        <input
          className={styles.searchInput}
          placeholder="호환기기, 품명, 색상, 관리코드 검색..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr className={styles.theadTr}>
              <th className={styles.th} style={{ width: '50px', textAlign: 'center' }}>No.</th>
              <th className={styles.th} style={{ width: '80px' }}>종류</th>
              <th className={styles.th} style={{ width: '56px', textAlign: 'center' }}>색상</th>
              <th className={styles.th} style={{ minWidth: '140px' }}>호환 기기</th>
              <th className={styles.th}>모델명 (품명)</th>
              <th className={styles.th} style={{ width: '100px' }}>관리코드</th>
              <th className={styles.th} style={{ width: '100px', textAlign: 'right', backgroundColor: '#f0f8ff' }}>현재고</th>
              <th className={styles.th} style={{ width: '120px', textAlign: 'right' }}>단가</th>
              <th className={styles.th} style={{ width: '120px', textAlign: 'right' }}>재고금액</th>
              <th className={styles.th} style={{ width: '120px', textAlign: 'center' }}>관리</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className={styles.noDataRow}>데이터를 불러오는 중...</td></tr>
            ) : filteredItems.length === 0 ? (
              <tr><td colSpan={10} className={styles.noDataRow}>등록된 자재가 없습니다.</td></tr>
            ) : (
              filteredItems.map((item, index) => (
                <tr
                  key={item.id}
                  className={styles.dataRow}
                  style={item.is_active === false ? { opacity: 0.55, background: '#f9fafb' } : undefined}
                >
                  <td className={styles.td} style={{ textAlign: 'center', color: '#888' }}>{index + 1}</td>
                  <td className={styles.td} style={{ textAlign: 'center' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '500',
                      backgroundColor: '#f5f5f5', color: '#555', border: '1px solid #e0e0e0'
                    }}>
                      {item.category}
                    </span>
                  </td>
                  <td className={styles.td} style={{ textAlign: 'center', fontWeight: 700, color: '#111' }}>
                    {item.color || '-'}
                    {item.is_regenerated ? <span style={{ display: 'block', fontSize: '0.65rem', color: '#6b7280' }}>재생</span> : null}
                  </td>
                  <td className={styles.td} style={{ fontWeight: '600', color: '#1d4ed8', fontSize: '0.8rem' }}>
                    {Array.isArray(item.compatible_models) && item.compatible_models.length > 0
                      ? item.compatible_models.join(', ')
                      : (item.product_group || '-')}
                  </td>
                  <td className={styles.td} style={{ fontWeight: '600', color: '#333' }}>
                    {item.model_name}
                    {item.is_active === false ? (
                      <span style={{ marginLeft: 6, fontSize: '0.7rem', color: '#9ca3af' }}>(숨김)</span>
                    ) : null}
                  </td>
                  <td className={styles.td} style={{ color: '#666', fontSize: '0.85rem' }}>
                    {item.code || '-'}
                  </td>
                  <td className={styles.td} style={{
                    textAlign: 'right', fontWeight: 'bold', backgroundColor: '#f9fdff',
                    color: item.current_stock < lowThreshold ? '#d93025' : '#0070f3'
                  }}>
                    {Number(item.current_stock || 0).toLocaleString()}
                  </td>
                  <td className={styles.td} style={{ textAlign: 'right', color: '#666' }}>
                    {Number(item.unit_price || 0).toLocaleString()}원
                  </td>
                  <td className={styles.td} style={{ textAlign: 'right', fontWeight: '500' }}>
                    {(Number(item.current_stock || 0) * Number(item.unit_price || 0)).toLocaleString()}원
                  </td>
                  <td className={styles.td} style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                      {item.is_active === false ? (
                        <button
                          onClick={() => handleRestore(item.id)}
                          style={{
                            background: 'white', border: '1px solid #ddd', color: '#059669',
                            cursor: 'pointer', borderRadius: '4px', fontSize: '0.7rem', padding: '2px 6px'
                          }}
                        >
                          복구
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => { setSelectedItem(item); setIsModalOpen(true); }}
                            style={{
                              background: 'white', border: '1px solid #ddd', color: '#0070f3',
                              cursor: 'pointer', borderRadius: '4px', fontSize: '0.7rem', padding: '2px 6px'
                            }}
                          >
                            수정
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            style={{
                              background: 'white', border: '1px solid #ddd', color: '#d93025',
                              cursor: 'pointer', borderRadius: '4px', fontSize: '0.7rem', padding: '2px 6px'
                            }}
                          >
                            삭제
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <ConsumableForm
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={fetchItems}
          editData={selectedItem}
          defaultCategory={config[tab].defaultCategory}
          categoryOptions={[
            ...settings.stock.consumableCategories,
            ...settings.stock.partCategories,
            ...settings.stock.otherCategories,
          ]}
        />
      )}
    </div>
  )
}
