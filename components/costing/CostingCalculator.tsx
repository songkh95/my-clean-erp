'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import PageHeader from '@/components/ui/PageHeader'
import Table from '@/components/ui/Table'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { toast } from '@/components/ui/Toast'
import {
  APPLY_LABEL,
  DEFAULT_INPUTS,
  DEFAULT_PARTS,
  calcCosting,
  cycleMonths,
  parseNum,
  perPageCons,
  unitsPerMonth,
  verdictOf,
  withCommas,
  type CostInputs,
  type CostPart,
  type PartApply,
} from '@/utils/rentalCosting'
import {
  deleteCostSimulationAction,
  getCostSimulationAction,
  listClientsForCostingAction,
  listCostSimulationsAction,
  saveCostSimulationAction,
  type CostSimulationRow,
} from '@/app/actions/costing'
import styles from './CostingCalculator.module.css'

type NumKey = Exclude<keyof CostInputs, 'showMachine' | 'showVolume' | 'showFixed'>

const won = (n: number) => `${n < 0 ? '−' : ''}${withCommas(Math.abs(Math.round(n)))}원`
const pages = (n: number) => `${withCommas(Math.round(n))}장`
const ea = (n: number) => `${(Math.round(n * 10) / 10).toLocaleString('ko-KR')}개`
const pct = (part: number, whole: number) => (whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : '-')
const cycleText = (c: number | null) =>
  c === null ? '-' : c >= 1 ? `${Math.round(c * 10) / 10}개월마다` : `${Math.round(c * 30)}일마다`

/** 입력칸: 포커스 중에는 그대로, 벗어나면 천 단위 콤마 */
function NumInput({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string
  value: number
  onChange: (n: number) => void
  placeholder?: string
  hint?: string
}) {
  const [text, setText] = useState('')
  const [editing, setEditing] = useState(false)

  return (
    <Input
      label={label}
      inputMode="decimal"
      className={styles.num}
      placeholder={placeholder}
      hint={hint}
      value={editing ? text : value ? withCommas(value) : ''}
      onFocus={() => {
        setText(value ? String(value) : '')
        setEditing(true)
      }}
      onChange={(e) => {
        const raw = (e.target as HTMLInputElement).value
        setText(raw)
        onChange(parseNum(raw))
      }}
      onBlur={() => setEditing(false)}
    />
  )
}

