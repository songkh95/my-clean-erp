-- 서비스 부품 사용: 재고 반영 상태 (가출고/미입고)
-- Supabase SQL Editor에서 실행하세요.

ALTER TABLE service_parts_usage
  ADD COLUMN IF NOT EXISTS stock_status text NOT NULL DEFAULT 'none';

COMMENT ON COLUMN service_parts_usage.stock_status IS
  'none=미완료(재고무관), deducted=차감완료, pending=가출고(입고확정대기)';

-- 기존 완료 일지 부품은 이미 차감된 것으로 간주
UPDATE service_parts_usage u
SET stock_status = 'deducted'
FROM service_logs l
WHERE u.service_log_id = l.id
  AND l.status = '완료'
  AND (u.stock_status IS NULL OR u.stock_status = 'none');
