-- 관리코드: 같은 코드라도 정품/재생은 별도 품목으로 허용
-- (예: 검정 토너와 검정 재생토너가 같은 관리코드, 가격·품명만 다른 경우)

DROP INDEX IF EXISTS consumables_org_code_uidx;
DROP INDEX IF EXISTS consumables_org_code_regen_uidx;

CREATE UNIQUE INDEX IF NOT EXISTS consumables_org_code_regen_uidx
  ON public.consumables (
    organization_id,
    code,
    (COALESCE(is_regenerated, false))
  )
  WHERE code IS NOT NULL
    AND btrim(code) <> ''
    AND COALESCE(is_active, true) = true;

COMMENT ON INDEX consumables_org_code_regen_uidx IS
  '활성 품목 기준 관리코드 유니크 (정품/재생 구분)';
