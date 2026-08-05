-- 소모품 소프트 삭제 (서비스 일지 FK 때문에 물리 삭제 불가 시)
ALTER TABLE consumables
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

COMMENT ON COLUMN consumables.is_active IS 'false면 목록에서 숨김(일지 이력 보존)';

CREATE INDEX IF NOT EXISTS consumables_active_idx
  ON consumables (organization_id, is_active);

UPDATE consumables SET is_active = true WHERE is_active IS NULL;
