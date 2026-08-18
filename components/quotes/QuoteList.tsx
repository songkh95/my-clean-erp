'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Button from '@/components/ui/Button'
import QuoteDocument from '@/components/quotes/QuoteDocument'
import {
  deleteQuoteAction,
  getQuoteAction,
  listClientsForQuoteAction,
  listQuotesAction,
  saveQuoteAction,
  type QuoteInput,
  type QuoteItemInput,
} from '@/app/actions/quotes'
import { DEFAULT_FOOTER_NOTICE, DEFAULT_ISSUER, DEFAULT_MFP_AMOUNT_TEMPLATE, formatLeaseInfo, parseLeaseInfo } from '@/utils/quoteDefaults'
import { loadAppSettings, type AppSettings } from '@/utils/appSettings'
import { exportQuoteToExcel } from '@/utils/quoteExcel'
import { formatWon, todayYmd } from '@/utils/koreanAmount'
import { calcQuoteTotals } from '@/utils/quoteTotals'
import styles from './QuoteList.module.css'

type QuoteListRow = {
  id: string
  quote_no: string | null
  quote_date: string
  client_name: string
  status: string
  notes: string | null
  created_at: string
  updated_at: string
  totals: { supply: number; vat: number; total: number }
}

type EditorState = QuoteInput & { id?: string }

const STATUS_LABEL: Record<string, string> = {
  draft: '작성중',
  sent: '발송',
  accepted: '확정',
  cancelled: '취소',
}

function emptyItem(): QuoteItemInput {
  return {
    description: '',
    unit: '대',
    quantity: 1,
    unit_price: 0,
    amount_text: '',
    exclude_from_total: false,
  }
}

function issuerFromSettings(q: AppSettings['quotes']) {
  return {
    issuer_company: q.issuer_company || DEFAULT_ISSUER.issuer_company,
    issuer_partner: q.issuer_partner || DEFAULT_ISSUER.issuer_partner,
    issuer_ceo: q.issuer_ceo || DEFAULT_ISSUER.issuer_ceo,
    issuer_biz_no: q.issuer_biz_no || DEFAULT_ISSUER.issuer_biz_no,
    issuer_address: q.issuer_address || DEFAULT_ISSUER.issuer_address,
    issuer_manager: q.issuer_manager || DEFAULT_ISSUER.issuer_manager,
    issuer_tel: q.issuer_tel || DEFAULT_ISSUER.issuer_tel,
    issuer_hp: q.issuer_hp || DEFAULT_ISSUER.issuer_hp,
    issuer_homepage: q.issuer_homepage || DEFAULT_ISSUER.issuer_homepage,
    issuer_blog: q.issuer_blog || DEFAULT_ISSUER.issuer_blog,
  }
}

function blankQuote(settings?: AppSettings): EditorState {
  const q = settings?.quotes
  return {
    quote_no: '',
    quote_date: todayYmd(),
    client_id: null,
    client_name: '',
    title: '見積書',
    intro: q?.defaultIntro || '아래와 같이 見積합니다.',
    notes: '',
    footer_notice: q?.defaultFooterNotice || DEFAULT_FOOTER_NOTICE,
    ...(q ? issuerFromSettings(q) : { ...DEFAULT_ISSUER }),
    vat_rate: 10,
    status: 'draft',
    items: [emptyItem(), emptyItem(), emptyItem()],
  }
}

