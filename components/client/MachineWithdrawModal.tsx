// components/client/MachineWithdrawModal.tsx
'use client'

import { useState } from 'react'
import Button from '@/components/ui/Button'
import InputField from '@/components/ui/Input'
import { Inventory } from '@/app/types'
// ✅ Server Action 임포트
import { withdrawInventoryAction } from '@/app/actions/inventory'

interface Props {
  asset: Inventory
  clientId: string
  onClose: () => void
  onSuccess: () => void
}

export default function MachineWithdrawModal({ asset, clientId, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false)
  
  // 사용자 입력 상태 관리
  const [formData, setFormData] = useState({
    final_bw: 0,
    final_col: 0,
    final_bw_a3: 0,
    final_col_a3: 0,
    memo: ''
  })

  const handleWithdraw = async () => {
    if (!confirm(`'${asset.model_name}' 기기를 정말로 철수 처리하시겠습니까?\n(상태가 '창고'로 변경됩니다)`)) return
    
    setLoading(true)

    try {
      // ✅ 서버 액션 호출 (복잡한 로직은 서버에서 수행)
      const result = await withdrawInventoryAction(
        asset.id,
        clientId,
        {
          bw: formData.final_bw,
          col: formData.final_col,
          bw_a3: formData.final_bw_a3,
          col_a3: formData.final_col_a3
        },
        formData.memo
      )

      if (result.success) {
        alert(result.message)
        onSuccess() // 상위 컴포넌트 목록 새로고침
        onClose()   // 모달 닫기
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
    <div style={{ 
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
      backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100 
    }}>
      <div style={{ 
        backgroundColor: 'var(--notion-bg)', padding: '32px', borderRadius: '12px', width: '500px', 
        boxShadow: '0 15px 50px rgba(0,0,0,0.1)' 
      }}>
        
        <h2 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '20px', color: 'var(--notion-main-text)' }}>
          📤 기기 철수 처리
        </h2>
        
        <div style={{ padding: '12px', backgroundColor: 'var(--notion-soft-bg)', borderRadius: '8px', marginBottom: '20px', fontSize: '0.9rem', border: '1px solid var(--notion-border)' }}>
          기기: <strong style={{color: 'var(--notion-blue)'}}>{asset.model_name}</strong> <span style={{color: 'var(--notion-sub-text)'}}>({asset.serial_number})</span>
        </div>
        
        <div style={{ marginBottom: '20px' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--notion-sub-text)', marginBottom: '8px', fontWeight: '600' }}>
            🏁 회수 시점 최종 카운터 (정산용)
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
            <InputField label="최종 흑백(A4)" type="number" value={formData.final_bw} onChange={e => setFormData({ ...formData, final_bw: Number(e.target.value) })} />
            <InputField label="최종 컬러(A4)" type="number" value={formData.final_col} onChange={e => setFormData({ ...formData, final_col: Number(e.target.value) })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <InputField label="최종 흑백(A3)" type="number" value={formData.final_bw_a3} onChange={e => setFormData({ ...formData, final_bw_a3: Number(e.target.value) })} />
            <InputField label="최종 컬러(A3)" type="number" value={formData.final_col_a3} onChange={e => setFormData({ ...formData, final_col_a3: Number(e.target.value) })} />
          </div>
        </div>

        <InputField 
          label="철수 사유 및 비고" 
          as="textarea" 
          value={formData.memo} 
          onChange={e => setFormData({ ...formData, memo: e.target.value })} 
          style={{ height: '80px' }} 
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '24px', borderTop: '1px solid var(--notion-border)', paddingTop: '20px' }}>
          <Button variant="danger" onClick={onClose}>취소</Button>
          <Button variant="danger" onClick={handleWithdraw} disabled={loading}>
            {loading ? '처리 중...' : '철수 확정'}
          </Button>
        </div>
      </div>
    </div>
  )
}