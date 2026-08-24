'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  confirmPendingPartsAction,
  getPendingPartsAction,
} from '@/app/actions/service'
import { addConsumableStockAction, getConsumablesAction } from '@/app/actions/consumable'
import ConsumableForm from './ConsumableForm'
import styles from './PendingStockPanel.module.css'

type Props = {
  onGoConsumables?: () => void
}

export default function PendingStockPanel({ onGoConsumables }: Props) {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [hint, setHint] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [stockDraft, setStockDraft] = useState<Record<string, string>>({})
  const [editItem, setEditItem] = useState<any | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await getPendingPartsAction()
    setRows(res.data || [])
    setHint(res.message || '')
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const summary = useMemo(() => {
    const clients = new Set<string>()
    let qty = 0
    for (const row of rows) {
      const name = row.service_log?.client?.name
      if (name) clients.add(name)
      qty += Number(row.quantity) || 0
    }
    return { clients: Array.from(clients), qty }
  }, [rows])

  const confirmOne = async (usageId: string) => {
    setBusyId(usageId)
    const res = await confirmPendingPartsAction({ usageIds: [usageId] })
    setBusyId(null)
    if (!res.success) {
      alert(res.message)
      return
    }
    await load()
  }

  const confirmAllForConsumable = async (consumableId: string, name: string) => {
    if (!confirm(`${name}의 미입고 항목을 모두 확정할까요?\n재고가 충분해야 합니다.`)) return
    setBusyId(consumableId)
    const res = await confirmPendingPartsAction({ consumableId })
    setBusyId(null)
    if (!res.success) {
      alert(res.message)
      return
    }
    alert(res.message)
    await load()
  }

  const addStock = async (consumableId: string) => {
    const qty = Math.floor(Number(stockDraft[consumableId]))
    if (!Number.isFinite(qty) || qty <= 0) {
      alert('입고 수량을 입력하세요.')
      return
    }
    setBusyId(`stock-${consumableId}`)
    const res = await addConsumableStockAction(consumableId, qty)
    setBusyId(null)
    if (!res.success) {
      alert(res.message)
      return
    }
    setStockDraft((prev) => ({ ...prev, [consumableId]: '' }))
    alert(res.message)
    await load()
  }

  const openEdit = async (row: any) => {
    onGoConsumables?.()
    const id = row.consumable_id
    const res = await getConsumablesAction()
    const full = (res.data || []).find((c: any) => c.id === id)
    setEditItem(
      full || {
        ...(row.consumable || {}),
        id,
        model_name: row.consumable?.model_name,
        current_stock: row.consumable?.current_stock,
        category: row.consumable?.category || '토너',
        compatible_models: [],
      }
    )
  }

  if (loading) {
    return (
      <div className={styles.wrap}>
        <div className={styles.title}>미입고(재고 없음) 알림</div>
        <p className={styles.empty}>불러오는 중…</p>
      </div>
    )
  }

  if (rows.length === 0) {
    if (!hint) return null
    return (
      <div className={styles.wrap}>
        <div className={styles.title}>미입고(재고 없음) 알림</div>
        <p className={styles.empty}>
          {hint.includes('stock_status')
            ? 'SQL(service_parts_stock_status.sql) 실행 후 사용 가능합니다.'
            : hint}
        </p>
      </div>
    )
  }

  return (
    <>
      <div className={styles.wrap}>
        <div className={styles.head}>
          <div>
            <div className={styles.title}>미입고(재고 없음) · {rows.length}건 / {summary.qty}개</div>
            <p className={styles.desc} style={{ marginBottom: 0 }}>
              거래처 {summary.clients.slice(0, 4).join(', ') || '미확인'}
              {summary.clients.length > 4 ? ` 외 ${summary.clients.length - 4}곳` : ''}
              에서 재고 없이 소모품을 등록했습니다. 표로 확인하고 입고·확정하세요.
            </p>
          </div>
          <div className={styles.groupActions}>
            <button type="button" className={styles.refresh} onClick={() => void load()}>
              새로고침
            </button>
            <button type="button" className={styles.goBtn} style={{ marginBottom: 0 }} onClick={() => setModalOpen(true)}>
              표로 전체 보기
            </button>
          </div>
        </div>
      </div>

      {modalOpen ? (
        <div className={styles.modalOverlay} onClick={() => setModalOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <h3 className={styles.modalTitle}>미입고 전체 목록</h3>
              <button type="button" className={styles.refresh} onClick={() => setModalOpen(false)}>
                닫기
              </button>
            </div>
            <p className={styles.desc}>
              서비스 일지에서 재고가 없는데 소모품을 등록한 건입니다. 거래처·소모품을 확인한 뒤 입고하고 확정하세요.
            </p>

            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>거래처</th>
                    <th>소모품</th>
                    <th>수량</th>
                    <th>방문일</th>
                    <th>기기</th>
                    <th>현재고</th>
                    <th>입고</th>
                    <th>처리</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const client = row.service_log?.client?.name || '거래처 미확인'
                    const item = row.consumable?.model_name || '소모품'
                    const qty = Number(row.quantity) || 0
                    const stock = Number(row.consumable?.current_stock) || 0
                    const inv = row.service_log?.inventory
                    const invLabel = inv
                      ? [inv.model_name, inv.department ? `(${inv.department})` : '', inv.serial_number]
                          .filter(Boolean)
                          .join(' ')
                      : '-'
                    const canConfirm = stock >= qty
                    return (
                      <tr key={row.id}>
                        <td>
                          <strong>{client}</strong>
                        </td>
                        <td>
                          <button type="button" className={styles.linkCell} onClick={() => void openEdit(row)}>
                            {item}
                          </button>
                          {row.consumable?.category ? (
                            <div className={styles.sub}>{row.consumable.category}{row.consumable.color ? ` · ${row.consumable.color}` : ''}</div>
                          ) : null}
                        </td>
                        <td className={styles.num}>{qty}</td>
                        <td>{row.service_log?.visit_date || '-'}</td>
                        <td>{invLabel}</td>
                        <td className={styles.num} style={{ color: canConfirm ? '#059669' : '#dc2626' }}>
                          {stock}
                        </td>
                        <td>
                          <div className={styles.inlineStock}>
                            <input
                              type="number"
                              min={1}
                              className={styles.stockInput}
                              placeholder="수량"
                              value={stockDraft[row.consumable_id] ?? ''}
                              onChange={(e) =>
                                setStockDraft((prev) => ({
                                  ...prev,
                                  [row.consumable_id]: e.target.value,
                                }))
                              }
                            />
                            <button
                              type="button"
                              className={styles.stockBtn}
                              disabled={busyId === `stock-${row.consumable_id}`}
                              onClick={() => void addStock(row.consumable_id)}
                            >
                              입고
                            </button>
                          </div>
                        </td>
                        <td>
                          <div className={styles.rowActions}>
                            <button
                              type="button"
                              className={styles.smallBtn}
                              disabled={!canConfirm || busyId === row.id}
                              onClick={() => void confirmOne(row.id)}
                            >
                              확정
                            </button>
                            <button
                              type="button"
                              className={styles.linkBtn}
                              onClick={() =>
                                void confirmAllForConsumable(row.consumable_id, item)
                              }
                            >
                              일괄
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      <ConsumableForm
        isOpen={Boolean(editItem)}
        editData={editItem}
        defaultCategory={editItem?.category || '토너'}
        onClose={() => setEditItem(null)}
        onSuccess={() => {
          setEditItem(null)
          load()
        }}
      />
    </>
  )
}
