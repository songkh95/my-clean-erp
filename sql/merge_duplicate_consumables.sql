-- 토너/드럼 색상 중복 품목 합치기 → 유니크 인덱스 생성
-- Supabase SQL Editor에서 이 파일만 실행해도 됩니다.

-- A) 토너/드럼 (조직+종류+색상+재생) 중복 병합
DO $$
DECLARE
  r RECORD;
  keep_id uuid;
  dup_id uuid;
  total_stock integer;
BEGIN
  FOR r IN
    SELECT
      organization_id,
      category,
      color,
      COALESCE(is_regenerated, false) AS regen,
      array_agg(id ORDER BY COALESCE(current_stock, 0) DESC, id) AS ids,
      SUM(COALESCE(current_stock, 0))::integer AS stock_sum
    FROM consumables
    WHERE category IN ('토너', '드럼')
      AND color IS NOT NULL
      AND btrim(color) <> ''
      AND COALESCE(is_active, true) = true
    GROUP BY organization_id, category, color, COALESCE(is_regenerated, false)
    HAVING COUNT(*) > 1
  LOOP
    keep_id := r.ids[1];
    total_stock := r.stock_sum;

    -- 대표 품목에 재고 합산
    UPDATE consumables
    SET current_stock = total_stock
    WHERE id = keep_id;

    FOREACH dup_id IN ARRAY r.ids[2:array_length(r.ids, 1)]
    LOOP
      -- 호환 기기 → 대표로 이전
      INSERT INTO consumable_compatible_models (organization_id, consumable_id, machine_model)
      SELECT organization_id, keep_id, machine_model
      FROM consumable_compatible_models
      WHERE consumable_id = dup_id
      ON CONFLICT (consumable_id, machine_model) DO NOTHING;

      DELETE FROM consumable_compatible_models WHERE consumable_id = dup_id;

      -- 일지 부품 사용 → 대표로 이전
      UPDATE service_parts_usage
      SET consumable_id = keep_id
      WHERE consumable_id = dup_id;

      -- 중복 품목 숨김 (이력 보존)
      UPDATE consumables
      SET is_active = false,
          current_stock = 0
      WHERE id = dup_id;
    END LOOP;
  END LOOP;
END $$;

-- B) 관리코드 중복 정리 (빈 코드 제외) — 두 번째부터 코드에 접미사
DO $$
DECLARE
  r RECORD;
  keep_id uuid;
  dup_id uuid;
  i integer;
BEGIN
  FOR r IN
    SELECT
      organization_id,
      code,
      array_agg(id ORDER BY COALESCE(current_stock, 0) DESC, id) AS ids
    FROM consumables
    WHERE code IS NOT NULL
      AND btrim(code) <> ''
    GROUP BY organization_id, code
    HAVING COUNT(*) > 1
  LOOP
    keep_id := r.ids[1];
    i := 2;
    FOREACH dup_id IN ARRAY r.ids[2:array_length(r.ids, 1)]
    LOOP
      UPDATE consumables
      SET code = code || '-DUP' || i::text
      WHERE id = dup_id;
      i := i + 1;
    END LOOP;
  END LOOP;
END $$;

-- C) 유니크 인덱스
DROP INDEX IF EXISTS consumables_org_code_uidx;
CREATE UNIQUE INDEX IF NOT EXISTS consumables_org_code_uidx
  ON consumables (organization_id, code)
  WHERE code IS NOT NULL AND btrim(code) <> ''
    AND COALESCE(is_active, true) = true;

DROP INDEX IF EXISTS consumables_org_toner_color_uidx;
