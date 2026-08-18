import {
  DEFAULT_FOOTER_NOTICE,
  DEFAULT_ISSUER,
  DEFAULT_MFP_AMOUNT_TEMPLATE,
  DEFAULT_NOTE_PRESETS,
  formatLeaseInfo,
  parseLeaseInfo,
  type QuoteNotePreset,
} from '@/utils/quoteDefaults'

/** 앱 전역 설정 (로컬 저장, 조직/브라우저 단위) */

export type AppSettings = {
  general: {
    /** 사이드바/헤더 등에 표시할 이름 (비우면 기본명) */
    appDisplayName: string
    /** 홈 대시보드 안내 문구 */
    dashboardNote: string
  }
  clients: {
    defaultStatus: 'active' | 'inactive'
  }
  inventory: {
    defaultStatus: string
    defaultBillingDate: string
    defaultCategory: string
    defaultMachineType: string
  }
  stock: {
    /** 이 수량 미만이면 재고 부족 강조 */
    lowStockThreshold: number
    consumableCategories: string[]
    partCategories: string[]
    otherCategories: string[]
  }
  service: {
    defaultStatus: string
    defaultServiceType: string
    serviceTypes: string[]
    /** 완료 시 재고 차감 안내 표시 */
    showStockDeductHint: boolean
  }
  accounting: {
    /** 전월 정산 없이 초기 카운터 사용 시 확인 창 */
    confirmWhenUsingInitialCounter: boolean
    /** 미정산만 보기 기본값 */
    defaultShowUnregistered: boolean
  }
  quotes: {
    defaultIntro: string
    defaultFooterNotice: string
    /** 임대 정보 표 기본값 */
    mfpAmountTemplate: string
    notePresets: QuoteNotePreset[]
    issuer_company: string
    issuer_partner: string
    issuer_ceo: string
    issuer_biz_no: string
    issuer_address: string
    issuer_manager: string
    issuer_tel: string
    issuer_hp: string
    issuer_homepage: string
    issuer_blog: string
  }
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  general: {
    appDisplayName: 'My Clean ERP',
    dashboardNote: '',
  },
  clients: {
    defaultStatus: 'active',
  },
  inventory: {
    defaultStatus: '창고',
    defaultBillingDate: '말일',
    defaultCategory: '컬러',
    defaultMachineType: 'A3 레이저복합기',
  },
  stock: {
    lowStockThreshold: 5,
    consumableCategories: ['토너', '드럼', '현상기', '폐토너통', '용지'],
    partCategories: ['부품', '롤러', '기어', 'Fuser'],
    otherCategories: ['기타'],
  },
  service: {
    defaultStatus: '접수',
    defaultServiceType: 'A/S',
    serviceTypes: ['A/S', '정기점검', '설치', '철수', '배송'],
    showStockDeductHint: true,
  },
  accounting: {
    confirmWhenUsingInitialCounter: true,
    defaultShowUnregistered: false,
  },
  quotes: {
    defaultIntro: '아래와 같이 見積합니다.',
    defaultFooterNotice: DEFAULT_FOOTER_NOTICE,
    mfpAmountTemplate: DEFAULT_MFP_AMOUNT_TEMPLATE,
    notePresets: structuredClone(DEFAULT_NOTE_PRESETS),
    ...DEFAULT_ISSUER,
  },
}

export const APP_SETTINGS_STORAGE_KEY = 'my-clean-erp-settings-v1'

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function mergeSettings(base: AppSettings, patch: unknown): AppSettings {
  if (!isPlainObject(patch)) return structuredClone(base)
  const out = structuredClone(base)
  for (const section of Object.keys(base) as (keyof AppSettings)[]) {
    const incoming = patch[section]
    if (!isPlainObject(incoming)) continue
    ;(out as any)[section] = { ...(base as any)[section], ...incoming }
  }
  // 배열 필드는 통째로 교체
  if (isPlainObject(patch.stock)) {
    const s = patch.stock
    if (Array.isArray(s.consumableCategories)) out.stock.consumableCategories = s.consumableCategories.map(String)
    if (Array.isArray(s.partCategories)) out.stock.partCategories = s.partCategories.map(String)
    if (Array.isArray(s.otherCategories)) out.stock.otherCategories = s.otherCategories.map(String)
    if (typeof s.lowStockThreshold === 'number' && Number.isFinite(s.lowStockThreshold)) {
      out.stock.lowStockThreshold = Math.max(0, Math.floor(s.lowStockThreshold))
    }
  }
  if (isPlainObject(patch.service) && Array.isArray(patch.service.serviceTypes)) {
    out.service.serviceTypes = patch.service.serviceTypes.map(String).filter(Boolean)
  }
  if (isPlainObject(patch.quotes)) {
    const q = patch.quotes
    if (Array.isArray(q.notePresets)) {
      out.quotes.notePresets = q.notePresets
        .filter((p): p is Record<string, unknown> => isPlainObject(p))
        .map((p, i) => ({
          id: String(p.id || `preset-${i + 1}`),
          name: String(p.name || `비고 ${i + 1}`),
          content: String(p.content || ''),
        }))
        .filter((p) => p.name.trim())
    }
    if (typeof q.defaultIntro === 'string') out.quotes.defaultIntro = q.defaultIntro
    if (typeof q.defaultFooterNotice === 'string') out.quotes.defaultFooterNotice = q.defaultFooterNotice
    if (typeof q.mfpAmountTemplate === 'string') {
      // 구형 양식(보증금: 없는 텍스트)이면 새 임대정보 기본값으로 교체
      if (!/^\s*보증금\s*[:：]/m.test(q.mfpAmountTemplate)) {
        out.quotes.mfpAmountTemplate = DEFAULT_MFP_AMOUNT_TEMPLATE
      } else {
        out.quotes.mfpAmountTemplate = formatLeaseInfo(parseLeaseInfo(q.mfpAmountTemplate))
      }
    }
  }
  return out
}

export function loadAppSettings(): AppSettings {
  if (typeof window === 'undefined') return structuredClone(DEFAULT_APP_SETTINGS)
  try {
    const raw = localStorage.getItem(APP_SETTINGS_STORAGE_KEY)
    if (!raw) return structuredClone(DEFAULT_APP_SETTINGS)
    return mergeSettings(DEFAULT_APP_SETTINGS, JSON.parse(raw))
  } catch {
    return structuredClone(DEFAULT_APP_SETTINGS)
  }
}

export function saveAppSettings(settings: AppSettings): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify(settings))
  window.dispatchEvent(new CustomEvent('app-settings-changed', { detail: settings }))
}

export function resetAppSettings(): AppSettings {
  const next = structuredClone(DEFAULT_APP_SETTINGS)
  saveAppSettings(next)
  return next
}

/** 카테고리 문자열 목록을 줄바꿈/쉼표로 편집하기 쉽게 직렬화 */
export function listToEditableText(list: string[]): string {
  return list.join('\n')
}

export function editableTextToList(text: string): string[] {
  return text
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}
