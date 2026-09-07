-- 서비스 일지 확장: 판매_출장 구분 + 미등록 거래처명 + 기기 모델명
-- Supabase SQL Editor에서 실행

ALTER TABLE service_logs
  ADD COLUMN IF NOT EXISTS log_kind text NOT NULL DEFAULT 'service';

ALTER TABLE service_logs
  ADD COLUMN IF NOT EXISTS client_name text;

ALTER TABLE service_logs
  ADD COLUMN IF NOT EXISTS machine_model text;

COMMENT ON COLUMN service_logs.log_kind IS 'service=렌탈/서비스, sales_trip=판매_출장';
COMMENT ON COLUMN service_logs.client_name IS '거래처 미등록 시 자유 입력 상호명 (client_id NULL 가능)';
COMMENT ON COLUMN service_logs.machine_model IS '직접 입력 또는 선택 기기 모델명 (소모품 호환 연결용)';

UPDATE service_logs SET log_kind = 'sales_trip' WHERE log_kind IN ('sales', 'trip');
UPDATE service_logs SET log_kind = 'service' WHERE log_kind IS NULL OR trim(log_kind) = '';

DO $$
BEGIN
  ALTER TABLE service_logs ALTER COLUMN client_id DROP NOT NULL;
EXCEPTION
  WHEN others THEN
    NULL;
END $$;

CREATE INDEX IF NOT EXISTS service_logs_org_kind_idx
  ON service_logs (organization_id, log_kind, visit_date DESC);
