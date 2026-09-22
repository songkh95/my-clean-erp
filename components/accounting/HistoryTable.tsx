'use client'

import Button from '@/components/ui/Button'
import React, { useMemo } from 'react'
import { HistoryItem } from '@/app/types'
import styles from '@/app/accounting/accounting.module.css'

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
    <div className={styles.section}>
        <div className={styles.tableContainer} style={{ overflowX: 'auto' }}>
            <table className={styles.table} style={{ tableLayout: 'auto' }}>
                <thead>
                    <tr>
                        <th className={styles.th} style={{ width: '32px' }}></th>
                        <th className={styles.th} style={{ width: '40px' }}>No.</th>
                        <th className={styles.th} style={{ width: '180px', textAlign: 'left' }}>기계명 (S/N)</th>

                        <th className={styles.th} style={{ width: '50px' }} rowSpan={2}>
                            청구월
                        </th>

                        <th className={styles.th} style={{ width: '160px', backgroundColor: '#f0f0f0' }}>
                            전월 지침<br/>
                            <span style={{fontSize:'0.75rem', fontWeight:'normal', color:'#666'}}>(A4/A3 흑·칼)</span>
                        </th>

                        <th className={styles.th} style={{ width: '160px', backgroundColor: '#e3f2fd' }}>
                            당월 지침<br/>
                            <span style={{fontSize:'0.75rem', fontWeight:'normal', color:'#666'}}>(A4/A3 흑·칼)</span>
                        </th>

                        <th className={styles.th} style={{ width: '120px' }}>
                            실사용 / 추가 매수
                        </th>

                        <th className={styles.th} style={{ width: '90px', textAlign: 'right' }}>청구금액<br />(VAT포함)</th>
                        <th className={styles.th} style={{ width: '100px' }}>발행</th>
                    </tr>
                </thead>
                <tbody>
                    {loading ? (
                        <tr><td colSpan={9} className={styles.td} style={{ padding: '60px' }}>데이터를 불러오는 중입니다...</td></tr>
                    ) : items.length === 0 ? (
                        <tr><td colSpan={9} className={styles.td} style={{ padding: '60px', color: 'var(--notion-sub-text)' }}>조회된 청구 이력이 없습니다.</td></tr>
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
                                        <tr><td colSpan={9} style={{ height: '30px', backgroundColor: 'var(--notion-soft-bg)', borderTop: '2px solid var(--notion-border)', borderBottom: '1px solid var(--notion-border)' }}></td></tr>
                                    )}
                                    <tr style={{ backgroundColor: item.is_modified ? '#fffbe6' : undefined, opacity: isLocked ? 0.7 : 1 }}>
                                        <td className={styles.td}>
                                            <input
                                                type="checkbox"
                                                checked={checkedIds.has(item.id)}
                                                disabled={isLocked}
                                                onChange={() => onToggleCheck(item.id)}
                                                title={isLocked ? '이미 처리된 건은 선택할 수 없습니다' : undefined}
                                            />
                                        </td>
                                        <td className={styles.td} style={{ color: 'var(--notion-sub-text)' }}>{idx + 1}</td>
                                        <td className={styles.td} style={{ textAlign: 'left', padding: '12px' }}>
                                            <div style={{ fontWeight: 'bold', color: '#333', fontSize: '0.9rem' }}>{inventory?.model_name || '-'}</div>
                                            <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '2px' }}>{inventory?.serial_number || '-'}</div>
                                        </td>

                                        <td className={styles.td}>
                                            <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>
                                                {String(item.settlement.billing_month).padStart(2, '0')}월
                                            </div>
                                        </td>

                                        {/* ✅ 전월 지침 (에러여도 수정 가능하도록 조건 변경) */}
                                        <td className={styles.td} style={{ padding: '8px', backgroundColor: '#fafafa' }}>
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
                                        <td className={styles.td} style={{ padding: '8px', backgroundColor: '#f0f8ff' }}>
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
                                        <td className={styles.td} style={{ padding: '8px', textAlign: 'left' }}>
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

                                        <td className={styles.td} style={{ textAlign: 'right', padding: '12px', fontWeight: 'bold', color: '#171717', fontSize: '0.9rem' }}>
                                            {Math.floor(item.calculated_amount * 1.1).toLocaleString()}원
                                        </td>

                                        <td className={styles.td} style={{ padding: '8px' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                                                <Button variant="secondary" size="sm"
                                                    onClick={() => onStatement(item)}> 명세서 </Button>

                                                <Button variant="secondary" size="sm"
                                                    onClick={() => onTaxInvoice(item)}> 세금계산서 </Button>
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
                border: isError ? '1px solid #ff4d4f' : '1px solid var(--notion-border)',
                borderRadius: 'var(--radius-sm)',
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
                    e.target.style.border = '1px solid var(--notion-border)';
                    e.target.style.boxShadow = '0 1px 1px rgba(0,0,0,0.05)';
                }
            }}
        />
    )
}
