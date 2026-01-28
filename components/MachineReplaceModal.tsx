'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase'
import Button from './ui/Button'
import InputField from './ui/Input'

interface Props {
  oldAsset: any         // 회수할 기계 정보
  clientId: string      // 거래처 ID
  onClose: () => void   // 닫기 함수
  onSuccess: () => void // 성공 시 콜백
}

export default function MachineReplaceModal({ oldAsset, clientId, onClose, onSuccess }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [warehouseItems, setWarehouseItems] = useState<any[]>([])
  
  // 폼 데이터 상태
  const [formData, setFormData] = useState({
    // 기존 기계 회수 정보
    final_bw: 0,
    final_col: 0,
    final_bw_a3: 0,
    final_col_a3: 0,
    // 새 기계 설치 정보
    new_asset_id: '',
    new_initial_bw: 0,
    new_initial_col: 0,
    new_initial_bw_a3: 0,
    new_initial_col_a3: 0,
    memo: ''
  })

  useEffect(() => {
    fetchWarehouseItems()
  }, [])

  // 창고에 있는(설치 가능한) 기계 목록 불러오기
  const fetchWarehouseItems = async () => {
    const { data } = await supabase
      .from('inventory')
      .select('id, model_name, serial_number, brand')
      .eq('status', '창고')
    if (data) setWarehouseItems(data)
  }

  const handleReplace = async () => {
    if (!formData.new_asset_id) return alert('교체할 새 기계를 선택해주세요.')
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user?.id).single()
      const orgId = profile?.organization_id

      // 1. 기존 기계 회수 이력 기록 (machine_history)
      await supabase.from('machine_history').insert({
        inventory_id: oldAsset.id,
        client_id: clientId,
        organization_id: orgId,
        action_type: 'WITHDRAW',
        bw_count: formData.final_bw,
        col_count: formData.final_col,
        bw_a3_count: formData.final_bw_a3,
        col_a3_count: formData.final_col_a3,
        memo: `교체로 인한 회수: ${formData.memo}`
      })

      // 2. 기존 기계 상태 변경 (설치 -> 창고)
      await supabase.from('inventory').update({
        status: '창고',
        client_id: null,
        last_status_updated_at: new Date().toISOString()
      }).eq('id', oldAsset.id)

      // 3. 새 기계 상태 변경 (창고 -> 설치) 및 초기 카운터 설정
      await supabase.from('inventory').update({
        status: '설치',
        client_id: clientId,
        initial_count_bw: formData.new_initial_bw,
        initial_count_col: formData.new_initial_col,
        initial_count_bw_a3: formData.new_initial_bw_a3,
        initial_count_col_a3: formData.new_initial_col_a3,
        last_status_updated_at: new Date().toISOString()
      }).eq('id', formData.new_asset_id)

      // 4. 새 기계 설치 이력 기록 (machine_history)
      await supabase.from('machine_history').insert({
        inventory_id: formData.new_asset_id,
        client_id: clientId,
        organization_id: orgId,
        action_type: 'INSTALL',
        bw_count: formData.new_initial_bw,
        col_count: formData.new_initial_col,
        bw_a3_count: formData.new_initial_bw_a3,
        col_a3_count: formData.new_initial_col_a3,
        memo: `교체로 인한 설치`
      })

      alert('기계 교체 처리가 완료되었습니다.')
      onSuccess()
      onClose()
    } catch (e: any) {
      alert('오류 발생: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
      <div style={{ backgroundColor: 'var(--notion-bg)', padding: '32px', borderRadius: '12px', width: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '20px' }}>🔄 기계 교체 프로세스</h2>

        {/* 기존 기계 섹션 */}
        <div style={{ padding: '16px', backgroundColor: '#fff1f0', borderRadius: '8px', marginBottom: '20px', border: '1px solid #ffa39e' }}>
          <div style={{ fontWeight: '600', marginBottom: '10px', color: '#cf1322' }}>[기존 기계 회수] {oldAsset.model_name} ({oldAsset.serial_number})</div>
          <div style={{ fontSize: '0.85rem', marginBottom: '12px', color: '#666' }}>회수 시점의 최종 카운터를 입력하세요. (정산 근거가 됩니다)</div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <InputField label="최종 흑백" type="number" value={formData.final_bw} onChange={e => setFormData({ ...formData, final_bw: Number(e.target.value) })} />
            <InputField label="최종 컬러" type="number" value={formData.final_col} onChange={e => setFormData({ ...formData, final_col: Number(e.target.value) })} />
          </div>
        </div>

        {/* 새 기계 섹션 */}
        <div style={{ padding: '16px', backgroundColor: '#e6f7ff', borderRadius: '8px', marginBottom: '20px', border: '1px solid #91d5ff' }}>
          <div style={{ fontWeight: '600', marginBottom: '10px', color: '#0050b3' }}>[새 기계 설치]</div>
          <InputField label="교체할 기계 선택" as="select" value={formData.new_asset_id} onChange={e => setFormData({ ...formData, new_asset_id: e.target.value })}>
            <option value="">창고 내 기계 선택...</option>
            {warehouseItems.map(item => (
              <option key={item.id} value={item.id}>{item.brand} {item.model_name} ({item.serial_number})</option>
            ))}
          </InputField>
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <InputField label="설치 흑백" type="number" value={formData.new_initial_bw} onChange={e => setFormData({ ...formData, new_initial_bw: Number(e.target.value) })} />
            <InputField label="설치 컬러" type="number" value={formData.new_initial_col} onChange={e => setFormData({ ...formData, new_initial_col: Number(e.target.value) })} />
          </div>
        </div>

        <InputField label="교체 사유 및 메모" as="textarea" value={formData.memo} onChange={e => setFormData({ ...formData, memo: e.target.value })} style={{ height: '60px' }} />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '24px' }}>
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button variant="primary" onClick={handleReplace} disabled={loading}>{loading ? '처리 중...' : '교체 확정'}</Button>
        </div>
      </div>
    </div>
  )
}