export default function QuoteList() {
  const [rows, setRows] = useState<QuoteListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [q, setQ] = useState('')
  const [mode, setMode] = useState<'list' | 'edit'>('list')
  const [editor, setEditor] = useState<EditorState>(blankQuote())
  const [clients, setClients] = useState<{ id: string; name: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [printOpen, setPrintOpen] = useState(false)
  const [quoteSettings, setQuoteSettings] = useState<AppSettings['quotes'] | null>(null)
  const [notePresetId, setNotePresetId] = useState('')

  const loadList = useCallback(async () => {
    setLoading(true)
    const res = await listQuotesAction()
    if (!res.success) setMessage(res.message)
    else setMessage('')
    setRows((res.data || []) as QuoteListRow[])
    setLoading(false)
  }, [])

  useEffect(() => {
    const settings = loadAppSettings()
    setQuoteSettings(settings.quotes)
    loadList()
    listClientsForQuoteAction().then((r) => {
      if (r.success) setClients(r.data)
    })
    const sync = () => setQuoteSettings(loadAppSettings().quotes)
    window.addEventListener('app-settings-changed', sync)
    return () => window.removeEventListener('app-settings-changed', sync)
  }, [loadList])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return rows
    return rows.filter(
      (r) =>
        (r.client_name || '').toLowerCase().includes(s) ||
        (r.quote_no || '').toLowerCase().includes(s) ||
        (r.notes || '').toLowerCase().includes(s)
    )
  }, [rows, q])

  const totals = useMemo(
    () => calcQuoteTotals(editor.items || [], Number(editor.vat_rate) || 10),
    [editor.items, editor.vat_rate]
  )

  const notePresets = quoteSettings?.notePresets || []
  const mfpTemplate = (() => {
    const raw = quoteSettings?.mfpAmountTemplate || DEFAULT_MFP_AMOUNT_TEMPLATE
    const parsed = parseLeaseInfo(raw)
    if (!/^\s*보증금\s*[:：]/m.test(raw)) return DEFAULT_MFP_AMOUNT_TEMPLATE
    return formatLeaseInfo(parsed)
  })()

  const openNew = () => {
    const settings = loadAppSettings()
    setQuoteSettings(settings.quotes)
    setEditor(blankQuote(settings))
    setNotePresetId('')
    setMode('edit')
    setPrintOpen(false)
  }

  const openEdit = async (id: string) => {
    const res = await getQuoteAction(id)
    if (!res.success || !res.data) {
      setMessage(res.message || '견적서를 불러오지 못했습니다.')
      return
    }
    const d = res.data as any
    setEditor({
      id: d.id,
      quote_no: d.quote_no || '',
      quote_date: d.quote_date,
      client_id: d.client_id,
      client_name: d.client_name || '',
      title: d.title || '見積書',
      intro: d.intro || '아래와 같이 見積합니다.',
      notes: d.notes || '',
      footer_notice: d.footer_notice || DEFAULT_FOOTER_NOTICE,
      issuer_company: d.issuer_company,
      issuer_partner: d.issuer_partner,
      issuer_ceo: d.issuer_ceo,
      issuer_biz_no: d.issuer_biz_no,
      issuer_address: d.issuer_address,
      issuer_manager: d.issuer_manager,
      issuer_tel: d.issuer_tel,
      issuer_hp: d.issuer_hp,
      issuer_homepage: d.issuer_homepage,
      issuer_blog: d.issuer_blog,
      vat_rate: Number(d.vat_rate) || 10,
      status: d.status || 'draft',
      items:
        (d.items || []).length > 0
          ? d.items.map((i: any) => ({
              id: i.id,
              description: i.description || '',
              unit: i.unit || '대',
              quantity: Number(i.quantity) || 0,
              unit_price: Number(i.unit_price) || 0,
              amount_text: i.amount_text || '',
              exclude_from_total: Boolean(i.exclude_from_total),
            }))
          : [emptyItem()],
    })
    setNotePresetId('')
    setMode('edit')
    setPrintOpen(false)
  }

  const updateItem = (idx: number, patch: Partial<QuoteItemInput>) => {
    setEditor((prev) => {
      const items = [...(prev.items || [])]
      items[idx] = { ...items[idx], ...patch }
      return { ...prev, items }
    })
  }

  const applyNotePreset = () => {
    const preset = notePresets.find((p) => p.id === notePresetId)
    if (!preset) return
    setEditor((prev) => ({
      ...prev,
      notes: prev.notes?.trim()
        ? `${prev.notes.trim()}\n${preset.content}`
        : preset.content,
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    const res = await saveQuoteAction(editor)
    setSaving(false)
    if (!res.success) {
      setMessage(res.message)
      return
    }
    setMessage(res.message)
    if (res.id) {
      setEditor((prev) => ({ ...prev, id: res.id || prev.id }))
    }
    await loadList()
  }

  const handleDelete = async () => {
    if (!editor.id) return
    if (!confirm('이 견적서를 삭제할까요?')) return
    const res = await deleteQuoteAction(editor.id)
    setMessage(res.message)
    if (res.success) {
      setMode('list')
      await loadList()
    }
  }

  const handleExcel = () => {
    exportQuoteToExcel({
      quote_no: editor.quote_no,
      quote_date: editor.quote_date,
      client_name: editor.client_name,
      notes: editor.notes,
      footer_notice: editor.footer_notice,
      issuer_company: editor.issuer_company,
      issuer_partner: editor.issuer_partner,
      issuer_manager: editor.issuer_manager,
      issuer_tel: editor.issuer_tel,
      issuer_hp: editor.issuer_hp,
      issuer_homepage: editor.issuer_homepage,
      issuer_blog: editor.issuer_blog,
      vat_rate: editor.vat_rate,
      items: editor.items,
    })
  }

  if (mode === 'edit') {
    return (
      <div className={styles.wrap}>
        <div className={styles.header}>
          <h1 className={styles.title}>{editor.id ? '견적서 수정' : '새 견적서'}</h1>
          <div className={styles.actions}>
            <Button variant="outline" onClick={() => setMode('list')}>
              목록
            </Button>
            {editor.id ? (
              <Button variant="danger" onClick={handleDelete}>
                삭제
              </Button>
            ) : null}
            <Button variant="outline" onClick={handleExcel}>
              엑셀 저장
            </Button>
            <Button variant="outline" onClick={() => setPrintOpen(true)}>
              인쇄 미리보기
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? '저장 중…' : '저장'}
            </Button>
          </div>
        </div>

        {message ? (
          <p style={{ color: 'var(--notion-sub-text)', marginBottom: 12 }}>{message}</p>
        ) : null}

        <div className={styles.editorLayout}>
          <div className={styles.formCard}>
            <h2 className={styles.sectionTitle}>기본 정보</h2>
            <div className={styles.grid3}>
              <div className={styles.field}>
                <label>견적번호</label>
                <input
                  value={editor.quote_no || ''}
                  onChange={(e) => setEditor({ ...editor, quote_no: e.target.value })}
                  placeholder="예: 260818-1"
                />
              </div>
              <div className={styles.field}>
                <label>견적일자</label>
                <input
                  type="date"
                  value={editor.quote_date}
                  onChange={(e) => setEditor({ ...editor, quote_date: e.target.value })}
                />
              </div>
              <div className={styles.field}>
                <label>상태</label>
                <select
                  value={editor.status || 'draft'}
                  onChange={(e) => setEditor({ ...editor, status: e.target.value })}
                >
                  <option value="draft">작성중</option>
                  <option value="sent">발송</option>
                  <option value="accepted">확정</option>
                  <option value="cancelled">취소</option>
                </select>
              </div>
            </div>

            <div className={styles.grid2} style={{ marginTop: 8 }}>
              <div className={styles.field}>
                <label>거래처 선택 (선택)</label>
                <select
                  value={editor.client_id || ''}
                  onChange={(e) => {
                    const id = e.target.value || null
                    const found = clients.find((c) => c.id === id)
                    setEditor({
                      ...editor,
                      client_id: id,
                      client_name: found?.name || editor.client_name,
                    })
                  }}
                >
                  <option value="">직접 입력</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <label>수신처 (貴中) *</label>
                <input
                  value={editor.client_name}
                  onChange={(e) => setEditor({ ...editor, client_name: e.target.value })}
                  placeholder="거래처명"
                />
              </div>
            </div>

            <div className={styles.grid2} style={{ marginTop: 8 }}>
              <div className={styles.field}>
                <label>제목</label>
                <input
                  value={editor.title || ''}
                  onChange={(e) => setEditor({ ...editor, title: e.target.value })}
                />
              </div>
              <div className={styles.field}>
                <label>부가세율 (%)</label>
                <input
                  type="number"
                  value={editor.vat_rate ?? 10}
                  onChange={(e) => setEditor({ ...editor, vat_rate: Number(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className={styles.field} style={{ marginTop: 8 }}>
              <label>안내 문구</label>
              <input
                value={editor.intro || ''}
                onChange={(e) => setEditor({ ...editor, intro: e.target.value })}
              />
            </div>

            <h2 className={styles.sectionTitle} style={{ marginTop: 18 }}>
              품목
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--notion-sub-text)', margin: '0 0 10px' }}>
              복합기는 「임대 정보」를 켜면 공급가액에 임대조건이 표시됩니다. 합계금액은 단가×수량으로 계산됩니다.
            </p>

            {editor.items.map((item, idx) => {
              const line =
                Math.round(Number(item.quantity) || 0) * Math.round(Number(item.unit_price) || 0)
              const leaseMode = Boolean(String(item.amount_text || '').trim())
              const lease = leaseMode ? parseLeaseInfo(item.amount_text) : null
              return (
                <div key={idx} className={styles.itemBlock}>
                  <div className={styles.itemRow}>
                    <div className={styles.field} style={{ marginBottom: 0 }}>
                      <label>품명</label>
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => updateItem(idx, { description: e.target.value })}
                        placeholder="품명 / 모델명"
                      />
                    </div>
                    <div className={styles.field} style={{ marginBottom: 0 }}>
                      <label>단위</label>
                      <input
                        type="text"
                        value={item.unit}
                        onChange={(e) => updateItem(idx, { unit: e.target.value })}
                      />
                    </div>
                    <div className={styles.field} style={{ marginBottom: 0 }}>
                      <label>수량</label>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) || 0 })}
                      />
                    </div>
                    <div className={styles.field} style={{ marginBottom: 0 }}>
                      <label>단가</label>
                      <input
                        type="number"
                        value={item.unit_price}
                        onChange={(e) =>
                          updateItem(idx, { unit_price: Number(e.target.value) || 0 })
                        }
                      />
                    </div>
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: '0.8rem',
                        paddingBottom: 8,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(item.exclude_from_total)}
                        onChange={(e) => updateItem(idx, { exclude_from_total: e.target.checked })}
                      />
                      합계제외
                    </label>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setEditor((prev) => ({
                          ...prev,
                          items: prev.items.filter((_, i) => i !== idx),
                        }))
                      }
                    >
                      ✕
                    </Button>
                  </div>

                  <div className={styles.itemActions}>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        updateItem(idx, {
                          amount_text: leaseMode ? '' : mfpTemplate,
                        })
                      }
                    >
                      {leaseMode ? '숫자 공급가액으로' : '임대 정보'}
                    </Button>
                    <span style={{ fontSize: '0.8rem', color: 'var(--notion-sub-text)' }}>
                      {leaseMode
                        ? '공급가액=금액, 오른쪽에 임대정보 열 표시'
                        : `계산 공급가액: ${formatWon(line)}`}
                    </span>
                  </div>

                  {leaseMode && lease ? (
                    <table className={styles.leaseTable}>
                      <thead>
                        <tr>
                          <th colSpan={2}>임대 정보</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <th>보증금</th>
                          <td>
                            <input
                              type="text"
                              value={lease.deposit}
                              onChange={(e) =>
                                updateItem(idx, {
                                  amount_text: formatLeaseInfo({
                                    ...lease,
                                    deposit: e.target.value,
                                  }),
                                })
                              }
                            />
                          </td>
                        </tr>
                        <tr>
                          <th>기본요금</th>
                          <td>
                            <input
                              type="text"
                              value={lease.baseFee}
                              onChange={(e) =>
                                updateItem(idx, {
                                  amount_text: formatLeaseInfo({
                                    ...lease,
                                    baseFee: e.target.value,
                                  }),
                                })
                              }
                            />
                          </td>
                        </tr>
                        <tr>
                          <th>추가요금</th>
                          <td>
                            <textarea
                              value={lease.extraFee}
                              onChange={(e) =>
                                updateItem(idx, {
                                  amount_text: formatLeaseInfo({
                                    ...lease,
                                    extraFee: e.target.value,
                                  }),
                                })
                              }
                            />
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  ) : null}
                </div>
              )
            })}

            <div className={styles.itemActions}>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditor({ ...editor, items: [...editor.items, emptyItem()] })}
              >
                + 품목 추가
              </Button>
            </div>
            <div className={styles.totalsBar}>
              <span>소계 {formatWon(totals.supply)}</span>
              <span>부가세 {formatWon(totals.vat)}</span>
              <span>합계 {formatWon(totals.total)}</span>
            </div>

            <h2 className={styles.sectionTitle} style={{ marginTop: 18 }}>
              비고
            </h2>
            <div className={styles.presetRow}>
              <select value={notePresetId} onChange={(e) => setNotePresetId(e.target.value)}>
                <option value="">비고 기본값 선택…</option>
                {notePresets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <Button size="sm" variant="outline" onClick={applyNotePreset} disabled={!notePresetId}>
                넣기
              </Button>
              <span style={{ fontSize: '0.75rem', color: 'var(--notion-sub-text)' }}>
                설정 → 견적서에서 기본값을 관리합니다
              </span>
            </div>
            <div className={styles.field}>
              <textarea
                value={editor.notes || ''}
                onChange={(e) => setEditor({ ...editor, notes: e.target.value })}
                placeholder="납기, 보증, 옵션 안내 등"
              />
            </div>

            <div className={styles.field} style={{ marginTop: 8 }}>
              <label>비고 아래 안내 문구</label>
              <textarea
                value={editor.footer_notice || ''}
                onChange={(e) => setEditor({ ...editor, footer_notice: e.target.value })}
                placeholder={DEFAULT_FOOTER_NOTICE}
              />
            </div>

            <h2 className={styles.sectionTitle} style={{ marginTop: 18 }}>
              발행자 정보
            </h2>
            <div className={styles.grid2}>
              <div className={styles.field}>
                <label>상호</label>
                <input
                  value={editor.issuer_company || ''}
                  onChange={(e) => setEditor({ ...editor, issuer_company: e.target.value })}
                />
              </div>
              <div className={styles.field}>
                <label>파트너/브랜드</label>
                <input
                  value={editor.issuer_partner || ''}
                  onChange={(e) => setEditor({ ...editor, issuer_partner: e.target.value })}
                />
              </div>
              <div className={styles.field}>
                <label>대표자</label>
                <input
                  value={editor.issuer_ceo || ''}
                  onChange={(e) => setEditor({ ...editor, issuer_ceo: e.target.value })}
                />
              </div>
              <div className={styles.field}>
                <label>사업자번호</label>
                <input
                  value={editor.issuer_biz_no || ''}
                  onChange={(e) => setEditor({ ...editor, issuer_biz_no: e.target.value })}
                />
              </div>
              <div className={styles.field}>
                <label>담당자</label>
                <input
                  value={editor.issuer_manager || ''}
                  onChange={(e) => setEditor({ ...editor, issuer_manager: e.target.value })}
                />
              </div>
              <div className={styles.field}>
                <label>TEL</label>
                <input
                  value={editor.issuer_tel || ''}
                  onChange={(e) => setEditor({ ...editor, issuer_tel: e.target.value })}
                />
              </div>
              <div className={styles.field}>
                <label>HP</label>
                <input
                  value={editor.issuer_hp || ''}
                  onChange={(e) => setEditor({ ...editor, issuer_hp: e.target.value })}
                />
              </div>
              <div className={styles.field}>
                <label>홈페이지</label>
                <input
                  value={editor.issuer_homepage || ''}
                  onChange={(e) => setEditor({ ...editor, issuer_homepage: e.target.value })}
                />
              </div>
              <div className={styles.field} style={{ gridColumn: '1 / -1' }}>
                <label>주소</label>
                <input
                  value={editor.issuer_address || ''}
                  onChange={(e) => setEditor({ ...editor, issuer_address: e.target.value })}
                />
              </div>
              <div className={styles.field} style={{ gridColumn: '1 / -1' }}>
                <label>블로그</label>
                <input
                  value={editor.issuer_blog || ''}
                  onChange={(e) => setEditor({ ...editor, issuer_blog: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className={styles.previewCard}>
            <div className={styles.previewActions}>
              <h2 className={styles.previewTitle} style={{ margin: 0, flex: 1 }}>
                미리보기
              </h2>
              <Button size="sm" variant="outline" onClick={() => setPrintOpen(true)}>
                크게 보기 / 인쇄
              </Button>
              <Button size="sm" variant="outline" onClick={handleExcel}>
                엑셀
              </Button>
            </div>
            <QuoteDocument quote={editor} />
          </div>
        </div>

        {printOpen ? (
          <>
            <div className={styles.printActions}>
              <Button onClick={() => window.print()}>🖨️ 인쇄</Button>
              <Button variant="outline" onClick={() => setPrintOpen(false)}>
                닫기
              </Button>
            </div>
            <div className={styles.printOverlay}>
              <div className={styles.printRoot}>
                <QuoteDocument quote={editor} />
              </div>
            </div>
          </>
        ) : null}
      </div>
    )
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <h1 className={styles.title}>견적서</h1>
        <div className={styles.actions}>
          <Button onClick={openNew}>+ 새 견적서</Button>
        </div>
      </div>

      {message ? (
        <p style={{ color: 'var(--notion-sub-text)', marginBottom: 12 }}>{message}</p>
      ) : null}

      <div className={styles.panel}>
        <div className={styles.toolbar}>
          <input
            className={styles.search}
            placeholder="거래처명 / 견적번호 / 비고 검색"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Button variant="outline" size="sm" onClick={loadList}>
            새로고침
          </Button>
        </div>

        {loading ? (
          <div className={styles.empty}>불러오는 중…</div>
        ) : filtered.length === 0 ? (
          <div className={styles.empty}>등록된 견적서가 없습니다. 새 견적서를 만들어 보세요.</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>일자</th>
                <th>번호</th>
                <th>수신처</th>
                <th>상태</th>
                <th className={styles.right}>합계</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className={styles.rowClick} onClick={() => openEdit(r.id)}>
                  <td>{r.quote_date}</td>
                  <td>{r.quote_no || '—'}</td>
                  <td>{r.client_name}</td>
                  <td>
                    <span className={styles.badge}>{STATUS_LABEL[r.status] || r.status}</span>
                  </td>
                  <td className={styles.right}>{formatWon(r.totals?.total || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
