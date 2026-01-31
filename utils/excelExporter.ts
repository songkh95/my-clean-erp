// utils/excelExporter.ts
import * as XLSX from 'xlsx';

/**
 * 국세청 홈택스(Hometax) 전자세금계산서 일괄발급 양식으로 엑셀 다운로드
 * @param historyList 화면에 표시된 청구 내역 데이터
 */
export const exportHistoryToExcel = (historyList: any[]) => {
  if (!historyList || historyList.length === 0) {
    alert('다운로드할 데이터가 없습니다.');
    return;
  }

  // 홈택스 일괄작성 양식의 필수 헤더 (순서 중요)
  // 참고: 실제 양식은 다운로드 시점에 따라 다를 수 있으나, 일반적인 필수 컬럼 기준
  const header = [
    '일련번호', '공급자등록번호', '종류', '작성일자', '공급받는자등록번호',
    '종사업장번호', '상호(법인명)', '성명', '사업장주소', '업태', '종목', '이메일1',
    '공급가액', '세액', '비고', '일자1', '품목1', '규격1', '수량1', '단가1', '공급가액1', '세액1', '품목비고1'
  ];

  // 데이터 가공 (거래처 단위로 1행씩)
  // 세금계산서는 보통 거래처별 총액으로 1건씩 발행하므로, 기계별 내역을 합산하거나 품목란에 대표 기명을 적습니다.
  const rows = historyList.map((hist, index) => {
    const client = hist.client || {};
    
    // 작성일자 (청구년월 말일 기준 혹은 데이터에 있는 billing_date)
    // 예: 20240131 형식
    const lastDay = new Date(hist.billing_year, hist.billing_month, 0).getDate();
    const dateStr = `${hist.billing_year}${String(hist.billing_month).padStart(2, '0')}${String(lastDay)}`;

    // 공급가액, 세액 계산 (부가세 별도 가정: 합계금액 / 1.1)
    // ERP 합계가 부가세 포함인지 별도인지에 따라 다르지만, 통상 렌탈료는 부가세 별도인 경우가 많습니다.
    // 여기서는 ERP 'total_amount'를 '공급가액(부가세 별도)' + '세액'의 합계(청구총액)라고 가정하고 역산합니다.
    // 만약 total_amount가 부가세 별도 금액이라면 그대로 공급가액에 넣고 세액은 10% 계산하면 됩니다.
    // * 현재 로직: total_amount = 청구할 총 금액(Total) -> 공급가액 = Total / 1.1
    const total = hist.total_amount || 0;
    const supplyValue = Math.round(total / 1.1);
    const taxValue = total - supplyValue;

    // 품목명 생성 (예: "1월 복합기 임대료 외")
    const itemNames = hist.details?.map((d: any) => d.inventory?.model_name).filter(Boolean);
    const mainItemName = itemNames && itemNames.length > 0 
      ? `${hist.billing_month}월 복합기 임대료(${itemNames[0]}${itemNames.length > 1 ? ' 외' : ''})`
      : `${hist.billing_month}월 임대료`;

    return {
      '일련번호': index + 1,
      '공급자등록번호': '', // 사용자(공급자) 정보는 홈택스 로그인 시 자동 적용되거나 별도 기입 필요
      '종류': '01', // 01: 일반, 02: 영세율 (일반적으로 01)
      '작성일자': dateStr,
      '공급받는자등록번호': (client.business_number || '').replace(/-/g, ''), // 하이픈 제거
      '종사업장번호': '',
      '상호(법인명)': client.name || '',
      '성명': client.representative_name || '',
      '사업장주소': client.address || '',
      '업태': '', // 업태/종목은 필수 아님
      '종목': '',
      '이메일1': client.email || '',
      '공급가액': supplyValue,
      '세액': taxValue,
      '비고': hist.memo || '',
      '일자1': String(lastDay).padStart(2, '0'), // 일자
      '품목1': mainItemName,
      '규격1': '',
      '수량1': '',
      '단가1': '',
      '공급가액1': supplyValue,
      '세액1': taxValue,
      '품목비고1': ''
    };
  });

  // 3. 엑셀 워크시트 생성
  const worksheet = XLSX.utils.json_to_sheet(rows, { header: header });

  // 4. 컬럼 너비 자동 조정 (약간 넓게)
  const wscols = header.map(() => ({ wch: 15 }));
  worksheet['!cols'] = wscols;

  // 5. 파일 다운로드
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "세금계산서");
  
  const fileName = `홈택스_일괄등록_${new Date().toISOString().slice(0,10)}.xlsx`;
  XLSX.writeFile(workbook, fileName);
};