-- 재고 원자적 조정 + 중복 병합 + 유니크 인덱스
-- Supabase SQL Editor에서 실행

DROP FUNCTION IF EXISTS decrement_stock(uuid, integer);
DROP FUNCTION IF EXISTS adjust_consumable_stock(uuid, integer);

CREATE OR REPLACE FUNCTION adjust_consumable_stock(p_id uuid, p_delta integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_stock integer;
BEGIN
  IF p_delta = 0 THEN
    SELECT current_stock INTO new_stock FROM consumables WHERE id = p_id;
    IF NOT FOUND THEN
      RETURN 0;
    END IF;
    RETURN COALESCE(new_stock, 0);
  END IF;

  SELECT current_stock INTO new_stock
  FROM consumables
  WHERE id = p_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'consumable not found: %', p_id;
  END IF;

  new_stock := COALESCE(new_stock, 0) + p_delta;
  IF new_stock < 0 THEN
    RAISE EXCEPTION 'insufficient stock for % (result %)', p_id, new_stock;
  END IF;

  UPDATE consumables
  SET current_stock = new_stock
  WHERE id = p_id;

  RETURN new_stock;
END;
$$;

GRANT EXECUTE ON FUNCTION adjust_consumable_stock(uuid, integer) TO authenticated;

CREATE OR REPLACE FUNCTION decrement_stock(row_id uuid, amount integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN adjust_consumable_stock(row_id, -amount);
END;
$$;

GRANT EXECUTE ON FUNCTION decrement_stock(uuid, integer) TO authenticated;

-- 중복 병합 + 인덱스는 merge_duplicate_consumables.sql 과 동일 로직
-- (아래 전체 실행)

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

    UPDATE consumables SET current_stock = total_stock WHERE id = keep_id;

    FOREACH dup_id IN ARRAY r.ids[2:array_length(r.ids, 1)]
    LOOP
      IF to_regclass('public.consumable_compatible_models') IS NOT NULL THEN
        INSERT INTO consumable_compatible_models (organization_id, consumable_id, machine_model)
        SELECT organization_id, keep_id, machine_model
        FROM consumable_compatible_models
        WHERE consumable_id = dup_id
        ON CONFLICT (consumable_id, machine_model) DO NOTHING;

        DELETE FROM consumable_compatible_models WHERE consumable_id = dup_id;
      END IF;

      UPDATE service_parts_usage SET consumable_id = keep_id WHERE consumable_id = dup_id;

      UPDATE consumables
      SET is_active = false, current_stock = 0
      WHERE id = dup_id;
    END LOOP;
  END LOOP;
END $$;

DO $$
DECLARE
  r RECORD;
  dup_id uuid;
  i integer;
BEGIN
  FOR r IN
    SELECT organization_id, code, array_agg(id ORDER BY COALESCE(current_stock, 0) DESC, id) AS ids
    FROM consumables
    WHERE code IS NOT NULL AND btrim(code) <> ''
    GROUP BY organization_id, code
    HAVING COUNT(*) > 1
  LOOP
    i := 2;
    FOREACH dup_id IN ARRAY r.ids[2:array_length(r.ids, 1)]
    LOOP
      UPDATE consumables SET code = code || '-DUP' || i::text WHERE id = dup_id;
      i := i + 1;
    END LOOP;
  END LOOP;
END $$;

DROP INDEX IF EXISTS consumables_org_code_uidx;
CREATE UNIQUE INDEX IF NOT EXISTS consumables_org_code_uidx
  ON consumables (organization_id, code)
  WHERE code IS NOT NULL AND btrim(code) <> ''
    AND COALESCE(is_active, true) = true;

-- 색상 유일 인덱스 제거 (품명 다르면 같은 색상 여러 개 허용)
DROP INDEX IF EXISTS consumables_org_toner_color_uidx;
