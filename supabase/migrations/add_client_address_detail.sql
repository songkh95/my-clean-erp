-- 거래처: 지도용 주소 / 사람이 보는 상세주소 분리
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS address_detail text;

COMMENT ON COLUMN clients.address IS '지도·지오코딩용 주소 (도로명·건물번호 등)';
COMMENT ON COLUMN clients.address_detail IS '층·호·관리사무소 등 상세 위치 (지도 검색에 사용하지 않음)';
