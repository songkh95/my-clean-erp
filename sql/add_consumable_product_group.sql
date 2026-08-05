-- 소모품 제품군 (기기 모델/라인과 매칭)
ALTER TABLE consumables
  ADD COLUMN IF NOT EXISTS product_group text;

COMMENT ON COLUMN consumables.product_group IS '제품군 — 기기 model_name(또는 라인)과 매칭되어 일지 교체/배송 재고에 사용';

CREATE INDEX IF NOT EXISTS consumables_product_group_idx
  ON consumables (organization_id, product_group);
