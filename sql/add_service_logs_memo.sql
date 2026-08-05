-- 서비스 일지 메모 컬럼 추가
-- Supabase SQL Editor에서 실행하세요.

ALTER TABLE service_logs
  ADD COLUMN IF NOT EXISTS memo text;

COMMENT ON COLUMN service_logs.memo IS '서비스 일지 메모';
