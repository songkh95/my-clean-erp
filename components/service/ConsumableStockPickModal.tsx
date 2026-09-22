'use client'

import { useMemo, useState, type CSSProperties } from 'react'
import Button from '@/components/ui/Button'
import styles from '@/app/service/service.module.css'

export type StockPickItem = {
  id: string
  category?: string | null
  model_name?: string | null
  code?: string | null
  color?: string | null
  is_regenerated?: boolean | null
  current_stock?: number | null
  product_group?: string | null
  compatible_models?: string[] | null
  is_active?: boolean | null
}

type Props = {
  isOpen: boolean
  title: string
  subtitle?: string
  items: StockPickItem[]
  machineModel: string
  onClose: () => void
  onConfirm: (selected: StockPickItem[]) => void | Promise<void>
}

export default function ConsumableStockPickModal({
  isOpen,
  title,
  subtitle,
  items,
  machineModel,
  onClose,
  onConfirm,
}: Props) {
  const [query, setQuery] = useState('')
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const active = items.filter((c) => c.is_active !== false)
    if (!q) return active
    return active.filter((c) => {
      const hay = [
        c.model_name,
        c.code,
        c.category,
        c.color,
        c.product_group,
        ...(c.compatible_models || []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [items, query])

  if (!isOpen) return null

  const selectedIds = Object.keys(checked).filter((id) => checked[id])
  const selectedItems = filtered.filter((c) => selectedIds.includes(c.id))

  const toggle = (id: string) => {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const handleConfirm = async () => {
    if (selectedItems.length === 0) {
      alert('품목을 1개 이상 선택해 주세요.')
      return
    }
    setBusy(true)
    try {
      await onConfirm(selectedItems)
      setChecked({})
      setQuery('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div
        className={styles.modal}
        style={{ width: 820, maxWidth: '96vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 4 }}>{title}</h2>
        <p style={{ margin: '0 0 10px', fontSize: '0.78rem', color: '#6b7280', lineHeight: 1.45 }}>
          {subtitle || (
            <>
              기기 <strong>{machineModel}</strong> 호환을 추가할 재고를 체크하세요.
              확인 시 호환이 연결되고 이번 일지 사용 목록에 들어갑니다.
            </>
          )}
        </p>

        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="모델명, 관리코드, 제품군, 호환기기 검색…"
          style={{
            width: '100%',
            marginBottom: 10,
            padding: '8px 10px',
            border: '1px solid #e5e7eb',
            borderRadius: 6,
            fontSize: '0.85rem',
            boxSizing: 'border-box',
          }}
        />

        <div style={{ flex: 1, overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ background: '#f9fafb', position: 'sticky', top: 0 }}>
                <th style={thStyle} />
                <th style={thStyle}>모델명</th>
                <th style={thStyle}>종류</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>색상</th>
                <th style={thStyle}>관리코드</th>
                <th style={thStyle}>제품군</th>
                <th style={thStyle}>호환기기</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>재고</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 16, textAlign: 'center', color: '#9ca3af' }}>
                    조건에 맞는 재고가 없습니다.
                    <br />
                    (토너·드럼은 같은 색상·재생만, 부품/폐토너통은 해당 종류만 표시됩니다.)
                    없으면 「새로 등록」을 이용하세요.
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => toggle(c.id)}
                    style={{
                      cursor: 'pointer',
                      background: checked[c.id] ? '#eff6ff' : '#fff',
                      borderTop: '1px solid #f3f4f6',
                    }}
                  >
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={Boolean(checked[c.id])}
                        onChange={() => toggle(c.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{c.model_name || '-'}</td>
                    <td style={tdStyle}>{c.category || '-'}</td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      {c.color || '-'}
                      {c.is_regenerated ? (
                        <span style={{ display: 'block', fontSize: '0.65rem', color: '#6b7280' }}>재생</span>
                      ) : null}
                    </td>
                    <td style={tdStyle}>{c.code || '-'}</td>
                    <td style={tdStyle}>{c.product_group || '-'}</td>
                    <td style={{ ...tdStyle, color: '#1d4ed8', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      title={(c.compatible_models || []).join(', ')}
                    >
                      {(c.compatible_models || []).length
                        ? (c.compatible_models || []).join(', ')
                        : '-'}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>
                      {Number(c.current_stock || 0).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, gap: 8 }}>
          <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>
            {selectedIds.length}개 선택
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="danger" type="button" onClick={onClose} disabled={busy}>
              취소
            </Button>
            <Button variant="primary" type="button" onClick={handleConfirm} disabled={busy}>
              {busy ? '처리 중…' : '호환 추가 후 사용'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

const thStyle: CSSProperties = {
  padding: '8px 10px',
  textAlign: 'left',
  fontWeight: 600,
  color: '#6b7280',
  fontSize: '0.72rem',
  borderBottom: '1px solid #e5e7eb',
  whiteSpace: 'nowrap',
}

const tdStyle: CSSProperties = {
  padding: '8px 10px',
  color: '#111827',
  verticalAlign: 'middle',
}
