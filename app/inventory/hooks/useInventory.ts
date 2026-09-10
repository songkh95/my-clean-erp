'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@/utils/supabase'
import { Inventory } from '@/app/types'
import { deleteInventoryAction } from '@/app/actions/inventory'

export function useInventory() {
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<Inventory[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  const fetchInventory = useCallback(async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
      if (!profile?.organization_id) return

      const { data } = await supabase
        .from('inventory')
        .select(`*, client:client_id (name)`)
        .eq('organization_id', profile.organization_id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })

      if (data) setItems(data as Inventory[])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchInventory()
  }, [fetchInventory])

  const toggleExpand = (id: string) => {
    const newSet = new Set(expandedRows)
    if (newSet.has(id)) newSet.delete(id)
    else newSet.add(id)
    setExpandedRows(newSet)
  }

  const deleteInventory = async (id: string) => {
    if (!confirm('삭제하면 휴지통으로 이동합니다. 계속할까요? (거래처에 설치된 기기는 삭제할 수 없습니다 — 먼저 철수해 주세요)')) return

    try {
      const result = await deleteInventoryAction(id)
      if (result.success) {
        alert(result.message) // "휴지통으로 이동되었습니다." — 설정 > 휴지통에서 복구·완전삭제 가능
        fetchInventory()
      } else {
        throw new Error(result.message)
      }
    } catch (e: any) {
      alert('삭제 실패: ' + e.message)
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
