export const DEFAULT_ISSUER = {
  issuer_company: '크린솔루션',
  issuer_partner: '한국후지필름비즈니스이노베이션',
  issuer_ceo: '송경환',
  issuer_biz_no: '519-33-01796',
  issuer_address: '서울특별시 영등포구 대림동1121번지 신대림자이아파트상가101동107-5호',
  issuer_manager: '송경환',
  issuer_tel: '(02)877-4300',
  issuer_hp: '010-6622-7540',
  issuer_homepage: 'https://fbkrclean.modoo.at/',
  issuer_blog: 'https://blog.naver.com/xeroxclean',
}

export const DEFAULT_FOOTER_NOTICE =
  '■ 문의 사항이 있으시면 담당자에게 연락주십시요. 최선을 다하여 답변해 드리겠습니다. (부재시에는 호출 바랍니다.)'

/** 임대 정보 표 기본값 (공급가액 칸에 표시) */
export const DEFAULT_MFP_AMOUNT_TEMPLATE = `보증금: 면제
기본요금: 흑: 1000매 / 칼: 100매
추가요금: 흑: 10원 / 칼라: A4 100원, A3 200원/장당`

export type LeaseInfoFields = {
  deposit: string
  baseFee: string
  extraFee: string
}

export const DEFAULT_LEASE_INFO_FIELDS: LeaseInfoFields = {
  deposit: '면제',
  baseFee: '흑: 1000매 / 칼: 100매',
  extraFee: '흑: 10원 / 칼라: A4 100원, A3 200원/장당',
}

export function formatLeaseInfo(fields: LeaseInfoFields): string {
  return [
    `보증금: ${fields.deposit ?? ''}`.trimEnd(),
    `기본요금: ${fields.baseFee ?? ''}`.trimEnd(),
    `추가요금: ${fields.extraFee ?? ''}`.trimEnd(),
  ].join('\n')
}

export function parseLeaseInfo(text: string | null | undefined): LeaseInfoFields {
  const out: LeaseInfoFields = { deposit: '', baseFee: '', extraFee: '' }
  const raw = String(text || '').trim()
  if (!raw) return { ...DEFAULT_LEASE_INFO_FIELDS }

  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^(보증금|기본요금|추가요금)\s*[:：]\s*(.*)$/)
    if (!m) continue
    const value = m[2].trim()
    if (m[1] === '보증금') out.deposit = value
    else if (m[1] === '기본요금') out.baseFee = value
    else if (m[1] === '추가요금') out.extraFee = value
  }

  // 구형 양식(라벨만 또는 값만)이면 통째로 기본요금에 두지 않고, 파싱 실패 시 원문 유지
  if (!out.deposit && !out.baseFee && !out.extraFee) {
    return { deposit: '', baseFee: raw, extraFee: '' }
  }
  return out
}

export type QuoteNotePreset = {
  id: string
  name: string
  content: string
}

export const DEFAULT_NOTE_PRESETS: QuoteNotePreset[] = [
  {
    id: 'lease',
    name: '복합기 임대',
    content:
      '1. 상기 금액은 부가세 별도입니다.\n2. 계약 기간 및 납기일은 협의 후 확정합니다.\n3. 소모품·유지보수는 별도 약정에 따릅니다.',
  },
  {
    id: 'sale',
    name: '판매(매매)',
    content:
      '1. 상기 금액은 부가세 별도입니다.\n2. 납기일은 발주 후 협의합니다.\n3. 설치·교육은 별도 협의합니다.',
  },
]
