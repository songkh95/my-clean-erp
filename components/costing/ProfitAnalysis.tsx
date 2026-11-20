'use client'

import { Fragment, useCallback, useEffect, useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronRight, Info } from 'lucide-react'
import Input from '@/components/ui/Input'
import PageHeader from '@/components/ui/PageHeader'
import Table from '@/components/ui/Table'
import { withCommas } from '@/utils/rentalCosting'
import {
  getProfitAnalysisAction,
  listSettlementYearsAction,
  type ProfitAnalysis as Analysis,
  type ProfitMode,
} from '@/app/actions/costingProfit'
import { listClientsForCostingAction } from '@/app/actions/costing'
import { getInventoryByIdAction } from '@/app/actions/inventory'
import InventoryForm from '@/components/inventory/InventoryForm'
import { toast } from '@/components/ui/Toast'
import { periodLabel } from '@/utils/profitAnalysis'
import styles from './ProfitAnalysis.module.css'

const won = (n: number) => `${n < 0 ? '−' : ''}${withCommas(Math.abs(Math.round(n)))}원`
const pct = (v: number) => `${(v * 100).toFixed(1)}%`
const pages = (n: number) => `${withCommas(Math.round(n))}장`

const QUARTERS = [1, 2, 3, 4]
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

const NOW = new Date()
const THIS_YEAR = NOW.getFullYear()
const THIS_MONTH = NOW.getMonth() + 1
const THIS_QUARTER = Math.floor(NOW.getMonth() / 3) + 1

