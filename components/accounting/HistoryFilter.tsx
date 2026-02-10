'use client'

import React, { useRef, useEffect } from 'react'
import { Client } from '@/app/types'

interface Props {
  searchTerm: string
  setSearchTerm: (term: string) => void
  showSuggestions: boolean
  setShowSuggestions: (show: boolean) => void
  filteredClients: Client[]
  onSelectClient: (client: Client) => void
  onSearchTrigger: () => void
  
  startMonth: string
  setStartMonth: (month: string) => void
  endMonth: string
  setEndMonth: (month: string) => void
  
  viewMode: 'all' | 'machine'
  setViewMode: (mode: 'all' | 'machine') => void
  
  isEditMode: boolean
  onToggleEditMode: () => void // ✅ 변경: 단순 setter 대신 핸들러 함수 받음
  hasChanges: boolean
  onSave: () => void
  
  totalCount: number
}

export default function HistoryFilter({
  searchTerm, setSearchTerm, showSuggestions, setShowSuggestions, filteredClients, onSelectClient, onSearchTrigger,
  startMonth, setStartMonth, endMonth, setEndMonth,
  viewMode, setViewMode,
  isEditMode, onToggleEditMode, hasChanges, onSave, totalCount
}: Props) {
  const searchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [setShowSuggestions])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      onSearchTrigger()
    }
  }

  // 공통 라벨 스타일
  const labelStyle = { display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#666', marginBottom: '2px' }
  // 공통 인풋 스타일
  const inputStyle = { padding: '6px 8px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '0.85rem', height: '32px', boxSizing: 'border-box' as const }

  return (
    <div style={{ 
      backgroundColor: '#fff', 
      padding: '12px 16px', 
      borderRadius: '8px', 
      border: '1px solid #e5e5e5', 
      marginBottom: '16px', 
      display: 'flex', 
      gap: '12px', 
      alignItems: 'flex-end', 
      flexWrap: 'wrap', 
      boxShadow: '0 1px 3px rgba(0,0,0,0.02)' 
    }}>
      
      {/* 1. 거래처 검색 */}
      <div style={{ position: 'relative', width: '240px' }} ref={searchRef}>
        <label style={labelStyle}>거래처 검색</label>
        <div style={{ display: 'flex', gap: '4px' }}>
          <input
            type="text"
            placeholder="거래처명..."
            value={searchTerm}
            onKeyDown={handleKeyDown}
            onChange={(e) => { setSearchTerm(e.target.value); setShowSuggestions(true); }}
            onFocus={() => setShowSuggestions(true)}
            style={{ ...inputStyle, width: '100%' }}
          />
          <button 
            onClick={onSearchTrigger}
            style={{ 
              padding: '0 10px', 
              backgroundColor: '#0070f3', 
              color: 'white', 
              border: 'none', 
              borderRadius: '6px', 
              fontWeight: '600', 
              fontSize: '0.8rem',
              cursor: 'pointer', 
              whiteSpace: 'nowrap',
              height: '32px'
            }}
          >
            조회
          </button>
        </div>
        {showSuggestions && filteredClients.length > 0 && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: 'white', border: '1px solid #ccc', borderRadius: '6px', maxHeight: '200px', overflowY: 'auto', zIndex: 1000, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', marginTop: '2px' }}>
            {filteredClients.map(client => (
              <div
                key={client.id}
                onClick={() => onSelectClient(client)}
                style={{ padding: '8px 10px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0', fontSize: '0.85rem' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9f9f9'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
              >
                <div style={{ fontWeight: '600', color: '#333' }}>{client.name}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. 기간 설정 */}
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        <div>
          <label style={labelStyle}>시작월</label>
          <input type="month" value={startMonth} onChange={(e) => setStartMonth(e.target.value)} style={{ ...inputStyle, width: '110px' }} />
        </div>
        <span style={{ paddingTop: '18px', color: '#999', fontSize: '0.8rem' }}>~</span>
        <div>
          <label style={labelStyle}>종료월</label>
          <input type="month" value={endMonth} onChange={(e) => setEndMonth(e.target.value)} style={{ ...inputStyle, width: '110px' }} />
        </div>
      </div>

      {/* 3. 보기 방식 */}
      <div>
        <label style={labelStyle}>보기 방식</label>
        <div style={{ display: 'flex', border: '1px solid #ccc', borderRadius: '6px', overflow: 'hidden', height: '32px' }}>
          <button 
            onClick={() => setViewMode('all')} 
            style={{ 
              padding: '0 12px', 
              backgroundColor: viewMode === 'all' ? '#0070f3' : '#fff', 
              color: viewMode === 'all' ? '#fff' : '#333', 
              border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '500' 
            }}
          >
            전체
          </button>
          <button 
            onClick={() => setViewMode('machine')} 
            style={{ 
              padding: '0 12px', 
              backgroundColor: viewMode === 'machine' ? '#0070f3' : '#fff', 
              color: viewMode === 'machine' ? '#fff' : '#333', 
              border: 'none', cursor: 'pointer', borderLeft: '1px solid #ccc', fontSize: '0.8rem', fontWeight: '500' 
            }}
          >
            기계별
          </button>
        </div>
      </div>

      {/* 4. 우측 버튼 영역 (조회 건수, 수정, 저장) */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', height: '32px' }}>
        {totalCount > 0 && (
           <span style={{ fontSize: '0.8rem', color: '#666', marginRight: '4px', whiteSpace: 'nowrap' }}>
             건수: <b>{totalCount}</b>
           </span>
        )}
        
        {/* ✅ 수정 버튼: 토글 핸들러 연결 및 텍스트 변경 */}
        <button 
            onClick={onToggleEditMode}
            style={{ 
                padding: '0 12px', 
                height: '32px',
                backgroundColor: isEditMode ? '#666' : '#fff', 
                color: isEditMode ? '#fff' : '#0070f3',
                border: `1px solid ${isEditMode ? '#666' : '#0070f3'}`,
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: '600',
                whiteSpace: 'nowrap'
            }}
        >
            {isEditMode ? '수정 취소' : '✏️ 수정'}
        </button>

        {hasChanges && (
            <button 
              onClick={onSave} 
              style={{ 
                padding: '0 16px', 
                height: '32px',
                backgroundColor: '#d93025', 
                color: 'white', 
                border: 'none', 
                borderRadius: '6px', 
                fontWeight: '600', 
                fontSize: '0.8rem',
                cursor: 'pointer', 
                boxShadow: '0 2px 4px rgba(217,48,37,0.2)',
                whiteSpace: 'nowrap'
              }}
            >
              💾 저장
            </button>
        )}
      </div>
    </div>
  )
}