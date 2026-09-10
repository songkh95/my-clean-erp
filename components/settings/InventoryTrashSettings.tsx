'use client'

import { useEffect, useState } from 'react'
import Button from '@/components/ui/Button'
import {
  getTrashedInventoryAction,
  purgeInventoryAction,
  restoreInventoryAction,
} from '@/app/actions/inventory'
import styles from '@/app/settings/settings.module.css'

type TrashedItem = {
  id: string
  type: string
  category: string
  brand: string | null
  model_name: string
  serial_number: string
  status: string
  deleted_at: string | null
  service_log_count: number
  settlement_count: number
  history_count: number
}

export default function InventoryTrashSettings() {
  const [items, setItems] = useState<TrashedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    const res = await getTrashedInventoryAction()
    setLoading(false)
    if (!res.success) {
      setError(res.message || '휴지통 조회 실패')
      return
    }
    setItems((res.data || []) as TrashedItem[])
  }

  useEffect(() => {
    ;(async () => {
      await load()
    })()
  }, [])

  const handleRestore = async (item: TrashedItem) => {
    if (!confirm(`「${item.model_name} (${item.serial_number})」을(를) 복구할까요?`)) return
    setBusyId(item.id)
    const res = await restoreInventoryAction(item.id)
    setBusyId(null)
    alert(res.message)
    if (res.success) load()
  }

  const handlePurge = async (item: TrashedItem) => {
    const confirmMsg =
      `「${item.model_name} (${item.serial_number})」을(를) 영구적으로 삭제합니다.\n되돌릴 수 없습니다.` +
      (item.history_count > 0
        ? `\n\n연결된 설치·철수 이력 ${item.history_count}건도 함께 사라집니다.`
        : '')
    if (!confirm(confirmMsg)) return

    setBusyId(item.id)
    const res = await purgeInventoryAction(item.id)
    setBusyId(null)
    alert(res.message)
    if (res.success) load()
  }

  return (
    <div className={styles.card}>
      <h2 className={styles.cardTitle}>휴지통 (삭제된 자산)</h2>
      <p className={styles.cardDesc}>
        자산·재고 페이지에서 삭제한 기기가 여기 보관됩니다. 완전 삭제 전까지는 서비스 일지·정산·설치 이력이 모두
        그대로 유지됩니다.
      </p>

      {loading ? (
        <p className={styles.hint}>불러오는 중…</p>
      ) : error ? (
        <p className={styles.hint} style={{ color: '#b91c1c' }}>{error}</p>
      ) : items.length === 0 ? (
        <p className={styles.hint}>휴지통이 비어 있습니다.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>모델명</th>
                <th>S/N</th>
                <th>종류 / 구분</th>
                <th>삭제일</th>
                <th>서비스 일지</th>
                <th>정산</th>
                <th>설치 이력</th>
                <th>작업</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.model_name}</td>
                  <td>{item.serial_number}</td>
                  <td>{item.type} / {item.category}</td>
                  <td>{item.deleted_at ? new Date(item.deleted_at).toLocaleDateString() : '-'}</td>
                  <td>{item.service_log_count}건</td>
                  <td>{item.settlement_count}건</td>
                  <td>{item.history_count}건</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busyId === item.id}
                      onClick={() => handleRestore(item)}
                      style={{ marginRight: 6 }}
                    >
                      복구
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="danger"
                      disabled={busyId === item.id}
                      onClick={() => handlePurge(item)}
                    >
                      완전 삭제
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
