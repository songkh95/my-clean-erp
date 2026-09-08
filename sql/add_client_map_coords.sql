-- 거래처 지도 좌표 캐시 (주소 지오코딩 결과)
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS map_lat double precision;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS map_lng double precision;

COMMENT ON COLUMN clients.map_lat IS '지도 위도 (주소 지오코딩 캐시)';
COMMENT ON COLUMN clients.map_lng IS '지도 경도 (주소 지오코딩 캐시)';
