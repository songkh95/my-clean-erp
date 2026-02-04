'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@/utils/supabase'
import { Inventory } from '@/app/types'
// ✅ [추가] 서버 액션 임포트
import { deleteInventoryAction } from '@/app/actions/inventory'

export function useInventory() {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<Inventory[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  const fetchInventory = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
    
    if (profile?.organization_id) {
      const { data } = await supabase
        .from('inventory')
        .select(`*, client:client_id (name)`)
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false })
      
      if (data) setItems(data as Inventory[])
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchInventory() }, [fetchInventory])

  const toggleExpand = (id: string) => {
    const newSet = new Set(expandedRows)
    if (newSet.has(id)) newSet.delete(id)
    else newSet.add(id)
    setExpandedRows(newSet)
  }

  // ✅ [수정] 서버 액션을 사용하도록 변경된 삭제 함수
  const deleteInventory = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까? (주의: 관련 데이터가 있으면 삭제되지 않을 수 있습니다)')) return
    
    try {
      // 기존 클라이언트 직접 호출 방식 (주석 처리됨)
      // const { error } = await supabase.from('inventory').delete().eq('id', id)
      // if (error) throw error

      // ✨ 서버 액션 호출
      const result = await deleteInventoryAction(id)

      if (result.success) {
        alert(result.message)
        fetchInventory() // 목록 새로고침
      } else {
        throw new Error(result.message)
      }
    } catch (e: any) {
      alert('삭제 실패: ' + e.message + '\n(이미 사용 이력이 있는 기계는 삭제 대신 상태를 변경하세요)')
    }
  }

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = 
        item.model_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.serial_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.client?.name && item.client.name.toLowerCase().includes(searchTerm.toLowerCase()))
      const matchesStatus = statusFilter === 'all' ? true : item.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [items, searchTerm, statusFilter])

  return {
    loading, items: filteredItems, searchTerm, setSearchTerm, statusFilter, setStatusFilter,
    expandedRows, toggleExpand, fetchInventory, deleteInventory
  }
}