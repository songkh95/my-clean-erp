-- 관리코드 유니크: 활성 품목만 (숨긴 품목은 코드 재사용 가능)
DROP INDEX IF EXISTS consumables_org_code_uidx;

CREATE UNIQUE INDEX IF NOT EXISTS consumables_org_code_uidx
  ON consumables (organization_id, code)
  WHERE code IS NOT NULL
    AND btrim(code) <> ''
    AND COALESCE(is_active, true) = true;
