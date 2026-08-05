-- 서비스 일지: 거래처 여유 토너(현장 재고) 기록
ALTER TABLE service_logs
  ADD COLUMN IF NOT EXISTS spare_stock text;

ALTER TABLE service_logs
  ADD COLUMN IF NOT EXISTS spare_stock_at date;

COMMENT ON COLUMN service_logs.spare_stock IS '거래처 현장 여유분 토너 등';
COMMENT ON COLUMN service_logs.spare_stock_at IS '여유분 재고를 기록한 날짜';
