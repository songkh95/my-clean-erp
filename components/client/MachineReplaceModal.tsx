'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase'
import Button from '@/components/ui/Button'
import InputField from '@/components/ui/Input'
import { Inventory } from '@/app/types'
// ✅ Server Action 임포트
import { replaceInventoryAction } from '@/app/actions/inventory'

interface Props {
  oldAsset: Inventory
  clientId: string
  onClose: () => void
  onSuccess: () => void
}

export default function MachineReplaceModal({ oldAsset, clientId, onClose, onSuccess }: Props) {
  // 창고 목록 조회용 (읽기 전용이라 클라이언트 사용 OK)
  const supabase = createClient()
  
  const [loading, setLoading] = useState(false)
  const [warehouseItems, setWarehouseItems] = useState<Inventory[]>([])
  
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

  const fetchWarehouseItems = async () => {
    const { data } = await supabase
      .from('inventory')
      .select('*')
      .eq('status', '창고')
    if (data) setWarehouseItems(data as Inventory[])
  }

  const handleReplace = async () => {
    if (!formData.new_asset_id) return alert('교체할 새 기계를 선택해주세요.')

    // 1. 요금제 승계 여부 질문
    const inheritPlan = confirm(
      "새로운 기계에 기존 기계의 요금제 정보를 동일하게 적용하시겠습니까?\n\n" +
      "• [확인]: 기본료, 무료매수, 단가, 합산그룹 등을 그대로 복사합니다.\n" +
      "• [취소]: 요금제 정보를 초기화 상태(0원)로 둡니다."
    );

    if (!confirm('정말 교체 처리를 진행하시겠습니까? (되돌릴 수 없습니다)')) return

    setLoading(true)

    try {
      // ✅ Server Action 호출
      const result = await replaceInventoryAction(
        clientId,
        oldAsset.id,
        formData.new_asset_id,
        {
          final_counts: {
            bw: formData.final_bw,
            col: formData.final_col,
            bw_a3: formData.final_bw_a3,
            col_a3: formData.final_col_a3
          },
          new_initial_counts: {
            bw: formData.new_initial_bw,
            col: formData.new_initial_col,
            bw_a3: formData.new_initial_bw_a3,
            col_a3: formData.new_initial_col_a3
          },
          memo: formData.memo,
          inheritPlan: inheritPlan
        }
      )

      if (result.success) {
        alert(result.message)
        onSuccess()
        onClose()
      } else {
        throw new Error(result.message)
      }

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
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <InputField label="최종 흑백(A4)" type="number" value={formData.final_bw} onChange={e => setFormData({ ...formData, final_bw: Number(e.target.value) })} />
            <InputField label="최종 컬러(A4)" type="number" value={formData.final_col} onChange={e => setFormData({ ...formData, final_col: Number(e.target.value) })} />
            <InputField label="최종 흑백(A3)" type="number" value={formData.final_bw_a3} onChange={e => setFormData({ ...formData, final_bw_a3: Number(e.target.value) })} />
            <InputField label="최종 컬러(A3)" type="number" value={formData.final_col_a3} onChange={e => setFormData({ ...formData, final_col_a3: Number(e.target.value) })} />
          </div>
        </div>

        {/* 새 기계 섹션 */}
        <div style={{ padding: '16px', backgroundColor: '#e6f7ff', borderRadius: '8px', marginBottom: '20px', border: '1px solid #91d5ff' }}>
          <div style={{ fontWeight: '600', marginBottom: '10px', color: '#0050b3' }}>[새 기계 설치]</div>
          <InputField label="교체할 기계 선택" as="select" value={formData.new_asset_id} onChange={e => setFormData({ ...formData, new_asset_id: e.target.value })} style={{marginBottom: '16px'}}>
            <option value="">창고 내 기계 선택...</option>
            {warehouseItems.map(item => (
              <option key={item.id} value={item.id}>{item.brand} {item.model_name} ({item.serial_number})</option>
            ))}
          </InputField>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <InputField label="설치 흑백(A4)" type="number" value={formData.new_initial_bw} onChange={e => setFormData({ ...formData, new_initial_bw: Number(e.target.value) })} />
            <InputField label="설치 컬러(A4)" type="number" value={formData.new_initial_col} onChange={e => setFormData({ ...formData, new_initial_col: Number(e.target.value) })} />
            <InputField label="설치 흑백(A3)" type="number" value={formData.new_initial_bw_a3} onChange={e => setFormData({ ...formData, new_initial_bw_a3: Number(e.target.value) })} />
            <InputField label="설치 컬러(A3)" type="number" value={formData.new_initial_col_a3} onChange={e => setFormData({ ...formData, new_initial_col_a3: Number(e.target.value) })} />
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