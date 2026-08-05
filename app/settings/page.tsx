'use client'

import { useEffect, useState } from 'react'
import Button from '@/components/ui/Button'
import AccountSettings from '@/components/settings/AccountSettings'
import styles from './settings.module.css'
import {
  AppSettings,
  DEFAULT_APP_SETTINGS,
  editableTextToList,
  listToEditableText,
  loadAppSettings,
  resetAppSettings,
  saveAppSettings,
} from '@/utils/appSettings'

type TabId = 'account' | 'general' | 'clients' | 'inventory' | 'stock' | 'service' | 'accounting'

const TABS: { id: TabId; label: string }[] = [
  { id: 'account', label: '계정' },
  { id: 'general', label: '일반' },
  { id: 'clients', label: '거래처' },
  { id: 'inventory', label: '자산' },
  { id: 'stock', label: '재고/소모품' },
  { id: 'service', label: '서비스 일지' },
  { id: 'accounting', label: '정산' },
]

const MACHINE_TYPES = [
  'A3 레이저복합기', 'A4 레이저복합기',
  'A3 레이저프린터', 'A4 레이저프린터',
  'A3 잉크젯복합기', 'A4 잉크젯복합기',
  'A3 잉크젯프린터', 'A4 잉크젯프린터',
]

const MACHINE_STATUSES = ['창고', '설치', '수리중', '폐기']

