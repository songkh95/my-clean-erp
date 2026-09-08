/**
 * 엑셀 불러오기 공통 규칙 (UI·서버 안내문용)
 *
 * 1) 신규 → 추가
 * 2) 동일 키 → 덮어쓰기
 * 3) 엑셀에 없음 → 삭제(동기화) — 사용자가 삭제를 켠 경우에만
 *
 * 식별 키
 * - 거래처: 회사명 (대소문자 무시)
 * - 기기: 기계번호(시리얼) (대소문자 무시)
 * - 서비스 일지: 일지ID 우선, 없으면 거래처+방문일+기기
 *
 * 삭제 방식
 * - 거래처: 소프트 삭제 (is_deleted)
 * - 기기: DB 삭제 시도, 실패 시 창고 회수(client_id 해제)
 * - 서비스 일지: 선택한 기간 안에서만 물리 삭제
 */

export const EXCEL_SYNC_RULE_LINES = [
  '신규 → 추가',
  '같은 키(이름/시리얼/일지ID) → 덮어쓰기',
  '엑셀에 없는 항목 → 삭제(동기화 옵션을 켠 경우)',
] as const

export function excelSyncRulesText(extra?: string) {
  const body = EXCEL_SYNC_RULE_LINES.map((l) => `· ${l}`).join('\n')
  return extra ? `${body}\n${extra}` : body
}
