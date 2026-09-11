'use client'

import React, { useMemo } from 'react'
import { HistoryItem } from '@/app/types'

interface Props {
  loading: boolean
  items: HistoryItem[]
  viewMode: 'all' | 'machine'
  checkedIds: Set<string>
  editingId: string | null
  errorMap?: Map<string, { bw: boolean, col: boolean, bw_a3: boolean, col_a3: boolean }>
  onInputChange: (id: string, field: keyof HistoryItem, val: string) => void
  onStatement: (item: HistoryItem) => void
  onTaxInvoice: (item: HistoryItem) => void
  onToggleCheck: (id: string) => void
}

export default function HistoryTable({
  loading, items, viewMode, checkedIds, editingId, errorMap,
  onInputChange, onStatement, onTaxInvoice, onToggleCheck
}: Props) {

  // 1. 데이터 정렬
  const sortedItems = useMemo(() => {
    const list = [...items];
    if (viewMode === 'all') {
      return list.sort((a, b) => {
        const da = a.settlement.billing_year * 100 + a.settlement.billing_month;
        const db = b.settlement.billing_year * 100 + b.settlement.billing_month;
        if (da === db) return (a.inventory?.model_name || '').localeCompare(b.inventory?.model_name || '');
        return db - da; // 최신순
      });
    } else {
      return list.sort((a, b) => {
        if (!a.inventory || !b.inventory) return 0;
        if (a.inventory.serial_number !== b.inventory.serial_number) {
          return a.inventory.serial_number.localeCompare(b.inventory.serial_number);
        }
        const da = a.settlement.billing_year * 100 + a.settlement.billing_month;
        const db = b.settlement.billing_year * 100 + b.settlement.billing_month;
        return da - db; // 과거 -> 미래순 (타임라인)
      });
    }
  }, [items, viewMode]);

  return (
    <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #ddd', overflow: 'hidden', minHeight: '600px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
        <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead style={{ backgroundColor: '#f5f5f5', borderBottom: '2px solid #ccc', color: '#444' }}>
                    <tr>
                        <th style={{ padding: '10px', width: '32px', borderRight: '1px solid #ddd' }}></th>
                        <th style={{ padding: '10px', width: '40px', borderRight: '1px solid #ddd' }}>No.</th>
                        <th style={{ padding: '10px', width: '180px', borderRight: '1px solid #ddd', textAlign: 'left' }}>기계명 (S/N)</th>

                        <th style={{ padding: '10px', width: '50px', borderRight: '1px solid #ddd', whiteSpace: 'nowrap' }} rowSpan={2}>
                            청구월
                        </th>

                        <th style={{ padding: '8px', width: '160px', borderRight: '1px solid #ddd', backgroundColor: '#f0f0f0', verticalAlign:'middle' }}>
                            전월 지침<br/>
                            <span style={{fontSize:'0.75rem', fontWeight:'normal', color:'#666'}}>(A4/A3 흑·칼)</span>
                        </th>

                        <th style={{ padding: '8px', width: '160px', borderRight: '1px solid #ddd', backgroundColor: '#e3f2fd', verticalAlign:'middle' }}>
                            당월 지침<br/>
                            <span style={{fontSize:'0.75rem', fontWeight:'normal', color:'#666'}}>(A4/A3 흑·칼)</span>
                        </th>

                        <th style={{ padding: '8px', borderRight: '1px solid #ddd', width: '120px', verticalAlign:'middle' }}>
                            실사용 / 추가 매수
                        </th>

                        <th style={{ padding: '10px', width: '90px', textAlign: 'right', borderRight: '1px solid #ddd' }}>청구금액<br />(VAT포함)</th>
                        <th style={{ padding: '10px', width: '100px', textAlign: 'center' }}>발행</th>
                    </tr>
                </thead>
                <tbody>
                    {loading ? (
                        <tr><td colSpan={9} style={{ padding: '60px', textAlign: 'center' }}>데이터를 불러오는 중입니다...</td></tr>
                    ) : items.length === 0 ? (
                        <tr><td colSpan={9} style={{ padding: '60px', textAlign: 'center', color: '#888' }}>조회된 청구 이력이 없습니다.</td></tr>
                    ) : (
                        sortedItems.map((item, idx) => {
                            const isLocked = item.settlement.is_paid
                            const inventory = item.inventory
                            const isNewGroup = viewMode === 'machine' && idx > 0 && sortedItems[idx - 1].inventory?.serial_number !== item.inventory?.serial_number

                            const wBw = inventory?.plan_weight_a3_bw || 1
                            const wCol = inventory?.plan_weight_a3_col || 1

                            const pureTotalBw = item.usage_bw + (item.usage_bw_a3 * wBw)
                            const pureTotalCol = item.usage_col + (item.usage_col_a3 * wCol)

                            const extraBw = Math.max(0, pureTotalBw - (inventory?.plan_basic_cnt_bw || 0))
                            const extraCol = Math.max(0, pureTotalCol - (inventory?.plan_basic_cnt_col || 0))

                            // ✅ 체크박스로 선택 → "수정" 버튼을 누른 딱 1건만 입력 가능
                            const isInputDisabled = isLocked || editingId !== item.id

                            // 에러 체크
                            const err = errorMap?.get(item.id);
                            const hasErr = err && (err.bw || err.col || err.bw_a3 || err.col_a3);

                            return (
                                <React.Fragment key={item.id}>
                                    {isNewGroup && (
                                        <tr><td colSpan={9} style={{ height: '30px', backgroundColor: '#f4f4f4', borderTop: '2px solid #ccc', borderBottom: '1px solid #ccc' }}></td></tr>
                                    )}
                                    <tr style={{ backgroundColor: item.is_modified ? '#fffbe6' : '#fff', borderBottom: '1px solid #eee', opacity: isLocked ? 0.7 : 1 }}>
                                        <td style={{ textAlign: 'center' }}>
                                            <input
                                                type="checkbox"
                                                checked={checkedIds.has(item.id)}
                                                disabled={isLocked}
                                                onChange={() => onToggleCheck(item.id)}
                                                title={isLocked ? '이미 처리된 건은 선택할 수 없습니다' : undefined}
                                            />
                                        </td>
                                        <td style={{ textAlign: 'center', color: '#888' }}>{idx + 1}</td>
                                        <td style={{ padding: '12px' }}>
                                            <div style={{ fontWeight: 'bold', color: '#333', fontSize: '0.9rem' }}>{inventory?.model_name || '-'}</div>
                                            <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '2px' }}>{inventory?.serial_number || '-'}</div>
                                        </td>

                                        <td style={{ textAlign: 'center' }}>
                                            <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>
                                                {String(item.settlement.billing_month).padStart(2, '0')}월
                                            </div>
                                        </td>

                                        {/* ✅ 전월 지침 (에러여도 수정 가능하도록 조건 변경) */}
                                        <td style={{ padding: '8px', backgroundColor: '#fafafa', borderRight: '1px solid #ddd' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                                    <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#666', width: '20px' }}>A4</span>
                                                    <InputCell
                                                        value={item.prev_count_bw}
                                                        disabled={isInputDisabled} // 에러 조건 제거
                                                        isError={!!err?.bw}
                                                        onChange={(v) => onInputChange(item.id, 'prev_count_bw', v)}
                                                    />
                                                    <InputCell
                                                        value={item.prev_count_col}
                                                        disabled={isInputDisabled} // 에러 조건 제거
                                                        isError={!!err?.col}
                                                        color="#0070f3"
                                                        onChange={(v) => onInputChange(item.id, 'prev_count_col', v)}
                                                    />
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                                    <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#666', width: '20px' }}>A3</span>
                                                    <InputCell
                                                        value={item.prev_count_bw_a3}
                                                        disabled={isInputDisabled} // 에러 조건 제거
                                                        isError={!!err?.bw_a3}
                                                        onChange={(v) => onInputChange(item.id, 'prev_count_bw_a3', v)}
                                                    />
                                                    <InputCell
                                                        value={item.prev_count_col_a3}
                                                        disabled={isInputDisabled} // 에러 조건 제거
                                                        isError={!!err?.col_a3}
                                                        color="#0070f3"
                                                        onChange={(v) => onInputChange(item.id, 'prev_count_col_a3', v)}
                                                    />
                                                </div>
                                                {hasErr && (
                                                    <div style={{ fontSize: '0.7rem', color: '#d93025', textAlign: 'center', fontWeight: 'bold', marginTop: '4px' }}>
                                                        ⚠️ 지난달 데이터 불일치
                                                    </div>
                                                )}
                                            </div>
                                        </td>

                                        {/* 당월 지침 */}
                                        <td style={{ padding: '8px', backgroundColor: '#f0f8ff', borderRight: '1px solid #ddd' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                                    <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#666', width: '20px' }}>A4</span>
                                                    <InputCell value={item.curr_count_bw} disabled={isInputDisabled} bold onChange={(v) => onInputChange(item.id, 'curr_count_bw', v)} />
                                                    <InputCell value={item.curr_count_col} disabled={isInputDisabled} bold color="#0070f3" onChange={(v) => onInputChange(item.id, 'curr_count_col', v)} />
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                                    <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#666', width: '20px' }}>A3</span>
                                                    <InputCell value={item.curr_count_bw_a3} disabled={isInputDisabled} bold onChange={(v) => onInputChange(item.id, 'curr_count_bw_a3', v)} />
                                                    <InputCell value={item.curr_count_col_a3} disabled={isInputDisabled} bold color="#0070f3" onChange={(v) => onInputChange(item.id, 'curr_count_col_a3', v)} />
                                                </div>
                                            </div>
                                        </td>

                                        {/* 실사용 / 추가 */}
                                        <td style={{ padding: '8px', borderRight: '1px solid #ddd', verticalAlign:'middle' }}>
                                            <div style={{ display:'flex', flexDirection:'column', gap:'8px', fontSize:'0.8rem' }}>
                                                <div style={{ display:'flex', flexDirection:'column', gap:'2px' }}>
                                                    <span style={{ color:'#555', fontWeight:'bold', fontSize:'0.75rem' }}>기본</span>
                                                    <div style={{ display:'flex', gap:'8px', color:'#333' }}>
                                                        <span>흑: {pureTotalBw.toLocaleString()}</span>
                                                        <span style={{ color:'#0070f3' }}>칼: {pureTotalCol.toLocaleString()}</span>
                                                    </div>
                                                </div>
                                                <div style={{ display:'flex', flexDirection:'column', gap:'2px' }}>
                                                    <span style={{ color:'#d93025', fontWeight:'bold', fontSize:'0.75rem' }}>추가</span>
                                                    <div style={{ display:'flex', gap:'8px' }}>
                                                        <span style={{ color: extraBw>0 ? '#d93025' : '#ccc' }}>
                                                            흑: {extraBw.toLocaleString()}
                                                        </span>
                                                        <span style={{ color: extraCol>0 ? '#d93025' : '#ccc' }}>
                                                            칼: {extraCol.toLocaleString()}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>

                                        <td style={{ textAlign: 'right', padding: '12px', fontWeight: 'bold', color: '#171717', fontSize: '0.9rem', borderRight: '1px solid #ddd' }}>
                                            {Math.floor(item.calculated_amount * 1.1).toLocaleString()}원
                                        </td>

                                        <td style={{ padding: '8px', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                                                <button
                                                    onClick={() => onStatement(item)}
                                                    style={{ fontSize: '0.75rem', padding: '3px 8px', border: '1px solid #0070f3', color: '#0070f3', backgroundColor: 'white', borderRadius: '4px', cursor: 'pointer', width: '100%' }}
                                                >
                                                    🧾 명세서
                                                </button>

                                                <button
                                                    onClick={() => onTaxInvoice(item)}
                                                    style={{ fontSize: '0.75rem', padding: '3px 8px', border: '1px solid #7c3aed', color: '#7c3aed', backgroundColor: 'white', borderRadius: '4px', cursor: 'pointer', width: '100%' }}
                                                >
                                                    🧾 세금계산서
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                </React.Fragment>
                            )
                        })
                    )}
                </tbody>
            </table>
        </div>
    </div>
  )
}

// ✅ InputCell 업데이트: 커서 스타일 수정
function InputCell({
  value, onChange, disabled, color = '#333', bold = false, isError = false
}: {
  value: number, onChange: (val: string) => void, disabled?: boolean, color?: string, bold?: boolean, isError?: boolean
}) {
    return (
        <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            style={{
                width: '60px',
                border: isError ? '1px solid #ff4d4f' : '1px solid #d1d1d1',
                borderRadius: '4px',
                padding: '4px',
                textAlign: 'right',
                fontSize: '0.85rem',
                color: isError ? '#d93025' : color,
                fontWeight: bold ? '600' : '400',
                backgroundColor: isError ? '#fff1f0' : (disabled ? '#f5f5f5' : '#fff'),
                transition: 'all 0.1s',
                outline: 'none',
                boxShadow: disabled ? 'none' : '0 1px 1px rgba(0,0,0,0.05)',
                boxSizing: 'border-box',
                // ✅ 'not-allowed'를 제거하고 'text' 또는 'auto'로 변경 (요청사항 반영)
                cursor: 'text'
            }}
            onFocus={(e) => {
                if (!isError && !disabled) {
                    e.target.style.border = '1px solid #0070f3';
                    e.target.style.boxShadow = '0 0 0 2px rgba(0,112,243,0.1)';
                }
            }}
            onBlur={(e) => {
                if (!isError) {
                    e.target.style.border = '1px solid #d1d1d1';
                    e.target.style.boxShadow = '0 1px 1px rgba(0,0,0,0.05)';
                }
            }}
        />
    )
}
