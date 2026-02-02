'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase'
import Button from '@/components/ui/Button'
import InputField from '@/components/ui/Input'
import { Inventory } from '@/app/types'

interface Props {
  asset: Inventory
  clientId: string
  onClose: () => void
  onSuccess: () => void
}

export default function MachineWithdrawModal({ asset, clientId, onClose, onSuccess }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    final_bw: 0,
    final_col: 0,
    final_bw_a3: 0,
    final_col_a3: 0,
    memo: ''
  })

  const handleWithdraw = async () => {
    if (!confirm(`'${asset.model_name}' 기기를 철수 처리하시겠습니까?`)) return
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user?.id).single()

      // 1. 기계 회수 이력 기록
      await supabase.from('machine_history').insert({
        inventory_id: asset.id,
        client_id: clientId,
        organization_id: profile?.organization_id,
        action_type: 'WITHDRAW',
        bw_count: formData.final_bw,
        col_count: formData.final_col,
        bw_a3_count: formData.final_bw_a3,
        col_a3_count: formData.final_col_a3,
        memo: `단독 철수: ${formData.memo}`
      })

      // 2. 기계 상태 변경 (거래처 해제 및 창고행)
      const { error } = await supabase.from('inventory').update({
        status: '창고',
        client_id: null,
      }).eq('id', asset.id)

      if (error) throw error

      alert('철수 처리가 완료되었습니다.')
      onSuccess()
      onClose()
    } catch (e) {
      const message = e instanceof Error ? e.message : (e as { message?: string })?.message || String(e)
      alert('오류 발생: ' + message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100 }}>
      <div style={{ backgroundColor: 'var(--notion-bg)', padding: '32px', borderRadius: '12px', width: '500px' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '20px' }}>📤 기기 철수 처리</h2>
        <div style={{ padding: '12px', backgroundColor: 'var(--notion-soft-bg)', borderRadius: '8px', marginBottom: '20px', fontSize: '0.9rem' }}>
          기기: <strong>{asset.model_name} ({asset.serial_number})</strong>
        </div>
        
        <div style={{ marginBottom: '20px' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--notion-sub-text)', marginBottom: '8px' }}>회수 시점 최종 카운터 입력 (정산용)</p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <InputField label="최종 흑백" type="number" value={formData.final_bw} onChange={e => setFormData({ ...formData, final_bw: Number(e.target.value) })} />
            <InputField label="최종 컬러" type="number" value={formData.final_col} onChange={e => setFormData({ ...formData, final_col: Number(e.target.value) })} />
          </div>
        </div>

        <InputField label="철수 사유 및 비고" as="textarea" value={formData.memo} onChange={e => setFormData({ ...formData, memo: e.target.value })} style={{ height: '60px' }} />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '24px' }}>
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button variant="danger" onClick={handleWithdraw} disabled={loading}>{loading ? '처리 중...' : '철수 확정'}</Button>
        </div>
      </div>
    </div>
  )
}