-- 제품군: 여러 호환 기기 모델을 묶는 이름 (예: A3컬러복합기군)
-- Supabase SQL Editor에서 실행

CREATE TABLE IF NOT EXISTS product_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  memo text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (organization_id, name)
);

COMMENT ON TABLE product_groups IS '소모품 호환용 제품군(여러 기기 모델을 묶는 이름)';
COMMENT ON COLUMN product_groups.name IS '제품군 표시명';

CREATE TABLE IF NOT EXISTS product_group_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_group_id uuid NOT NULL REFERENCES product_groups(id) ON DELETE CASCADE,
  machine_model text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (product_group_id, machine_model)
);

COMMENT ON TABLE product_group_models IS '제품군에 속한 기기 모델 목록';
COMMENT ON COLUMN product_group_models.machine_model IS 'inventory.model_name 과 동일 규칙(대문자 정규화)';

CREATE INDEX IF NOT EXISTS product_groups_org_idx ON product_groups (organization_id);
CREATE INDEX IF NOT EXISTS product_group_models_org_idx ON product_group_models (organization_id);
CREATE INDEX IF NOT EXISTS product_group_models_group_idx ON product_group_models (product_group_id);
CREATE INDEX IF NOT EXISTS product_group_models_model_idx ON product_group_models (organization_id, machine_model);

ALTER TABLE product_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_group_models ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS product_groups_org ON product_groups;
CREATE POLICY product_groups_org ON product_groups
  FOR ALL TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS product_group_models_org ON product_group_models;
CREATE POLICY product_group_models_org ON product_group_models
  FOR ALL TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );
