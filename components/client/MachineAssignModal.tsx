'use client'

import { useEffect, useState } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import InputField from '@/components/ui/Input'
import { toast } from '@/components/ui/Toast'
import { useSingleFlight } from '@/hooks/useSingleFlight'
import { assignMachineToClientAction, getAssignableMachinesAction } from '@/app/actions/inventory'
import type { Inventory } from '@/app/types'

type Props = {
  clientId: string
  clientName: string
  onClose: () => void
  onSuccess: () => void
}

/** 창고에 있는 기기를 이 거래처에 설치한다 (새로 등록하지 않음) */
export default function MachineAssignModal({ clientId, clientName, onClose, onSuccess }: Props) {
  const runOnce = useSingleFlight()
  const [items, setItems] = useState<Inventory[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({
    inventory_id: '',
    bw: 0,
    col: 0,
    bw_a3: 0,
    col_a3: 0,
    contract_start_date: new Date().toISOString().split('T')[0],
    contract_end_date: '',
    memo: '',
  })

  useEffect(() => {
    const load = async () => {
      const res = await getAssignableMachinesAction()
      if (res.success) setItems(res.data as Inventory[])
      else toast.error(res.message || '기기 목록을 불러오지 못했습니다.')
      setLoading(false)
    }
    void load()
  }, [])

  const pick = (id: string) => {
    const item = items.find((i) => i.id === id)
    setForm((prev) => ({
      ...prev,
      inventory_id: id,
      bw: item?.initial_count_bw || 0,
      col: item?.initial_count_col || 0,
      bw_a3: item?.initial_count_bw_a3 || 0,
      col_a3: item?.initial_count_col_a3 || 0,
    }))
  }

  const submit = () => runOnce('assign-machine', async () => {
    if (!form.inventory_id) {
      toast.error('설치할 기기를 선택해 주세요.')
      return
    }
    const res = await assignMachineToClientAction(form.inventory_id, clientId, {
      initial_counts: { bw: form.bw, col: form.col, bw_a3: form.bw_a3, col_a3: form.col_a3 },
      contract: { start_date: form.contract_start_date, end_date: form.contract_end_date },
      memo: form.memo.trim(),
    })
    if (!res.success) {
      toast.error(res.message)
      return
    }
    toast(res.message)
    onSuccess()
    onClose()
  })

  return (
    <Modal
      open
      onClose={onClose}
      title={`창고 기기 가져오기 — ${clientName}`}
      size="md"
      footer={
        <>
          <Button variant="danger" onClick={onClose}>취소</Button>
          <Button variant="primary" onClick={submit} disabled={loading}>설치</Button>
        </>
      }
    >
      <InputField
        label="설치할 기기"
        as="select"
        value={form.inventory_id}
        onChange={(e) => pick(e.target.value)}
        hint={loading ? '불러오는 중…' : `설치 가능한 기기 ${items.length}대 (창고 · 거래처 연결이 없는 기기)`}
      >
        <option value="">기기 선택</option>
        {items.map((i) => (
          <option key={i.id} value={i.id}>
            {i.model_name} ({i.serial_number}){i.status !== '창고' ? ` · ${i.status}` : ''}
          </option>
        ))}
      </InputField>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(7rem, 1fr))', gap: 'var(--sp-3)' }}>
        <InputField label="시작 카운터 흑백" type="number" value={form.bw} onChange={(e) => setForm({ ...form, bw: Number(e.target.value) })} />
        <InputField label="시작 카운터 컬러" type="number" value={form.col} onChange={(e) => setForm({ ...form, col: Number(e.target.value) })} />
        <InputField label="흑백 A3" type="number" value={form.bw_a3} onChange={(e) => setForm({ ...form, bw_a3: Number(e.target.value) })} />
        <InputField label="컬러 A3" type="number" value={form.col_a3} onChange={(e) => setForm({ ...form, col_a3: Number(e.target.value) })} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(9rem, 1fr))', gap: 'var(--sp-3)' }}>
        <InputField label="계약 시작일" type="date" value={form.contract_start_date} onChange={(e) => setForm({ ...form, contract_start_date: e.target.value })} />
        <InputField label="계약 종료일" type="date" value={form.contract_end_date} onChange={(e) => setForm({ ...form, contract_end_date: e.target.value })} />
      </div>

      <InputField
        label="메모"
        value={form.memo}
        onChange={(e) => setForm({ ...form, memo: e.target.value })}
        placeholder="예: 기존 기기 철수 후 재설치"
        hint="요금제는 설치 후 [요금제] 버튼에서 정합니다."
      />
    </Modal>
  )
}
