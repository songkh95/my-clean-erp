'use client'

import React, { useRef, useEffect, useMemo } from 'react'
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
  onToggleEditMode: () => void
  hasChanges: boolean
  onSave: () => void
  
  totalCount: number
}

/** YYYY-MM → { year, month } / 빈 문자열은 전체 */
function parseYm(value: string) {
  if (!value) return { year: '', month: '' }
  const [y, m] = value.split('-')
  return { year: y || '', month: m || '' }
}

function toYm(year: string, month: string) {
  if (!year || !month) return ''
  return `${year}-${month.padStart(2, '0')}`
}

export default function HistoryFilter({
  searchTerm, setSearchTerm, showSuggestions, setShowSuggestions, filteredClients, onSelectClient, onSearchTrigger,
  startMonth, setStartMonth, endMonth, setEndMonth,
  viewMode, setViewMode,
  isEditMode, onToggleEditMode, hasChanges, onSave, totalCount
}: Props) {
  const searchRef = useRef<HTMLDivElement>(null)

  const yearOptions = useMemo(() => {
    const now = new Date().getFullYear()
    const years: number[] = []
    for (let y = now + 1; y >= now - 15; y--) years.push(y)
    return years
  }, [])

  const start = parseYm(startMonth)
  const end = parseYm(endMonth)

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

  const labelStyle = { display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#666', marginBottom: '2px' }
  const inputStyle = { padding: '6px 8px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '0.85rem', height: '32px', boxSizing: 'border-box' as const }
  const selectStyle = { ...inputStyle, backgroundColor: '#fff', cursor: 'pointer' as const }

  const MonthPicker = ({
    label,
    value,
    onChange,
  }: {
    label: string
    value: string
    onChange: (ym: string) => void
  }) => {
    const { year, month } = parseYm(value)

    return (
      <div>
        <label style={labelStyle}>{label}</label>
        <div style={{ display: 'flex', gap: 4 }}>
          <select
            value={year}
            onChange={(e) => {
              const y = e.target.value
              if (!y) {
                onChange('')
                return
              }
              onChange(toYm(y, month || '01'))
            }}
            style={{ ...selectStyle, width: 88 }}
            lang="ko"
          >
            <option value="">전체</option>
            {yearOptions.map((y) => (
              <option key={y} value={String(y)}>{y}년</option>
            ))}
          </select>
          <select
            value={month}
            disabled={!year}
            onChange={(e) => {
              const m = e.target.value
              if (!year || !m) {
                onChange('')
                return
              }
              onChange(toYm(year, m))
            }}
            style={{ ...selectStyle, width: 72, opacity: year ? 1 : 0.55 }}
            lang="ko"
          >
            <option value="">{year ? '월' : '—'}</option>
            {Array.from({ length: 12 }, (_, i) => {
              const m = String(i + 1).padStart(2, '0')
              return (
                <option key={m} value={m}>{i + 1}월</option>
              )
            })}
          </select>
        </div>
      </div>
    )
  }

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
    }}
    lang="ko"
    >
      
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

      {/* 2. 기간 설정 (한글 년/월) */}
      <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-end' }}>
        <MonthPicker label="시작월" value={startMonth} onChange={setStartMonth} />
        <span style={{ paddingBottom: 6, color: '#999', fontSize: '0.8rem' }}>~</span>
        <MonthPicker label="종료월" value={endMonth} onChange={setEndMonth} />
        {(startMonth || endMonth) && (
          <button
            type="button"
            onClick={() => { setStartMonth(''); setEndMonth('') }}
            style={{
              height: 32,
              padding: '0 10px',
              border: '1px solid #ccc',
              borderRadius: 6,
              background: '#fff',
              fontSize: '0.75rem',
              cursor: 'pointer',
              color: '#666',
              whiteSpace: 'nowrap',
            }}
            title="기간 필터 해제 — 전체 이력"
          >
            기간 초기화
          </button>
        )}
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

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', height: '32px' }}>
        {totalCount > 0 && (
           <span style={{ fontSize: '0.8rem', color: '#666', marginRight: '4px', whiteSpace: 'nowrap' }}>
             건수: <b>{totalCount}</b>
             {!start.year && !end.year ? <span style={{ marginLeft: 6, color: '#999' }}>(전체 기간)</span> : null}
           </span>
        )}
        
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
