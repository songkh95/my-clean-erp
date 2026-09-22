'use client'

import Button from '@/components/ui/Button'
import React, { useRef, useEffect, useMemo } from 'react'
import { Client } from '@/app/types'
import styles from '@/app/accounting/accounting.module.css'

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
  totalCount
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

  const labelStyle = { display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--notion-sub-text)', marginBottom: '2px' }
  const inputStyle = { padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--notion-border)', fontSize: '0.85rem', height: '32px', boxSizing: 'border-box' as const, backgroundColor: 'var(--notion-soft-bg)', color: 'var(--notion-main-text)' }
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
    <div
      className="historyFilterBar"
      style={{
      backgroundColor: 'var(--notion-bg)',
      padding: '10px 12px',
      marginBottom: '12px',
      display: 'flex',
      gap: '8px',
      alignItems: 'flex-end',
      flexWrap: 'nowrap',
      overflowX: 'auto',
      WebkitOverflowScrolling: 'touch'
    }}
    lang="ko"
    >
      
      {/* 1. 거래처 검색 */}
      <div style={{ position: 'relative', width: 'min(200px, 55vw)', flexShrink: 0 }} ref={searchRef}>
        <label style={labelStyle}>거래처 검색</label>
        <div style={{ display: 'flex', gap: '4px' }}>
          <input
            type="text"
            placeholder="거래처명..."
            value={searchTerm}
            onKeyDown={handleKeyDown}
            onChange={(e) => { setSearchTerm(e.target.value); setShowSuggestions(true); }}
            onFocus={() => setShowSuggestions(true)}
            style={{ ...inputStyle, width: '100%', minWidth: 0 }}
          />
          <Button variant="primary"
            onClick={onSearchTrigger}>
            조회
          </Button>
        </div>
        {showSuggestions && filteredClients.length > 0 && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: 'var(--notion-bg)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)', maxHeight: '200px', overflowY: 'auto', zIndex: 1000, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', marginTop: '2px' }}>
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
          <Button variant="secondary"
            type="button"
            onClick={() => { setStartMonth(''); setEndMonth('') }}
           
           
            title="기간 필터 해제 — 전체 이력">
            기간 초기화
          </Button>
        )}
      </div>

      {/* 3. 보기 방식 */}
      <div>
        <label style={labelStyle}>보기 방식</label>
        <div style={{ display: 'flex', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', height: '32px' }}>
          <button
            onClick={() => setViewMode('all')}
            style={{
              padding: '0 12px',
              backgroundColor: viewMode === 'all' ? 'var(--notion-blue)' : 'var(--notion-bg)',
              color: viewMode === 'all' ? '#fff' : 'var(--notion-main-text)',
              border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600'
            }}
          >
            전체
          </button>
          <button
            onClick={() => setViewMode('machine')}
            style={{
              padding: '0 12px',
              backgroundColor: viewMode === 'machine' ? 'var(--notion-blue)' : 'var(--notion-bg)',
              color: viewMode === 'machine' ? '#fff' : 'var(--notion-main-text)',
              border: 'none', cursor: 'pointer', borderLeft: '1px solid var(--notion-border)', fontSize: '0.8rem', fontWeight: '600'
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
      </div>
    </div>
  )
}
