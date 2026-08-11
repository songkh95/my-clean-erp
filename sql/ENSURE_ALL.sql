-- ============================================================
-- My Clean ERP — 스키마 일괄 보정 (한 번만 실행)
-- Supabase Dashboard → SQL Editor → New query → 전체 실행
-- ============================================================

-- 1) 서비스 일지: 메모 / 현재재고(현장 여유분)
ALTER TABLE service_logs
  ADD COLUMN IF NOT EXISTS memo text;

ALTER TABLE service_logs
  ADD COLUMN IF NOT EXISTS spare_stock text;

ALTER TABLE service_logs
  ADD COLUMN IF NOT EXISTS spare_stock_at date;

COMMENT ON COLUMN service_logs.memo IS '서비스 일지 메모';
COMMENT ON COLUMN service_logs.spare_stock IS '거래처 현장 여유분 토너 등 (현재 재고)';
COMMENT ON COLUMN service_logs.spare_stock_at IS '여유분 재고를 기록한 날짜';

-- 2) 부품 사용: 재고 반영 상태 (미입고/가출고)
ALTER TABLE service_parts_usage
  ADD COLUMN IF NOT EXISTS stock_status text NOT NULL DEFAULT 'none';

COMMENT ON COLUMN service_parts_usage.stock_status IS
  'none=미완료(재고미반영), deducted=차감완료, pending=가출고(입고확정대기)';

UPDATE service_parts_usage u
SET stock_status = 'deducted'
FROM service_logs l
WHERE u.service_log_id = l.id
  AND l.status = '완료'
  AND (u.stock_status IS NULL OR u.stock_status = 'none');

-- 3) 소모품: 색상 / 재생 여부 / 제품군
ALTER TABLE consumables
  ADD COLUMN IF NOT EXISTS color text;

ALTER TABLE consumables
  ADD COLUMN IF NOT EXISTS is_regenerated boolean DEFAULT false;

ALTER TABLE consumables
  ADD COLUMN IF NOT EXISTS product_group text;

ALTER TABLE consumables
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

COMMENT ON COLUMN consumables.color IS 'K/C/M/Y (토너·드럼)';
COMMENT ON COLUMN consumables.is_regenerated IS '재생품 여부';
COMMENT ON COLUMN consumables.product_group IS '제품군 — 기기 model_name과 매칭';
COMMENT ON COLUMN consumables.is_active IS 'false면 목록에서 숨김(서비스 일지 이력 보존용 소프트 삭제)';

CREATE INDEX IF NOT EXISTS consumables_product_group_idx
  ON consumables (organization_id, product_group);

CREATE INDEX IF NOT EXISTS consumables_active_idx
  ON consumables (organization_id, is_active);

-- 3b) 소모품 ↔ 호환 기기 모델 (N:M)
CREATE TABLE IF NOT EXISTS consumable_compatible_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  consumable_id uuid NOT NULL REFERENCES consumables(id) ON DELETE CASCADE,
  machine_model text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (consumable_id, machine_model)
);

COMMENT ON TABLE consumable_compatible_models IS '소모품이 호환되는 기기 모델명 목록';

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

-- 4) 서비스 일지 이미지 메타 테이블
CREATE TABLE IF NOT EXISTS service_log_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  service_log_id uuid NOT NULL REFERENCES service_logs(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS service_log_images_log_idx
  ON service_log_images(service_log_id);

ALTER TABLE service_log_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_log_images_org ON service_log_images;
CREATE POLICY service_log_images_org ON service_log_images
  FOR ALL TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

-- 5) Storage 버킷 (사진 첨부)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'service-attachments',
  'service-attachments',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/jpg']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS service_attachments_select ON storage.objects;
DROP POLICY IF EXISTS service_attachments_insert ON storage.objects;
DROP POLICY IF EXISTS service_attachments_update ON storage.objects;
DROP POLICY IF EXISTS service_attachments_delete ON storage.objects;

CREATE POLICY service_attachments_select
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'service-attachments');

CREATE POLICY service_attachments_insert
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'service-attachments');

CREATE POLICY service_attachments_update
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'service-attachments');

CREATE POLICY service_attachments_delete
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'service-attachments');

-- 6) 재고 원자적 조정
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
      RETURN 0; -- 스키마 체크용: 없는 id여도 함수 존재 확인 OK
    END IF;
    RETURN COALESCE(new_stock, 0);
  END IF;

  SELECT current_stock INTO new_stock FROM consumables WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'consumable not found: %', p_id; END IF;

  new_stock := COALESCE(new_stock, 0) + p_delta;
  IF new_stock < 0 THEN
    RAISE EXCEPTION 'insufficient stock for % (result %)', p_id, new_stock;
  END IF;

  UPDATE consumables SET current_stock = new_stock WHERE id = p_id;
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

-- 7) 토너/드럼·코드 중복 병합 후 유니크 인덱스
-- (이미 중복이 있으면 인덱스만 만들면 23505 에러 → 먼저 합침)

DO $$
DECLARE
  r RECORD;
  keep_id uuid;
  dup_id uuid;
  total_stock integer;
BEGIN
  -- consumable_compatible_models 없을 수 있음
  IF to_regclass('public.consumable_compatible_models') IS NULL THEN
    RAISE NOTICE 'consumable_compatible_models 없음 — 호환 이전 생략';
  END IF;

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

-- 관리코드 유니크: 활성 품목 + 정품/재생 구분 (같은 코드로 재생품 별도 등록 가능)
DROP INDEX IF EXISTS consumables_org_code_uidx;
DROP INDEX IF EXISTS consumables_org_code_regen_uidx;
CREATE UNIQUE INDEX IF NOT EXISTS consumables_org_code_regen_uidx
  ON consumables (organization_id, code, (COALESCE(is_regenerated, false)))
  WHERE code IS NOT NULL AND btrim(code) <> ''
    AND COALESCE(is_active, true) = true;

-- 색상 유일 인덱스는 사용하지 않음 (품명이 다르면 같은 색상 토너 여러 개 허용)
DROP INDEX IF EXISTS consumables_org_toner_color_uidx;

-- 완료: 앱에서 현재 재고 / 메모 / 사진 / 미입고 / 원자적 재고 기능을 사용할 수 있습니다.
