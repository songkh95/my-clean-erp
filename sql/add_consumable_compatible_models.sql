-- 소모품 ↔ 호환 기기 모델 (N:M)
-- 한 소모품이 여러 기기 모델과 호환될 수 있음

CREATE TABLE IF NOT EXISTS consumable_compatible_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  consumable_id uuid NOT NULL REFERENCES consumables(id) ON DELETE CASCADE,
  machine_model text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (consumable_id, machine_model)
);

COMMENT ON TABLE consumable_compatible_models IS '소모품이 호환되는 기기 모델명 목록';
COMMENT ON COLUMN consumable_compatible_models.machine_model IS 'inventory.model_name 과 동일 규칙(대문자 정규화)';

CREATE INDEX IF NOT EXISTS consumable_compat_org_model_idx
  ON consumable_compatible_models (organization_id, machine_model);

CREATE INDEX IF NOT EXISTS consumable_compat_consumable_idx
  ON consumable_compatible_models (consumable_id);

ALTER TABLE consumable_compatible_models ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS consumable_compatible_models_org ON consumable_compatible_models;
CREATE POLICY consumable_compatible_models_org ON consumable_compatible_models
  FOR ALL TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

-- 기존 product_group → 호환 모델로 이전
INSERT INTO consumable_compatible_models (organization_id, consumable_id, machine_model)
SELECT c.organization_id, c.id, upper(trim(c.product_group))
FROM consumables c
WHERE c.product_group IS NOT NULL
  AND trim(c.product_group) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM consumable_compatible_models m
    WHERE m.consumable_id = c.id
      AND m.machine_model = upper(trim(c.product_group))
  );
