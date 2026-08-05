-- 서비스 일지 이미지 Storage RLS 수정
-- Supabase SQL Editor에서 이 파일 전체를 실행하세요.

-- 1) 버킷 확인/생성
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'service-attachments',
  'service-attachments',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/jpg']
)
ON CONFLICT (id) DO UPDATE
SET public = false;

-- 2) 기존 정책 제거 후 재생성 (이름이 같아도 안전하게)
DROP POLICY IF EXISTS service_attachments_select ON storage.objects;
DROP POLICY IF EXISTS service_attachments_insert ON storage.objects;
DROP POLICY IF EXISTS service_attachments_update ON storage.objects;
DROP POLICY IF EXISTS service_attachments_delete ON storage.objects;
DROP POLICY IF EXISTS "service_attachments_select" ON storage.objects;
DROP POLICY IF EXISTS "service_attachments_insert" ON storage.objects;
DROP POLICY IF EXISTS "service_attachments_update" ON storage.objects;
DROP POLICY IF EXISTS "service_attachments_delete" ON storage.objects;

-- 로그인한 사용자: 해당 버킷 읽기/쓰기/수정/삭제 허용
CREATE POLICY service_attachments_select
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'service-attachments');

CREATE POLICY service_attachments_insert
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'service-attachments');

CREATE POLICY service_attachments_update
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'service-attachments')
WITH CHECK (bucket_id = 'service-attachments');

CREATE POLICY service_attachments_delete
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'service-attachments');

-- 3) 이미지 메타 테이블 + RLS (없으면 생성)
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
  FOR ALL
  TO authenticated
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