export default function CostingCalculator() {
  const confirm = useConfirm()

  const [mode, setMode] = useState<'list' | 'edit'>('list')
  const [rows, setRows] = useState<CostSimulationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [clients, setClients] = useState<{ id: string; name: string }[]>([])
  const [saving, setSaving] = useState(false)
  // 소모품은 한 번 맞춰두면 잘 안 고치므로 접어 둔다 — 값은 그대로 계산에 들어간다
  const [showParts, setShowParts] = useState(true)
  const [showUsage, setShowUsage] = useState(false)

  const [editId, setEditId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [clientId, setClientId] = useState('')
  const [model, setModel] = useState('')
  const [v, setV] = useState<CostInputs>(DEFAULT_INPUTS)
  const [parts, setParts] = useState<CostPart[]>(DEFAULT_PARTS)

  // 효과 안에서 바로 상태를 바꾸지 않도록, 불러오기 표시는 처음 상태로 두고 끝날 때만 내린다
  const loadList = useCallback(async () => {
    const res = await listCostSimulationsAction()
    setMessage(res.success ? '' : res.message)
    setRows(res.data)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadList()
    listClientsForCostingAction().then((r) => {
      if (r.success) setClients(r.data)
    })
  }, [loadList])

  const r = useMemo(() => calcCosting(v, parts), [v, parts])
  const verdict = verdictOf(r)
  const n = r.inputs

  const set = (key: NumKey) => (value: number) =>
    setV((prev) => {
      const next = { ...prev, [key]: value }
      // 기본매수를 적으면 예상 월 매수도 같은 값으로 채운다 (다르면 그 칸에서 고치면 된다)
      if (key === 'basicBw' && prev.bwA4 === prev.basicBw) next.bwA4 = value
      if (key === 'basicCol' && prev.colA4 === prev.basicCol) next.colA4 = value
      return next
    })

  const toggle = (key: 'showMachine' | 'showVolume' | 'showFixed') => () =>
    setV((prev) => ({ ...prev, [key]: !prev[key] }))

  const startNew = () => {
    setEditId(null)
    setName('')
    setClientId('')
    setModel('')
    setV(DEFAULT_INPUTS)
    setParts(DEFAULT_PARTS)
    setMode('edit')
  }

  const openRow = async (id: string) => {
    const res = await getCostSimulationAction(id)
    if (!res.success || !res.data) {
      toast.error(res.message)
      return
    }
    const row = res.data
    setEditId(row.id)
    setName(row.name || '')
    setClientId(row.client_id || '')
    setModel(row.model || '')
    setV({ ...DEFAULT_INPUTS, ...(row.inputs || {}) })
    setParts(Array.isArray(row.parts) && row.parts.length ? row.parts : DEFAULT_PARTS)
    setMode('edit')
  }

  const save = async () => {
    if (!name.trim()) {
      toast.error('계산 이름을 넣어주세요.')
      return
    }
    setSaving(true)
    const res = await saveCostSimulationAction({
      id: editId || undefined,
      name: name.trim(),
      client_id: clientId || null,
      client_name: clients.find((c) => c.id === clientId)?.name || null,
      model: model.trim() || null,
      inputs: v,
      parts,
    })
    setSaving(false)
    if (!res.success) {
      toast.error(res.message)
      return
    }
    if (res.id) setEditId(res.id)
    toast(res.message)
    loadList()
  }

  const removeRow = async (row: CostSimulationRow) => {
    const ok = await confirm({
      title: '이 계산을 삭제할까요?',
      description: `${row.name} — 되돌릴 수 없습니다.`,
      danger: true,
    })
    if (!ok) return
    const res = await deleteCostSimulationAction(row.id)
    if (!res.success) {
      toast.error(res.message)
      return
    }
    toast(res.message)
    if (editId === row.id) setEditId(null)
    loadList()
  }

  const updatePart = (idx: number, patch: Partial<CostPart>) =>
    setParts((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)))

  const perBw = perPageCons(parts, 'bw')
  const perCol = perPageCons(parts, 'col')

  if (mode === 'list') {
    return (
      <>
        <PageHeader
          title="원가계산"
          description="복합기 렌탈 계약이 남는 장사인지, 기계값을 언제 회수하는지 계산합니다."
          actions={<Button onClick={startNew}>새 계산</Button>}
        />

        {message ? <p className={styles.note}>{message}</p> : null}

        {loading ? (
          <p className={styles.empty}>불러오는 중…</p>
        ) : rows.length === 0 ? (
          <p className={styles.empty}>저장한 계산이 없습니다.</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>이름</th>
                <th>거래처</th>
                <th>모델</th>
                <th className="num">월 렌탈료</th>
                <th className="num">월 순이익</th>
                <th className="num">순이익률</th>
                <th className="center">회수</th>
                <th className="center">수정일</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <button type="button" className={styles.linkButton} onClick={() => openRow(row.id)}>
                      {row.name || '(이름 없음)'}
                    </button>
                  </td>
                  <td>{row.client_name || '-'}</td>
                  <td>{row.model || '-'}</td>
                  <td className="num">{won(row.summary?.revenue || 0)}</td>
                  <td className="num">{won(row.summary?.profit || 0)}</td>
                  <td className="num">{(row.summary?.margin ?? 0).toFixed(1)}%</td>
                  <td className="center">
                    {row.summary?.payback === null
                      ? '회수 불가'
                      : row.summary?.payback === 0
                        ? '즉시'
                        : `${row.summary?.payback}개월`}
                  </td>
                  <td className="center">{(row.updated_at || '').slice(0, 10)}</td>
                  <td>
                    <div className={styles.rowActions}>
                      <Button variant="secondary" onClick={() => openRow(row.id)}>
                        열기
                      </Button>
                      <Button variant="danger" onClick={() => removeRow(row)}>
                        삭제
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </>
    )
  }

  return (
    <>
      <PageHeader
        title={editId ? '원가계산 수정' : '원가계산'}
        description="숨긴 구역은 계산에서 빠집니다. 예상 월 매수를 접으면 기본매수만큼 쓴다고 봅니다."
        actions={
          <>
            <Button variant="secondary" onClick={() => setMode('list')}>
              목록
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? '저장 중…' : '저장'}
            </Button>
          </>
        }
      />

      <div className={styles.saveRow}>
        <Input
          label="계산 이름"
          containerClassName={styles.saveName}
          value={name}
          onChange={(e) => setName((e.target as HTMLInputElement).value)}
          placeholder="예: 세종병원 C3330 36개월"
        />
        <Input
          label="거래처"
          as="select"
          containerClassName={styles.saveField}
          value={clientId}
          onChange={(e) => setClientId((e.target as HTMLSelectElement).value)}
        >
          <option value="">선택 없음</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Input>
        <Input
          label="모델"
          containerClassName={styles.saveField}
          value={model}
          onChange={(e) => setModel((e.target as HTMLInputElement).value)}
          placeholder="예: C3330"
        />
      </div>

      <div className={styles.layout} style={{ marginTop: 'var(--sp-8)' }}>
        <div className={styles.col}>
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>계약 · 요금제</h2>
            </div>
            <div className={styles.grid2}>
              <NumInput label="기본 렌탈료 (원/월)" value={v.fee} onChange={set('fee')} />
              <NumInput label="계약기간 (개월)" value={v.months} onChange={set('months')} />
              <NumInput label="기본매수 흑백" value={v.basicBw} onChange={set('basicBw')} />
              <NumInput label="추가단가 흑백 (원/장)" value={v.priceBw} onChange={set('priceBw')} />
              <NumInput label="기본매수 칼라" value={v.basicCol} onChange={set('basicCol')} />
              <NumInput label="추가단가 칼라 (원/장)" value={v.priceCol} onChange={set('priceCol')} />
              <NumInput label="A3 가중치 (청구)" value={v.wBill} onChange={set('wBill')} />
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>기계 원가</h2>
              <button type="button" className={styles.toggle} onClick={toggle('showMachine')}>
                {v.showMachine ? '숨기기' : '펼치기'}
              </button>
            </div>
            <div className={styles.grid2}>
              <NumInput label="매입가 (원)" value={v.buy} onChange={set('buy')} />
            </div>
            {v.showMachine ? (
              <div className={`${styles.grid2} ${styles.subGrid}`}>
                <NumInput label="감가 기간 (개월)" value={v.life} onChange={set('life')} placeholder="계약기간" />
                <NumInput label="설치 · 운송비" value={v.setup} onChange={set('setup')} />
                <NumInput label="초기 장착 소모품" value={v.initToner} onChange={set('initToner')} />
                <NumInput label="보증금 (참고)" value={v.deposit} onChange={set('deposit')} />
              </div>
            ) : null}
            <p className={styles.note}>
              {n.life === n.months
                ? `감가는 계약기간 ${n.months}개월로 자동 계산합니다. 다른 기간으로 보려면 펼쳐서 감가 기간을 넣으세요.`
                : `감가 기간을 ${n.life}개월로 지정했습니다. 비우면 계약기간 ${n.months}개월로 돌아갑니다.`}
            </p>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>예상 월 매수</h2>
              <button type="button" className={styles.toggle} onClick={toggle('showVolume')}>
                {v.showVolume ? '숨기기' : '펼치기'}
              </button>
            </div>
            {v.showVolume ? (
              <div className={styles.grid2}>
                <NumInput label="흑백 A4" value={v.bwA4} onChange={set('bwA4')} />
                <NumInput label="흑백 A3" value={v.bwA3} onChange={set('bwA3')} />
                <NumInput label="칼라 A4" value={v.colA4} onChange={set('colA4')} />
                <NumInput label="칼라 A3" value={v.colA3} onChange={set('colA3')} />
                <NumInput label="A3 가중치 (소모품)" value={v.wCons} onChange={set('wCons')} />
              </div>
            ) : (
              <p className={styles.note}>
                접어 두면 고객이 기본매수만큼 찍는다고 봅니다 — 흑백 {pages(v.basicBw)}, 칼라 {pages(v.basicCol)}.
              </p>
            )}
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>월 고정비</h2>
              <button type="button" className={styles.toggle} onClick={toggle('showFixed')}>
                {v.showFixed ? '숨기기' : '펼치기'}
              </button>
            </div>
            {v.showFixed ? (
              <div className={styles.grid2}>
                <NumInput label="월 방문 횟수" value={v.visits} onChange={set('visits')} />
                <NumInput label="방문 1회 원가" value={v.visitCost} onChange={set('visitCost')} />
                <NumInput label="그 밖의 월 고정비" value={v.otherFixed} onChange={set('otherFixed')} />
              </div>
            ) : (
              <p className={styles.note}>접어 두면 고정비는 0원으로 봅니다.</p>
            )}
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>소모품</h2>
              <button type="button" className={styles.toggle} onClick={() => setShowParts((x) => !x)}>
                {showParts ? '숨기기' : '펼치기'}
              </button>
            </div>
            {!showParts ? (
              <p className={styles.note}>
                {parts.length}개 · 1장당 흑백 {perBw.toFixed(2)}원 · 칼라 {perCol.toFixed(2)}원 · 월 소모품비{' '}
                {won(r.consumable)}
              </p>
            ) : null}
            {showParts ? parts.map((p, idx) => {
              // 라벨은 첫 줄에만 — 아래 줄까지 반복하면 영역만 높아진다
              const lab = (cls: string) => (idx === 0 ? cls : `${cls} ${styles.hideLabels}`)
              return (
              <div className={styles.partRow} key={`${p.name}-${idx}`}>
                <Input
                  label="이름"
                  containerClassName={lab(styles.partName)}
                  value={p.name}
                  onChange={(e) => updatePart(idx, { name: (e.target as HTMLInputElement).value })}
                />
                <Input
                  label="단가"
                  inputMode="decimal"
                  className={styles.num}
                  containerClassName={lab(styles.partSmall)}
                  value={withCommas(p.price)}
                  onChange={(e) => updatePart(idx, { price: parseNum((e.target as HTMLInputElement).value) })}
                />
                <Input
                  label="라이프"
                  inputMode="decimal"
                  className={styles.num}
                  containerClassName={lab(styles.partSmall)}
                  value={withCommas(p.life)}
                  onChange={(e) => updatePart(idx, { life: parseNum((e.target as HTMLInputElement).value) })}
                />
                <Input
                  label="수"
                  inputMode="decimal"
                  className={styles.num}
                  containerClassName={lab(styles.partTiny)}
                  value={String(p.qty)}
                  onChange={(e) => updatePart(idx, { qty: parseNum((e.target as HTMLInputElement).value) || 1 })}
                />
                <Input
                  label="적용"
                  as="select"
                  containerClassName={lab(styles.partApply)}
                  value={p.apply}
                  onChange={(e) => updatePart(idx, { apply: (e.target as HTMLSelectElement).value as PartApply })}
                >
                  {(['all', 'bw', 'col'] as PartApply[]).map((a) => (
                    <option key={a} value={a}>
                      {APPLY_LABEL[a]}
                    </option>
                  ))}
                </Input>
                <div className={styles.partEnd}>
                  <span className={styles.partUsed}>
                    {(() => {
                      const totalUse = unitsPerMonth(p, r.bwPages, r.colPages) * n.months
                      const q = p.qty || 1
                      const cyc = cycleMonths(p, r.bwPages, r.colPages)
                      const use = q > 1 ? `${ea(totalUse / q)}×${q}` : ea(totalUse)
                      return `계약 ${use}${cyc ? ` · ${cycleText(cyc)}` : ''}`
                    })()}
                  </span>
                  <Button
                    variant="danger"
                    onClick={() => setParts((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    삭제
                  </Button>
                </div>
              </div>
              )
            }) : null}
            {showParts ? (
            <div className={styles.partsFoot}>
              <Button
                variant="secondary"
                onClick={() =>
                  setParts((prev) => [...prev, { name: '새 소모품', price: 0, life: 10000, qty: 1, apply: 'all' }])
                }
              >
                <Plus size={14} strokeWidth={1.5} /> 소모품 추가
              </Button>
              <span className={styles.perPage}>
                1장당 — 흑백 {perBw.toFixed(2)}원 · 칼라 {perCol.toFixed(2)}원
              </span>
            </div>
            ) : null}
          </section>
        </div>

        <div className={styles.col}>
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>판정</h2>
              <span className={styles.sectionNote}>
                {v.showVolume ? '예상 ' : '기본매수 '}
                {pages(r.totalPages)}/월
              </span>
            </div>

            <div className={styles.kpis}>
              <div className={styles.kpi}>
                <div className={styles.kpiLabel}>월 렌탈료</div>
                <div className={styles.kpiValue}>
                  {won(r.revenue)}
                  <span className={styles.kpiSub}>기본료 + 추가금액</span>
                </div>
              </div>
              <div className={styles.kpi}>
                <div className={styles.kpiLabel}>월 순이익</div>
                <div className={`${styles.kpiValue} ${r.profit < 0 ? styles.negText : ''}`}>{won(r.profit)}</div>
              </div>
              <div className={styles.kpi}>
                <div className={styles.kpiLabel}>순이익률</div>
                <div className={styles.kpiValue}>
                  {pct(r.profit, r.revenue)}
                  <span className={styles.kpiSub}>렌탈료 대비</span>
                </div>
              </div>
              <div className={styles.kpi}>
                <div className={styles.kpiLabel}>기계 원가 회수</div>
                <div className={styles.kpiValue}>
                  {r.payback === null ? (
                    <>
                      회수 불가<span className={styles.kpiSub}>남는 돈 없음</span>
                    </>
                  ) : r.payback === 0 ? (
                    <>
                      즉시<span className={styles.kpiSub}>기계값 없음</span>
                    </>
                  ) : (
                    <>
                      {r.payback}개월<span className={styles.kpiSub}>계약 {n.months}개월</span>
                    </>
                  )}
                </div>
              </div>
              <div className={styles.kpi}>
                <div className={styles.kpiLabel}>계약 총 렌탈료</div>
                <div className={styles.kpiValue}>
                  {won(r.totalRevenue)}
                  <span className={styles.kpiSub}>{n.months}개월</span>
                </div>
              </div>
              <div className={styles.kpi}>
                <div className={styles.kpiLabel}>계약 종료 시 누적 이익</div>
                <div className={`${styles.kpiValue} ${r.totalProfit < 0 ? styles.negText : ''}`}>
                  {won(r.totalProfit)}
                  <span className={styles.kpiSub}>{n.months}개월</span>
                </div>
              </div>
            </div>

            <div className={styles.verdict}>
              <div className={`${styles.verdictTitle} ${styles[verdict.tone]}`}>{verdict.title}</div>
              <p className={styles.verdictWhy}>
                월 렌탈료 {won(r.revenue)} 중 기계 감가 {won(r.depreciation)} ({pct(r.depreciation, r.revenue)}), 소모품{' '}
                {won(r.consumable)} ({pct(r.consumable, r.revenue)})
                {v.showVolume ? '' : ' — 기본매수 기준'}
                {v.showFixed ? `, 고정비 ${won(r.fixed)} (${pct(r.fixed, r.revenue)})` : ''}, 순이익 {won(r.profit)} (
                {pct(r.profit, r.revenue)}).
              </p>
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>월 렌탈료 내역</h2>
            </div>
            {(() => {
              // 적자면 비용이 막대를 가득 채운다 — 남는 칸이 없다는 게 곧 적자라는 뜻
              const spent = r.depreciation + r.consumable + r.fixed
              const denom = Math.max(r.revenue, spent) || 1
              const w = (x: number) => `${((Math.max(0, x) / denom) * 100).toFixed(2)}%`
              return (
                <div className={`${styles.bar} ${r.profit < 0 ? styles.barLoss : ''}`} aria-hidden="true">
                  <span className={styles.segDep} style={{ width: w(r.depreciation) }} />
                  <span className={styles.segCons} style={{ width: w(r.consumable) }} />
                  {v.showFixed ? <span className={styles.segFix} style={{ width: w(r.fixed) }} /> : null}
                  <span className={styles.segProfit} style={{ width: w(r.profit) }} />
                </div>
              )
            })()}
            <div className={styles.lines}>
              <div className={styles.line}>
                <span className={styles.lineLabel}>월 렌탈료</span>
                <span className={styles.lineValues}>
                  <span className={styles.lineValue}>{won(r.revenue)}</span>
                  <span className={styles.linePct} />
                </span>
              </div>
              <div className={styles.line}>
                <span className={`${styles.lineLabel} ${styles.lineNamed}`}>
                  기계 감가<span className={`${styles.dot} ${styles.dotDep}`} />
                  <span className={styles.lineBasis}>({n.life}개월로 나눔)</span>
                </span>
                <span className={styles.lineValues}>
                  <span className={styles.lineValue}>{won(r.depreciation)}</span>
                  <span className={styles.linePct}>{pct(r.depreciation, r.revenue)}</span>
                </span>
              </div>
              <div className={styles.line}>
                <span className={`${styles.lineLabel} ${styles.lineNamed}`}>
                  소모품비<span className={`${styles.dot} ${styles.dotCons}`} />
                  <span className={styles.lineBasis}>
                    ({v.showVolume ? '예상 월 ' : '기본매수 '}
                    {pages(r.bwPages + r.colPages)} 기준)
                  </span>
                </span>
                <span className={styles.lineValues}>
                  <span className={styles.lineValue}>{won(r.consumable)}</span>
                  <span className={styles.linePct}>{pct(r.consumable, r.revenue)}</span>
                </span>
              </div>
              {v.showFixed ? (
                <div className={styles.line}>
                  <span className={`${styles.lineLabel} ${styles.lineNamed}`}>
                    월 고정비<span className={`${styles.dot} ${styles.dotFix}`} />
                  </span>
                  <span className={styles.lineValues}>
                    <span className={styles.lineValue}>{won(r.fixed)}</span>
                    <span className={styles.linePct}>{pct(r.fixed, r.revenue)}</span>
                  </span>
                </div>
              ) : null}
              <div className={`${styles.line} ${styles.lineTotal}`}>
                <span className={`${styles.lineLabel} ${styles.lineNamed}`}>
                  순이익<span className={`${styles.dot} ${r.profit < 0 ? styles.dotLoss : styles.dotProfit}`} />
                </span>
                <span className={styles.lineValues}>
                  <span className={`${styles.lineValue} ${r.profit < 0 ? styles.negText : ''}`}>{won(r.profit)}</span>
                  <span className={styles.linePct}>{pct(r.profit, r.revenue)}</span>
                </span>
              </div>
            </div>
            <p className={styles.breakdown}>
              {v.showVolume ? (
                <>
                  기본료 {won(v.fee)} + (흑백 초과 {pages(r.extraBw)} × {won(v.priceBw)}) + (칼라 초과{' '}
                  {pages(r.extraCol)} × {won(v.priceCol)})
                  <br />= 기본 {withCommas(Math.round(v.fee))} + 초과 {withCommas(Math.round(r.extraAmount))}
                </>
              ) : (
                <>
                  기본료 {won(v.fee)}
                  <br />
                  기본매수만큼만 쓴다고 보아 추가금액은 0원
                </>
              )}
              <br />
              <span className={styles.breakdownSum}>= {won(r.revenue)}</span>
              {v.deposit > 0 ? (
                <>
                  <br />
                  보증금 {won(v.deposit)} 별도
                </>
              ) : null}
            </p>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>깎아줄 수 있는 한계</h2>
              <span className={styles.sectionNote}>기본매수만 쓸 때 기준</span>
            </div>
            <div className={styles.lines}>
              {(() => {
                const feeMin = Math.ceil(r.limits.feeMin)
                const feeRoom = v.fee - feeMin
                const lines: { name: string; now: string; limit: string; room: string; ok: boolean }[] = [
                  {
                    name: '기본 렌탈료',
                    now: `현재 ${won(v.fee)}`,
                    limit: `${won(feeMin)} 아래부터 적자`,
                    room: feeRoom >= 0 ? `여유 ${won(feeRoom)}` : `${won(-feeRoom)} 더 받아야 함`,
                    ok: feeRoom >= 0,
                  },
                ]
                const pageLine = (label: string, now: number, max: number | null) => {
                  if (max === null) {
                    lines.push({
                      name: label,
                      now: `현재 ${pages(now)}`,
                      limit: '제한 없음',
                      room: '소모품비가 0원',
                      ok: true,
                    })
                    return
                  }
                  if (max < 0) {
                    // 기본매수를 0장으로 해도 적자 — 렌탈료나 비용을 손봐야 한다
                    lines.push({
                      name: label,
                      now: `현재 ${pages(now)}`,
                      limit: '0장으로 해도 적자',
                      room: '렌탈료를 올려야 함',
                      ok: false,
                    })
                    return
                  }
                  const limit = Math.floor(max)
                  const room = limit - now
                  lines.push({
                    name: label,
                    now: `현재 ${pages(now)}`,
                    limit: `${pages(limit)} 이상부터 적자`,
                    room: room >= 0 ? `여유 ${pages(room)}` : `${pages(-room)} 줄여야 함`,
                    ok: room >= 0,
                  })
                }
                pageLine('기본매수 흑백', v.basicBw, r.limits.bwMax)
                pageLine('기본매수 칼라', v.basicCol, r.limits.colMax)

                return lines.map((l) => (
                  <div className={styles.line} key={l.name}>
                    <span className={styles.lineLabel}>
                      {l.name}
                      <span className={styles.lineBasis}>{l.now}</span>
                    </span>
                    <span className={styles.lineValues}>
                      <span className={styles.lineValue}>{l.limit}</span>
                      <span className={`${styles.linePct} ${l.ok ? '' : styles.negText}`}>{l.room}</span>
                    </span>
                  </div>
                ))
              })()}
            </div>
            <p className={styles.note}>
              고객이 기본매수만큼 찍는다고 보고(초과금은 수입으로 안 잡음) 계산한 마지노선입니다. 비용은 기계 감가 + 월
              고정비 + 기본매수만큼의 소모품비. 한 가지만 깎았을 때 기준이라, 렌탈료와 기본매수를 같이 깎으면 한계가 더
              빨리 옵니다.
            </p>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>소모품 사용량</h2>
              <button type="button" className={styles.toggle} onClick={() => setShowUsage((x) => !x)}>
                {showUsage ? '숨기기' : '펼치기'}
              </button>
            </div>
            {!showUsage ? (
              <p className={styles.note}>
                계약 {n.months}개월 소모품비 {won(r.consumable * n.months)} — 펼치면 품목별 교체 주기와 준비 개수가
                나옵니다.
              </p>
            ) : (
            <Table>
              <thead>
                <tr>
                  <th>구분</th>
                  <th className="center">교체 주기</th>
                  <th className="num">월 사용</th>
                  <th className="num">계약기간</th>
                  <th className="num">준비</th>
                  <th className="num">비용</th>
                </tr>
              </thead>
              <tbody>
                {parts.map((p, idx) => {
                  const perMonth = unitsPerMonth(p, r.bwPages, r.colPages)
                  const total = perMonth * n.months
                  const cost = total * p.price
                  const qty = p.qty || 1
                  const perUnit = total / qty
                  const buyPerUnit = Math.ceil(perUnit)
                  return (
                    <Fragment key={`${p.name}-${idx}`}>
                      <tr>
                        <td>
                          {p.name}
                          {qty > 1 ? ' (1개 기준)' : ''}
                        </td>
                        <td className="center">{cycleText(cycleMonths(p, r.bwPages, r.colPages))}</td>
                        <td className="num">{ea(perMonth / qty)}</td>
                        <td className="num">{ea(perUnit)}</td>
                        <td className="num">{buyPerUnit}개</td>
                        <td className="num">{won(cost / qty)}</td>
                      </tr>
                      {qty > 1 ? (
                        <tr>
                          <td>{qty}개 합계</td>
                          <td className="center">-</td>
                          <td className="num">{ea(perMonth)}</td>
                          <td className="num">{ea(total)}</td>
                          <td className="num">{buyPerUnit * qty}개</td>
                          <td className="num">{won(cost)}</td>
                        </tr>
                      ) : null}
                    </Fragment>
                  )
                })}
                <tr className="total">
                  <td>합계</td>
                  <td />
                  <td />
                  <td />
                  <td />
                  <td className="num">{won(r.consumable * n.months)}</td>
                </tr>
              </tbody>
            </Table>
            )}
          </section>
        </div>
      </div>
    </>
  )
}
