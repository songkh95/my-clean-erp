/**
 * 화면 설정 (제목 글꼴, 본문 글꼴, 글자 크기)
 * 기준: docs/DESIGN_SYSTEM.md 3.1, 3.5
 *
 * 값은 AppSettings.general 에 저장되고, <html> 의 data 속성과
 * CSS 변수(--font-heading, --font-body)로 적용된다.
 */

export type FontOption = {
  id: string
  label: string
  /** CSS font-family 값 (대체 스택 제외) */
  family: string
  /** 글꼴을 불러오는 stylesheet */
  href: string
}

const GOOGLE = 'https://fonts.googleapis.com/css2?display=swap&family='

export const HEADING_FONTS: FontOption[] = [
  { id: 'noto-serif', label: 'Noto Serif KR', family: "'Noto Serif KR'", href: `${GOOGLE}Noto+Serif+KR:wght@400;600` },
  // 마루 부리는 굵기별로 family 가 나뉘어 있어 제목용 SemiBold 를 우선 사용
  { id: 'maruburi', label: '마루 부리', family: "'MaruBuriSemiBold', 'MaruBuri'", href: 'https://hangeul.pstatic.net/hangeul_static/css/maru-buri.css' },
  { id: 'nanum-myeongjo', label: '나눔명조', family: "'Nanum Myeongjo'", href: `${GOOGLE}Nanum+Myeongjo:wght@400;700` },
  { id: 'gowun-batang', label: '고운바탕', family: "'Gowun Batang'", href: `${GOOGLE}Gowun+Batang:wght@400;700` },
]

export const BODY_FONTS: FontOption[] = [
  { id: 'pretendard', label: 'Pretendard', family: "'Pretendard Variable', 'Pretendard'", href: 'https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css' },
  { id: 'noto-sans', label: 'Noto Sans KR', family: "'Noto Sans KR'", href: `${GOOGLE}Noto+Sans+KR:wght@400;500;600` },
  { id: 'ibm-plex', label: 'IBM Plex Sans KR', family: "'IBM Plex Sans KR'", href: `${GOOGLE}IBM+Plex+Sans+KR:wght@400;500;600` },
  { id: 'nanum-gothic', label: '나눔고딕', family: "'Nanum Gothic'", href: `${GOOGLE}Nanum+Gothic:wght@400;700` },
]

export const HEADING_FALLBACK = "'Noto Serif KR', 'AppleMyungjo', 'Batang', serif"
export const BODY_FALLBACK = "'Pretendard Variable', 'Pretendard', -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif"

export type FontSizeId = 'sm' | 'md' | 'lg' | 'xl'

export const FONT_SIZES: { id: FontSizeId; label: string; px: number }[] = [
  { id: 'sm', label: '작게', px: 13 },
  { id: 'md', label: '보통', px: 14 },
  { id: 'lg', label: '크게', px: 15 },
  { id: 'xl', label: '아주 크게', px: 16 },
]

export type DisplaySettings = {
  fontHeading: string
  fontBody: string
  fontSize: FontSizeId
}

export const DEFAULT_DISPLAY: DisplaySettings = {
  fontHeading: 'noto-serif',
  fontBody: 'pretendard',
  fontSize: 'md',
}

export function findHeadingFont(id: string): FontOption {
  return HEADING_FONTS.find((f) => f.id === id) ?? HEADING_FONTS[0]
}

export function findBodyFont(id: string): FontOption {
  return BODY_FONTS.find((f) => f.id === id) ?? BODY_FONTS[0]
}

/** 저장값 검증: 모르는 값이면 기본값 */
export function normalizeDisplay(v: Partial<DisplaySettings> | undefined): DisplaySettings {
  return {
    fontHeading: HEADING_FONTS.some((f) => f.id === v?.fontHeading) ? v!.fontHeading! : DEFAULT_DISPLAY.fontHeading,
    fontBody: BODY_FONTS.some((f) => f.id === v?.fontBody) ? v!.fontBody! : DEFAULT_DISPLAY.fontBody,
    fontSize: FONT_SIZES.some((s) => s.id === v?.fontSize) ? v!.fontSize! : DEFAULT_DISPLAY.fontSize,
  }
}

/** 글꼴 stylesheet 가 없으면 <head> 에 추가 (중복 방지) */
export function ensureFontLoaded(font: FontOption): void {
  if (typeof document === 'undefined') return
  if (document.querySelector(`link[data-font-id="${font.id}"]`)) return
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = font.href
  link.dataset.fontId = font.id
  document.head.appendChild(link)
}

/** 화면 설정을 문서 전체에 적용 */
export function applyDisplaySettings(v: Partial<DisplaySettings> | undefined): void {
  if (typeof document === 'undefined') return
  const d = normalizeDisplay(v)
  const heading = findHeadingFont(d.fontHeading)
  const body = findBodyFont(d.fontBody)
  ensureFontLoaded(heading)
  ensureFontLoaded(body)
  const root = document.documentElement
  root.dataset.fontSize = d.fontSize
  root.dataset.fontHeading = heading.id
  root.dataset.fontBody = body.id
  root.style.setProperty('--font-heading', `${heading.family}, ${HEADING_FALLBACK}`)
  root.style.setProperty('--font-body', `${body.family}, ${BODY_FALLBACK}`)
}

/**
 * 첫 화면 깜빡임 방지용 인라인 스크립트 (hydration 전에 실행).
 * applyDisplaySettings 와 같은 동작을 localStorage 에서 직접 읽어 수행한다.
 */
export function buildDisplayBootScript(storageKey: string): string {
  const data = {
    key: storageKey,
    h: Object.fromEntries(HEADING_FONTS.map((f) => [f.id, [f.family, f.href]])),
    b: Object.fromEntries(BODY_FONTS.map((f) => [f.id, [f.family, f.href]])),
    sizes: FONT_SIZES.map((s) => s.id),
    def: DEFAULT_DISPLAY,
    hf: HEADING_FALLBACK,
    bf: BODY_FALLBACK,
  }
  return `(function(){try{var D=${JSON.stringify(data)};var g={};try{var s=JSON.parse(localStorage.getItem(D.key)||'{}');g=(s&&s.general)||{};}catch(e){}
var hid=D.h[g.fontHeading]?g.fontHeading:D.def.fontHeading,bid=D.b[g.fontBody]?g.fontBody:D.def.fontBody,sz=D.sizes.indexOf(g.fontSize)>=0?g.fontSize:D.def.fontSize;
var r=document.documentElement;r.setAttribute('data-font-size',sz);r.setAttribute('data-font-heading',hid);r.setAttribute('data-font-body',bid);
r.style.setProperty('--font-heading',D.h[hid][0]+', '+D.hf);r.style.setProperty('--font-body',D.b[bid][0]+', '+D.bf);
[[hid,D.h[hid][1]],[bid,D.b[bid][1]]].forEach(function(p){if(document.querySelector('link[data-font-id="'+p[0]+'"]'))return;var l=document.createElement('link');l.rel='stylesheet';l.href=p[1];l.setAttribute('data-font-id',p[0]);document.head.appendChild(l);});
}catch(e){}})();`
}
