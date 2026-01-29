'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase'

interface Props {
  isOpen: boolean
  onClose: () => void
  onAdd: (client: any, asset: any) => void
  existingIds: Set<string>
}

export default function ManualBillingModal({ isOpen, onClose, onAdd, existingIds }: Props) {
  const supabase = createClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setSearchTerm('')
      setSearchResults([])
      fetchAvailableAssets()
    }
  }, [isOpen])

  const fetchAvailableAssets = async (term: string = '') => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user?.id).single()
    
    // ✅ [핵심] status가 '설치'인 기계만 조회 (창고, 폐기 제외)
    let query = supabase
      .from('inventory')
      .select('*, client:client_id(id, name)')
      .eq('organization_id', profile?.organization_id)
      .eq('status', '설치') // 👈 설치된 기계만 필터링
      .not('client_id', 'is', null)
      
    if (term) {
      query = query.or(`model_name.ilike.%${term}%,serial_number.ilike.%${term}%,client.name.ilike.%${term}%`)
    }

    const { data } = await query.limit(50)
    
    if (data) {
      const filtered = data.filter((item: any) => !existingIds.has(item.id))
      setSearchResults(filtered)
    }
    setLoading(false)
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchAvailableAssets(searchTerm)
  }

  if (!isOpen) return null

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100
    }}>
      <div style={{
        backgroundColor: 'white', padding: '24px', borderRadius: '12px', width: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
      }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '8px' }}>➕ 거래처 청구 기계 추가</h2>
        <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '16px', backgroundColor: '#f0f7ff', padding: '8px', borderRadius: '6px', border: '1px solid #bae0ff' }}>
          💡 현재 <b>[설치]</b> 상태인 기계 중, 목록에 없는 기계만 검색됩니다.
        </p>
        
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <input 
            autoFocus
            type="text" 
            placeholder="기계명, 시리얼, 거래처명 검색..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ flex: 1, padding: '10px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.95rem' }}
          />
          <button type="submit" style={{ padding: '0 20px', backgroundColor: '#0070f3', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>
            검색
          </button>
        </form>

        <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #eee', borderRadius: '6px', minHeight: '200px' }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>데이터를 불러오는 중...</div>
          ) : searchResults.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
              검색 결과가 없습니다.<br/>
              <span style={{ fontSize: '0.8rem', marginTop: '8px', display: 'block' }}>
                (이미 목록에 있거나, '설치' 상태가 아닌 기계는 표시되지 않습니다)
              </span>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead style={{ backgroundColor: '#f9f9f9', position: 'sticky', top: 0 }}>
                <tr>
                  <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #eee', color: '#555' }}>거래처</th>
                  <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #eee', color: '#555' }}>기계 (모델/SN)</th>
                  <th style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid #eee', color: '#555' }}>상태</th>
                  <th style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid #eee', color: '#555' }}>선택</th>
                </tr>
              </thead>
              <tbody>
                {searchResults.map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '10px' }}>{item.client?.name}</td>
                    <td style={{ padding: '10px' }}>
                      <div style={{ fontWeight: '600', color: '#333' }}>{item.model_name}</div>
                      <div style={{ fontSize: '0.8rem', color: '#888' }}>{item.serial_number}</div>
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      <span style={{ 
                        fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px',
                        backgroundColor: '#f6ffed', color: '#389e0d', border: '1px solid #b7eb8f', fontWeight: '600'
                      }}>
                        {item.status}
                      </span>
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      <button 
                        onClick={() => onAdd(item.client, item)}
                        style={{
                          padding: '6px 12px', backgroundColor: '#fff', border: '1px solid #0070f3',
                          color: '#0070f3', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600'
                        }}
                      >
                        추가
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', backgroundColor: '#f5f5f5', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', color: '#333' }}>
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}