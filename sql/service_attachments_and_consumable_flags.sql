-- 서비스 일지 첨부 이미지 + 소모품 색상/재생 구분
-- Supabase SQL Editor에서 실행하세요.

-- 1) 소모품: 색상 · 재생 여부 (없으면 이름 규칙으로도 매칭)
ALTER TABLE consumables
  ADD COLUMN IF NOT EXISTS color text;
ALTER TABLE consumables
  ADD COLUMN IF NOT EXISTS is_regenerated boolean DEFAULT false;

COMMENT ON COLUMN consumables.color IS 'K/C/M/Y (토너·드럼)';
COMMENT ON COLUMN consumables.is_regenerated IS '재생품 여부';

-- 2) 서비스 일지 이미지 메타
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

-- 정책은 조직 소속 기준으로 필요 시 조정하세요.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'service_log_images' AND policyname = 'service_log_images_org'
  ) THEN
    CREATE POLICY service_log_images_org ON service_log_images
      FOR ALL
      USING (
        organization_id IN (
          SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
      )
      WITH CHECK (
        organization_id IN (
          SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
      );
  END IF;
END $$;

-- 3) Storage 버킷 (Dashboard > Storage 에서 수동 생성도 가능)
-- 버킷명: service-attachments
-- Public: false (권장)
-- 허용 MIME: image/*
INSERT INTO storage.buckets (id, name, public)
VALUES ('service-attachments', 'service-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS (인증 사용자 조직 경로만)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'service_attachments_select'
  ) THEN
    CREATE POLICY service_attachments_select ON storage.objects
      FOR SELECT TO authenticated
      USING (bucket_id = 'service-attachments');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'service_attachments_insert'
  ) THEN
    CREATE POLICY service_attachments_insert ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'service-attachments');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'service_attachments_delete'
  ) THEN
    CREATE POLICY service_attachments_delete ON storage.objects
      FOR DELETE TO authenticated
      USING (bucket_id = 'service-attachments');
  END IF;
END $$;