export default function ProfitAnalysis() {
  const [mode, setMode] = useState<ProfitMode>('quarter')
  const [year, setYear] = useState(THIS_YEAR)
  const [unit, setUnit] = useState(THIS_QUARTER)
  const [clientId, setClientId] = useState('')

  const [years, setYears] = useState<number[]>([])
  const [clients, setClients] = useState<{ id: string; name: string }[]>([])
  const [data, setData] = useState<Analysis | null>(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [editMachine, setEditMachine] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    listSettlementYearsAction().then((r) => setYears(r.data || []))
    listClientsForCostingAction().then((r) => setClients(r.data || []))
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const res = await getProfitAnalysisAction({
      mode,
      year,
      unit,
      clientId: clientId || null,
    })
    setData(res.data)
    setMessage(res.success ? (res.data?.clients.length ? '' : res.message) : res.message)
    setLoading(false)
  }, [mode, year, unit, clientId])

  useEffect(() => {
    load()
  }, [load])

  /** 계약·원가 정보가 비어 계산에서 빠진 기계를 바로 고친다 */
  const openMachine = async (inventoryId: string) => {
    const res = await getInventoryByIdAction(inventoryId)
    if (!res.success || !res.data) {
      toast.error(res.message || '기기를 불러오지 못했습니다.')
      return
    }
    setEditMachine(res.data as Record<string, unknown>)
  }

  const unitOptions = mode === 'quarter' ? QUARTERS : mode === 'month' ? MONTHS : []
  const label = periodLabel(mode, year, unit)

  const yearOptions = Array.from(new Set<number>([...years, THIS_YEAR])).sort((a, b) => b - a)

  const t = data?.totals
  const denom = t ? Math.max(t.revenue, t.consumableActual + t.depreciation) || 1 : 1
  const w = (x: number) => `${((Math.max(0, x) / denom) * 100).toFixed(2)}%`

  const changeMode = (next: ProfitMode) => {
    setMode(next)
    if (next === 'quarter') setUnit(THIS_QUARTER)
    else if (next === 'month') setUnit(THIS_MONTH)
    else setUnit(1)
  }

  const warnings = data?.warnings
  const hasWarning =
    warnings &&
    (warnings.zeroPrice.length > 0 ||
      warnings.noLife.length > 0 ||
      warnings.noServiceLog.length > 0 ||
      warnings.reinstalled.length > 0)

  return (
    <>
      <PageHeader
        title="수익 분석"
        description="월 정산으로 확정된 매출에서 실제 원가를 빼 거래처·기계별 이익을 봅니다."
      />

      <div className={styles.filters}>
        <Input
          label="기간 단위"
          as="select"
          className={styles.filterField}
          containerClassName={styles.filterField}
          value={mode}
          onChange={(e) => changeMode(e.target.value as ProfitMode)}
        >
          <option value="month">월</option>
          <option value="quarter">분기</option>
          <option value="year">년</option>
        </Input>
        <Input
          label="연도"
          as="select"
          containerClassName={styles.filterField}
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>
              {y}년
            </option>
          ))}
        </Input>
        {unitOptions.length > 0 ? (
          <Input
            label={mode === 'quarter' ? '분기' : '월'}
            as="select"
            containerClassName={styles.filterField}
            value={unit}
            onChange={(e) => setUnit(Number(e.target.value))}
          >
            {unitOptions.map((u) => (
              <option key={u} value={u}>
                {mode === 'quarter' ? `${u}분기` : `${u}월`}
              </option>
            ))}
          </Input>
        ) : null}
        <Input
          label="거래처"
          as="select"
          containerClassName={styles.filterWide}
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
        >
          <option value="">전체</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Input>
      </div>

      {loading ? <p className={styles.empty}>불러오는 중…</p> : null}

      {!loading && data && data.blocked.length > 0 ? (
        <div className={styles.notices}>
          <div className={styles.notice}>
            <span className={`${styles.noticeIcon} ${styles.noticeBlock}`}>
              <AlertTriangle size="1em" aria-hidden />
            </span>
            <span>
              <span className={styles.noticeTitle}>
                원가 정보가 없어 계산에서 뺀 기계 {data.blocked.length}대
              </span>
              <ul className={styles.noticeList}>
                {data.blocked.map((b) => (
                  <li key={b.inventoryId}>
                    <button
                      type="button"
                      className={styles.linkButton}
                      onClick={() => openMachine(b.inventoryId)}
                    >
                      {b.clientName} · {b.model} ({b.serial})
                    </button>
                    <span className={styles.missing}> — {b.missing.join(', ')} 없음</span>
                  </li>
                ))}
              </ul>
              <span className={styles.noticeList}>
                줄을 누르면 그 기계의 계약·원가 정보를 바로 고칠 수 있습니다.
              </span>
            </span>
          </div>
        </div>
      ) : null}

      {!loading && hasWarning ? (
        <div className={styles.notices}>
          {warnings!.zeroPrice.length > 0 ? (
            <div className={styles.notice}>
              <span className={`${styles.noticeIcon} ${styles.noticeWarn}`}>
                <AlertTriangle size="1em" aria-hidden />
              </span>
              <span>
                <span className={styles.noticeTitle}>단가가 0원인 소모품이 있어 원가가 적게 잡힙니다</span>
                <ul className={styles.noticeList}>
                  {warnings!.zeroPrice.map((c) => (
                    <li key={c.id}>
                      {c.label}
                      {c.code ? <span className={styles.code}> {c.code}</span> : null}
                    </li>
                  ))}
                </ul>
                <span className={styles.noticeList}>재고 → 소모품에서 매입 단가를 등록하세요.</span>
              </span>
            </div>
          ) : null}

          {warnings!.noLife.length > 0 ? (
            <div className={styles.notice}>
              <span className={`${styles.noticeIcon} ${styles.noticeWarn}`}>
                <Info size="1em" aria-hidden />
              </span>
              <span>
                <span className={styles.noticeTitle}>라이프가 없어 환산 원가를 내지 못한 소모품</span>
                <ul className={styles.noticeList}>
                  {warnings!.noLife.map((c) => (
                    <li key={c.id}>
                      {c.label}
                      {c.code ? <span className={styles.code}> {c.code}</span> : null}
                    </li>
                  ))}
                </ul>
                <span className={styles.noticeList}>
                  재고 → 소모품에서 라이프(장)를 넣으면 환산 열이 채워집니다. 실제 이익은 그대로 나옵니다.
                </span>
              </span>
            </div>
          ) : null}

          {warnings!.noServiceLog.length > 0 ? (
            <div className={styles.notice}>
              <span className={`${styles.noticeIcon} ${styles.noticeWarn}`}>
                <Info size="1em" aria-hidden />
              </span>
              <span>
                <span className={styles.noticeTitle}>
                  매수는 늘었는데 이 기간 서비스 일지가 없는 기계 {warnings!.noServiceLog.length}대
                </span>
                <ul className={styles.noticeList}>
                  {warnings!.noServiceLog.slice(0, 8).map((m) => (
                    <li key={`${m.serial}-${m.model}`}>
                      {m.clientName} · {m.model} ({m.serial})
                    </li>
                  ))}
                </ul>
                <span className={styles.noticeList}>
                  소모품을 쓰고 일지를 안 썼다면 실제 원가가 적게 잡힙니다.
                </span>
              </span>
            </div>
          ) : null}

          {warnings!.reinstalled.length > 0 ? (
            <div className={styles.notice}>
              <span className={`${styles.noticeIcon} ${styles.noticeWarn}`}>
                <Info size="1em" aria-hidden />
              </span>
              <span>
                <span className={styles.noticeTitle}>
                  재설치 기계 {warnings!.reinstalled.length}대 — 감가가 이중으로 잡혔을 수 있습니다
                </span>
                <ul className={styles.noticeList}>
                  {warnings!.reinstalled.slice(0, 8).map((m) => (
                    <li key={`${m.serial}-${m.model}`}>
                      {m.clientName} · {m.model} ({m.serial})
                    </li>
                  ))}
                </ul>
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      {!loading && t && data && data.clients.length > 0 ? (
        <>
          <div className={styles.kpis}>
            <div className={styles.kpi}>
              <div className={styles.kpiLabel}>{label} 매출</div>
              <div className={styles.kpiValue}>{won(t.revenue)}</div>
            </div>
            <div className={styles.kpi}>
              <div className={styles.kpiLabel}>소모품비 (실제)</div>
              <div className={styles.kpiValue}>{won(t.consumableActual)}</div>
            </div>
            <div className={styles.kpi}>
              <div className={styles.kpiLabel}>소모품비 (환산)</div>
              <div className={styles.kpiValue}>
                {t.consumableEstimated == null ? (
                  <span className={styles.muted}>—</span>
                ) : (
                  won(t.consumableEstimated)
                )}
              </div>
            </div>
            <div className={styles.kpi}>
              <div className={styles.kpiLabel}>기계 감가</div>
              <div className={styles.kpiValue}>{won(t.depreciation)}</div>
            </div>
            <div className={styles.kpi}>
              <div className={styles.kpiLabel}>순이익 (실제)</div>
              <div className={`${styles.kpiValue} ${t.profitActual < 0 ? styles.neg : ''}`}>
                {won(t.profitActual)}
                <span className={styles.kpiSub}>{pct(t.marginActual)}</span>
              </div>
            </div>
            <div className={styles.kpi}>
              <div className={styles.kpiLabel}>순이익 (환산)</div>
              <div
                className={`${styles.kpiValue} ${
                  (t.profitEstimated ?? 0) < 0 && t.profitEstimated != null ? styles.neg : ''
                }`}
              >
                {t.profitEstimated == null ? (
                  <span className={styles.muted}>—</span>
                ) : (
                  <>
                    {won(t.profitEstimated)}
                    <span className={styles.kpiSub}>
                      {t.marginEstimated == null ? '' : pct(t.marginEstimated)}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div
            className={`${styles.bar} ${t.profitActual < 0 ? styles.barLoss : ''}`}
            aria-hidden="true"
          >
            <span className={styles.segCons} style={{ width: w(t.consumableActual) }} />
            <span className={styles.segDep} style={{ width: w(t.depreciation) }} />
            <span className={styles.segProfit} style={{ width: w(t.profitActual) }} />
          </div>
          <div className={styles.legend}>
            <span className={styles.legendItem}>
              <span className={`${styles.dot} ${styles.dotCons}`} /> 소모품비{' '}
              {pct(t.revenue > 0 ? t.consumableActual / t.revenue : 0)}
            </span>
            <span className={styles.legendItem}>
              <span className={`${styles.dot} ${styles.dotDep}`} /> 기계 감가{' '}
              {pct(t.revenue > 0 ? t.depreciation / t.revenue : 0)}
            </span>
            <span className={styles.legendItem}>
              <span className={`${styles.dot} ${styles.dotProfit}`} /> 순이익{' '}
              {pct(t.marginActual)}
            </span>
          </div>

          <Table>
            <thead>
              <tr>
                <th>거래처</th>
                <th className="num">매출</th>
                <th className="num">소모품 (실제)</th>
                <th className="num">소모품 (환산)</th>
                <th className="num">감가</th>
                <th className="num">순이익 (실제)</th>
                <th className="num">순이익 (환산)</th>
                <th className="num">이익률</th>
              </tr>
            </thead>
            <tbody>
              {data.clients.map((c) => {
                const isOpen = open[c.clientId]
                return (
                  <Fragment key={c.clientId}>
                    <tr>
                      <td>
                        <span className={styles.clientCell}>
                          <button
                            type="button"
                            className={styles.linkButton}
                            onClick={() => setOpen((p) => ({ ...p, [c.clientId]: !p[c.clientId] }))}
                            aria-expanded={Boolean(isOpen)}
                          >
                            {isOpen ? (
                              <ChevronDown size="1em" aria-hidden />
                            ) : (
                              <ChevronRight size="1em" aria-hidden />
                            )}
                            {c.clientName}
                          </button>
                          <span className={styles.muted}>{c.machines.length}대</span>
                        </span>
                      </td>
                      <td className="num">{won(c.totals.revenue)}</td>
                      <td className="num">{won(c.totals.consumableActual)}</td>
                      <td className={`num ${styles.muted}`}>
                        {c.totals.consumableEstimated == null
                          ? '—'
                          : won(c.totals.consumableEstimated)}
                      </td>
                      <td className="num">{won(c.totals.depreciation)}</td>
                      <td
                        className={`num ${
                          c.totals.profitActual < 0 ? styles.neg : ''
                        }`}
                      >
                        {won(c.totals.profitActual)}
                      </td>
                      <td className={`num ${styles.muted}`}>
                        {c.totals.profitEstimated == null ? '—' : won(c.totals.profitEstimated)}
                      </td>
                      <td
                        className={`num ${
                          c.totals.profitActual < 0 ? styles.neg : ''
                        }`}
                      >
                        {pct(c.totals.marginActual)}
                      </td>
                    </tr>
                    {isOpen
                      ? c.machines.map((m) => (
                          <tr key={m.inventoryId} className={styles.machineRow}>
                            <td className={styles.machineName}>
                              {m.model} · {m.serial}
                              {m.department ? ` · ${m.department}` : ''}
                              {m.reinstalled ? <span className={styles.tag}>재설치</span> : null}
                              {m.noServiceLog ? <span className={styles.tag}>일지 없음</span> : null}
                              <div className={styles.muted}>
                                {pages(m.usage.bw)} / 칼라 {pages(m.usage.col)} · {m.months}개월
                              </div>
                            </td>
                            <td className="num">{won(m.revenue)}</td>
                            <td className="num">{won(m.consumableActual)}</td>
                            <td className={`num ${styles.muted}`}>
                              {m.consumableEstimated == null ? '—' : won(m.consumableEstimated)}
                            </td>
                            <td className="num">{won(m.depreciation)}</td>
                            <td
                              className={`num ${m.profitActual < 0 ? styles.neg : ''}`}
                            >
                              {won(m.profitActual)}
                            </td>
                            <td className={`num ${styles.muted}`}>
                              {m.profitEstimated == null ? '—' : won(m.profitEstimated)}
                            </td>
                            <td className={`num ${styles.muted}`}>
                              {m.revenue > 0 ? pct(m.profitActual / m.revenue) : '-'}
                            </td>
                          </tr>
                        ))
                      : null}
                  </Fragment>
                )
              })}
            </tbody>
          </Table>

          <p className={styles.footNote}>
            매출은 월 정산에 등록된 기계별 청구액입니다. 소모품비 <strong>실제</strong>는 이 기간 서비스
            일지에 적힌 사용 수량 × 재고 단가이고, <strong>환산</strong>은 재고에 등록한 라이프로 낸 장당
            원가 × 실제 매수입니다. 월 단위에서는 실제 쪽이 교체 시기에 따라 크게 출렁이니 환산과 같이
            보세요. 감가는 (매입가 + 설치비 + 초기 소모품) ÷ 계약 개월수입니다.
          </p>
        </>
      ) : null}

      {!loading && (!data || data.clients.length === 0) ? (
        <p className={styles.empty}>{message || '보여줄 내용이 없습니다.'}</p>
      ) : null}

      <InventoryForm
        isOpen={editMachine !== null}
        onClose={() => setEditMachine(null)}
        onSuccess={() => {
          setEditMachine(null)
          load()
        }}
        editData={editMachine as never}
      />
    </>
  )
}
