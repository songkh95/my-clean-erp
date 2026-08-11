-- 관리코드 유니크: 활성 품목만, 정품/재생은 같은 코드 허용
DROP INDEX IF EXISTS consumables_org_code_uidx;
DROP INDEX IF EXISTS consumables_org_code_regen_uidx;

CREATE UNIQUE INDEX IF NOT EXISTS consumables_org_code_regen_uidx
  ON consumables (organization_id, code, (COALESCE(is_regenerated, false)))
  WHERE code IS NOT NULL
    AND btrim(code) <> ''
    AND COALESCE(is_active, true) = true;
