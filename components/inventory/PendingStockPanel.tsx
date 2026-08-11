'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  confirmPendingPartsAction,
  getPendingPartsAction,
} from '@/app/actions/service'
import { addConsumableStockAction, getConsumablesAction } from '@/app/actions/consumable'
import ConsumableForm from '@/components/inventory/ConsumableForm'
import styles from './PendingStockPanel.module.css'

export default function PendingStockPanel() {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [hint, setHint] = useState('')
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

  const confirmOne = async (usageId: string) => {
    setBusyId(usageId)
    const res = await confirmPendingPartsAction({ usageIds: [usageId] })
    setBusyId(null)
    if (!res.success) {
      alert(res.message)
      return
    }
    alert(res.message)
    load()
  }

  const confirmAllForConsumable = async (consumableId: string, name: string) => {
    if (!confirm(`${name}의 미입고 항목을 모두 확정(재고 차감)할까요?\n재고가 충분해야 합니다.`)) return
    setBusyId(consumableId)
    const res = await confirmPendingPartsAction({ consumableId })
    setBusyId(null)
    if (!res.success) {
      alert(res.message)
      return
    }
    alert(res.message)
    load()
  }

  const openEdit = async (consumableId: string, fallback: any) => {
    const res = await getConsumablesAction()
    const full = (res.data || []).find((c: any) => c.id === consumableId)
    setEditItem(full || fallback)
  }

  const addStock = async (consumableId: string) => {
    const raw = stockDraft[consumableId]
    const qty = Math.floor(Number(raw))
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

  if (loading) {
    return (
      <div className={styles.wrap}>
        <div className={styles.title}>미입고(가출고) 대기</div>
        <p className={styles.empty}>불러오는 중…</p>
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className={styles.wrap}>
        <div className={styles.title}>미입고(가출고) 대기</div>
        <p className={styles.empty}>
          {hint.includes('stock_status')
            ? 'SQL(service_parts_stock_status.sql) 실행 후 사용 가능합니다.'
            : '대기 중인 미입고 사용이 없습니다.'}
        </p>
      </div>
    )
  }

  // 소모품별 그룹
  const groups = new Map<
    string,
    {
      name: string
      stock: number
      code: string
      category: string
      color: string
      regenerated: boolean
      consumable: any
      items: any[]
    }
  >()
  for (const row of rows) {
    const id = row.consumable_id
    if (!groups.has(id)) {
      const c = row.consumable || {}
      groups.set(id, {
        name: c.model_name || id,
        stock: Number(c.current_stock) || 0,
        code: c.code || '',
        category: c.category || '',
        color: c.color || '',
        regenerated: Boolean(c.is_regenerated),
        consumable: c,
        items: [],
      })
    }
    groups.get(id)!.items.push(row)
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <div className={styles.title}>미입고(가출고) 대기 · {rows.length}건</div>
        <button type="button" className={styles.refresh} onClick={load}>새로고침</button>
      </div>
      <p className={styles.desc}>
        서비스 일지에서 재고 없이 사용한 항목입니다.
        아래에서 <strong>어떤 소모품인지 확인</strong>하고 재고를 입고한 뒤 <strong>입고 확정</strong>하면 차감·연결됩니다.
      </p>

      {Array.from(groups.entries()).map(([consumableId, group]) => {
        const need = group.items.reduce((s, r) => s + Number(r.quantity), 0)
        const canConfirm = group.stock >= need
        const metaBits = [
          group.category,
          group.color ? `색상 ${group.color}` : '',
          group.regenerated ? '재생' : '',
          group.code ? `코드 ${group.code}` : '',
        ].filter(Boolean)

        return (
          <div key={consumableId} className={styles.group}>
            <div className={styles.groupHead}>
              <div>
                <div className={styles.groupName}>{group.name}</div>
                <div className={styles.meta}>
                  {metaBits.length > 0 ? `${metaBits.join(' · ')} · ` : ''}
                  대기 {need} · 현재 재고 {group.stock}
                  {!canConfirm && <span className={styles.warn}> · 재고 부족</span>}
                </div>
              </div>
              <div className={styles.groupActions}>
                <button
                  type="button"
                  className={styles.linkBtn}
                  onClick={() =>
                    void openEdit(consumableId, {
                      ...group.consumable,
                      id: consumableId,
                      model_name: group.name,
                      current_stock: group.stock,
                      code: group.code,
                      category: group.category || '토너',
                      color: group.color || '',
                      is_regenerated: group.regenerated,
                      compatible_models: [],
                    })
                  }
                >
                  품목 수정
                </button>
                <button
                  type="button"
                  className={styles.confirmBtn}
                  disabled={!canConfirm || busyId === consumableId}
                  onClick={() => confirmAllForConsumable(consumableId, group.name)}
                >
                  {busyId === consumableId ? '처리 중…' : '일괄 확정'}
                </button>
              </div>
            </div>

            <div className={styles.stockRow}>
              <label className={styles.stockLabel}>재고 입고</label>
              <input
                className={styles.stockInput}
                type="number"
                min={1}
                placeholder="수량"
                value={stockDraft[consumableId] ?? ''}
                onChange={(e) =>
                  setStockDraft((prev) => ({ ...prev, [consumableId]: e.target.value }))
                }
              />
              <button
                type="button"
                className={styles.stockBtn}
                disabled={busyId === `stock-${consumableId}`}
                onClick={() => void addStock(consumableId)}
              >
                {busyId === `stock-${consumableId}` ? '입고 중…' : '입고 반영'}
              </button>
            </div>

            <ul className={styles.list}>
              {group.items.map((row) => {
                const inv = row.service_log?.inventory
                const invLabel = inv
                  ? [inv.model_name, inv.department ? `(${inv.department})` : '', inv.serial_number]
                      .filter(Boolean)
                      .join(' ')
                  : ''
                return (
                  <li key={row.id} className={styles.item}>
                    <span>
                      {row.service_log?.client?.name || '거래처'}
                      {invLabel ? ` · ${invLabel}` : ''}
                      {row.service_log?.visit_date ? ` · ${row.service_log.visit_date}` : ''}
                      {' · '}
                      {row.quantity}개
                    </span>
                    <button
                      type="button"
                      className={styles.smallBtn}
                      disabled={
                        busyId === row.id ||
                        (Number(row.consumable?.current_stock) || 0) < Number(row.quantity)
                      }
                      onClick={() => confirmOne(row.id)}
                    >
                      확정
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}

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
    </div>
  )
}