export default function SettingsPage() {
  const [tab, setTab] = useState<TabId>('account')
  const [draft, setDraft] = useState<AppSettings>(DEFAULT_APP_SETTINGS)
  const [ready, setReady] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)

  useEffect(() => {
    setDraft(loadAppSettings())
    setReady(true)
  }, [])

  const patch = <K extends keyof AppSettings>(key: K, partial: Partial<AppSettings[K]>) => {
    setDraft((prev) => ({ ...prev, [key]: { ...prev[key], ...partial } }))
  }

  const handleSave = () => {
    // 숫자/목록 정리
    const next: AppSettings = {
      ...draft,
      stock: {
        ...draft.stock,
        lowStockThreshold: Math.max(0, Math.floor(Number(draft.stock.lowStockThreshold) || 0)),
        consumableCategories: draft.stock.consumableCategories.map((s) => s.trim()).filter(Boolean),
        partCategories: draft.stock.partCategories.map((s) => s.trim()).filter(Boolean),
        otherCategories: draft.stock.otherCategories.map((s) => s.trim()).filter(Boolean),
      },
      service: {
        ...draft.service,
        serviceTypes: draft.service.serviceTypes.map((s) => s.trim()).filter(Boolean),
      },
    }
    if (next.service.serviceTypes.length === 0) {
      next.service.serviceTypes = [...DEFAULT_APP_SETTINGS.service.serviceTypes]
    }
    if (!next.service.serviceTypes.includes(next.service.defaultServiceType)) {
      next.service.defaultServiceType = next.service.serviceTypes[0]
    }
    setDraft(next)
    saveAppSettings(next)
    setSavedFlash(true)
    window.setTimeout(() => setSavedFlash(false), 2000)
  }

  const handleReset = () => {
    if (!confirm('모든 설정을 기본값으로 되돌릴까요?')) return
    setDraft(resetAppSettings())
    setSavedFlash(true)
    window.setTimeout(() => setSavedFlash(false), 2000)
  }

  if (!ready) {
    return <div className={styles.page}><p className={styles.subtitle}>설정을 불러오는 중…</p></div>
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>설정</h1>
      <p className={styles.subtitle}>
        계정(이름·비밀번호)과 각 페이지에서 쓰는 기본값·목록을 관리합니다. 앱 기본값은 이 브라우저에 저장됩니다.
      </p>

      <div className={styles.tabs} role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className={styles.section}>
        {tab === 'account' && <AccountSettings />}

        {tab === 'general' && (
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>일반</h2>
            <p className={styles.cardDesc}>앱 표시 이름과 홈 화면 안내입니다.</p>
            <div className={styles.field}>
              <label className={styles.label}>앱 표시 이름</label>
              <input
                className={styles.input}
                value={draft.general.appDisplayName}
                onChange={(e) => patch('general', { appDisplayName: e.target.value })}
                placeholder="My Clean ERP"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>홈 대시보드 메모</label>
              <textarea
                className={styles.textarea}
                value={draft.general.dashboardNote}
                onChange={(e) => patch('general', { dashboardNote: e.target.value })}
                placeholder="예: 매월 말일 전 정산 마감 확인"
              />
              <span className={styles.hint}>홈 화면에 안내로 표시됩니다. 비워 두면 숨깁니다.</span>
            </div>
          </div>
        )}

        {tab === 'clients' && (
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>거래처</h2>
            <p className={styles.cardDesc}>거래처 등록 시 기본값입니다.</p>
            <div className={styles.field}>
              <label className={styles.label}>신규 거래처 기본 상태</label>
              <select
                className={styles.select}
                value={draft.clients.defaultStatus}
                onChange={(e) => patch('clients', { defaultStatus: e.target.value as 'active' | 'inactive' })}
              >
                <option value="active">활성 (active)</option>
                <option value="inactive">비활성 (inactive)</option>
              </select>
            </div>
          </div>
        )}

        {tab === 'inventory' && (
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>자산 (기기)</h2>
            <p className={styles.cardDesc}>기기 신규 등록 폼의 기본값입니다.</p>
            <div className={styles.row}>
              <div className={styles.field}>
                <label className={styles.label}>기본 종류</label>
                <select
                  className={styles.select}
                  value={draft.inventory.defaultMachineType}
                  onChange={(e) => patch('inventory', { defaultMachineType: e.target.value })}
                >
                  {MACHINE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>기본 구분</label>
                <select
                  className={styles.select}
                  value={draft.inventory.defaultCategory}
                  onChange={(e) => patch('inventory', { defaultCategory: e.target.value })}
                >
                  <option value="컬러">컬러</option>
                  <option value="흑백">흑백</option>
                </select>
              </div>
            </div>
            <div className={styles.row}>
              <div className={styles.field}>
                <label className={styles.label}>기본 상태</label>
                <select
                  className={styles.select}
                  value={draft.inventory.defaultStatus}
                  onChange={(e) => patch('inventory', { defaultStatus: e.target.value })}
                >
                  {MACHINE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>기본 청구일</label>
                <select
                  className={styles.select}
                  value={draft.inventory.defaultBillingDate}
                  onChange={(e) => patch('inventory', { defaultBillingDate: e.target.value })}
                >
                  <option value="말일">매월 말일</option>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={String(d)}>매월 {d}일</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {tab === 'stock' && (
          <>
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>재고 알림</h2>
              <p className={styles.cardDesc}>자산·재고와 서비스 일지에서 부족한 재고를 강조할 기준입니다.</p>
              <div className={styles.field}>
                <label className={styles.label}>재고 부족 기준 (미만)</label>
                <input
                  className={styles.input}
                  type="number"
                  min={0}
                  value={draft.stock.lowStockThreshold}
                  onChange={(e) => patch('stock', { lowStockThreshold: Number(e.target.value) })}
                  style={{ maxWidth: 160 }}
                />
                <span className={styles.hint}>예: 5 → 재고가 5 미만이면 빨간색으로 표시</span>
              </div>
            </div>
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>카테고리 목록</h2>
              <p className={styles.cardDesc}>한 줄에 하나씩 입력하세요. 자산·재고 탭 분류와 등록 폼에 반영됩니다.</p>
              <div className={styles.row}>
                <div className={styles.field}>
                  <label className={styles.label}>소모품 (토너/드럼 탭)</label>
                  <textarea
                    className={styles.textarea}
                    value={listToEditableText(draft.stock.consumableCategories)}
                    onChange={(e) => patch('stock', { consumableCategories: editableTextToList(e.target.value) })}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>부품 (Parts 탭)</label>
                  <textarea
                    className={styles.textarea}
                    value={listToEditableText(draft.stock.partCategories)}
                    onChange={(e) => patch('stock', { partCategories: editableTextToList(e.target.value) })}
                  />
                </div>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>기타 자재</label>
                <textarea
                  className={styles.textarea}
                  value={listToEditableText(draft.stock.otherCategories)}
                  onChange={(e) => patch('stock', { otherCategories: editableTextToList(e.target.value) })}
                  style={{ minHeight: 70 }}
                />
              </div>
            </div>
          </>
        )}

        {tab === 'service' && (
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>서비스 일지</h2>
            <p className={styles.cardDesc}>일지 작성·표의 기본값과 구분 목록입니다.</p>
            <div className={styles.row}>
              <div className={styles.field}>
                <label className={styles.label}>기본 상태</label>
                <select
                  className={styles.select}
                  value={draft.service.defaultStatus}
                  onChange={(e) => patch('service', { defaultStatus: e.target.value })}
                >
                  <option value="접수">접수</option>
                  <option value="완료">완료</option>
                  <option value="보류">보류</option>
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>기본 구분</label>
                <select
                  className={styles.select}
                  value={draft.service.defaultServiceType}
                  onChange={(e) => patch('service', { defaultServiceType: e.target.value })}
                >
                  {draft.service.serviceTypes.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>서비스 구분 목록</label>
              <textarea
                className={styles.textarea}
                value={listToEditableText(draft.service.serviceTypes)}
                onChange={(e) => patch('service', { serviceTypes: editableTextToList(e.target.value) })}
              />
              <span className={styles.hint}>한 줄에 하나. 일지 표·작성 폼 드롭다운에 사용됩니다.</span>
            </div>
            <label className={styles.checkRow}>
              <input
                type="checkbox"
                checked={draft.service.showStockDeductHint}
                onChange={(e) => patch('service', { showStockDeductHint: e.target.checked })}
              />
              <span>
                <span className={styles.label}>완료 시 재고 차감 안내 표시</span>
                <div className={styles.hint}>일지 작성 폼에서 완료 저장 시 재고 연동 안내를 보여줍니다.</div>
              </span>
            </label>
          </div>
        )}

        {tab === 'accounting' && (
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>정산 / 청구</h2>
            <p className={styles.cardDesc}>월 정산 등록 화면의 기본 동작입니다.</p>
            <label className={styles.checkRow}>
              <input
                type="checkbox"
                checked={draft.accounting.confirmWhenUsingInitialCounter}
                onChange={(e) => patch('accounting', { confirmWhenUsingInitialCounter: e.target.checked })}
              />
              <span>
                <span className={styles.label}>전월 정산 없을 때 확인창</span>
                <div className={styles.hint}>
                  전월 정산이 없어 설치 초기 카운터를 전월로 쓸 때 저장 전 확인합니다.
                </div>
              </span>
            </label>
            <label className={styles.checkRow}>
              <input
                type="checkbox"
                checked={draft.accounting.defaultShowUnregistered}
                onChange={(e) => patch('accounting', { defaultShowUnregistered: e.target.checked })}
              />
              <span>
                <span className={styles.label}>미정산만 보기 기본 ON</span>
                <div className={styles.hint}>월 정산 등록 화면 진입 시 &apos;미정산만&apos;을 기본으로 켭니다.</div>
              </span>
            </label>
            <p className={styles.hint} style={{ marginTop: 8 }}>
              청구 합계 규칙: 공급가 + VAT(10% 내림) 후 10원 단위 절사 — 코드에 고정되어 있습니다.
            </p>
          </div>
        )}
      </div>

      {tab !== 'account' && (
        <div className={styles.footer}>
          {savedFlash && <span className={styles.saved}>저장되었습니다</span>}
          <Button variant="outline" type="button" onClick={handleReset}>기본값으로</Button>
          <Button variant="primary" type="button" onClick={handleSave}>설정 저장</Button>
        </div>
      )}
    </div>
  )
}
