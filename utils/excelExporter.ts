import * as XLSX from 'xlsx';
import { Settlement, SettlementDetail } from '@/app/types';

/**
 * 국세청 홈택스(Hometax) 전자세금계산서 일괄발급 양식으로 엑셀 다운로드
 * @param historyList 화면에 표시된 청구 내역 데이터
 */
export const exportHistoryToExcel = (historyList: Settlement[]) => {
  if (!historyList || historyList.length === 0) {
    alert('다운로드할 데이터가 없습니다.');
    return;
  }

  const header = [
    '일련번호', '공급자등록번호', '종류', '작성일자', '공급받는자등록번호',
    '종사업장번호', '상호(법인명)', '성명', '사업장주소', '업태', '종목', '이메일1',
    '공급가액', '세액', '비고', '일자1', '품목1', '규격1', '수량1', '단가1', '공급가액1', '세액1', '품목비고1'
  ];

  const rows = historyList.map((hist, index) => {
    // client가 없거나 세부 정보가 없을 경우를 대비해 기본값 설정
    const client = hist.client || { 
      business_number: '', name: '', representative_name: '', address: '', email: '' 
    };
    
    // 작성일자 (데이터가 없으면 해당 월 말일로 계산)
    const lastDay = new Date(hist.billing_year, hist.billing_month, 0).getDate();
    const dateStr = `${hist.billing_year}${String(hist.billing_month).padStart(2, '0')}${String(lastDay)}`;

    // 공급가액, 세액 계산 (부가세 별도 가정: 합계금액 / 1.1)
    const total = hist.total_amount || 0;
    const supplyValue = Math.round(total / 1.1);
    const taxValue = total - supplyValue;

    // 품목명 생성 (기계 모델명 나열)
    const details = hist.details || [];
    const itemNames = details
      .map((d: SettlementDetail) => d.inventory?.model_name)
      .filter((name): name is string => !!name);
      
    const mainItemName = itemNames.length > 0 
      ? `${hist.billing_month}월 복합기 임대료(${itemNames[0]}${itemNames.length > 1 ? ' 외' : ''})`
      : `${hist.billing_month}월 임대료`;

    return {
      '일련번호': index + 1,
      '공급자등록번호': '', // 사용자(공급자) 정보는 홈택스 업로드 시 자동 적용되므로 비워둠
      '종류': '01', // 01: 일반, 02: 영세율
      '작성일자': dateStr,
      '공급받는자등록번호': (client.business_number || '').replace(/-/g, ''),
      '종사업장번호': '',
      '상호(법인명)': client.name || '',
      '성명': client.representative_name || '',
      '사업장주소': client.address || '',
      '업태': '',
      '종목': '',
      '이메일1': client.email || '',
      '공급가액': supplyValue,
      '세액': taxValue,
      '비고': hist.memo || '', 
      '일자1': String(lastDay).padStart(2, '0'),
      '품목1': mainItemName,
      '규격1': '',
      '수량1': '',
      '단가1': '',
      '공급가액1': supplyValue,
      '세액1': taxValue,
      '품목비고1': ''
    };
  });

  // 엑셀 시트 생성 및 컬럼 너비 설정
  const worksheet = XLSX.utils.json_to_sheet(rows, { header: header });
  const wscols = header.map(() => ({ wch: 15 }));
  worksheet['!cols'] = wscols;

  // 워크북 생성 및 다운로드
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "세금계산서");
  
  const fileName = `홈택스_일괄등록_${new Date().toISOString().slice(0,10)}.xlsx`;
  XLSX.writeFile(workbook, fileName);
};