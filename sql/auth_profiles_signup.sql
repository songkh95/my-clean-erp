-- 회원가입 / 아이디 찾기용 RPC + 프로필 RLS
-- Supabase SQL Editor에서 한 번 실행하세요.

CREATE OR REPLACE FUNCTION public.my_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM profiles WHERE id = auth.uid()
$$;

GRANT EXECUTE ON FUNCTION public.my_org_id() TO authenticated;

-- 1) 신규 조직 + 프로필 생성 (가입 직후 호출)
CREATE OR REPLACE FUNCTION public.complete_signup(
  p_org_name text,
  p_display_name text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  org_id uuid;
  existing_org uuid;
BEGIN
  IF uid IS NULL THEN
    RETURN json_build_object('ok', false, 'message', '로그인이 필요합니다.');
  END IF;

  IF coalesce(trim(p_org_name), '') = '' THEN
    RETURN json_build_object('ok', false, 'message', '회사(조직) 이름을 입력해 주세요.');
  END IF;

  IF coalesce(trim(p_display_name), '') = '' THEN
    RETURN json_build_object('ok', false, 'message', '사용자 이름을 입력해 주세요.');
  END IF;

  SELECT organization_id INTO existing_org
  FROM profiles
  WHERE id = uid;

  IF existing_org IS NOT NULL THEN
    RETURN json_build_object('ok', true, 'organization_id', existing_org, 'message', '이미 가입이 완료되었습니다.');
  END IF;

  INSERT INTO organizations (name)
  VALUES (trim(p_org_name))
  RETURNING id INTO org_id;

  INSERT INTO profiles (id, name, organization_id, role, is_deleted)
  VALUES (uid, trim(p_display_name), org_id, 'admin', false)
  ON CONFLICT (id) DO UPDATE
    SET name = excluded.name,
        organization_id = coalesce(profiles.organization_id, excluded.organization_id),
        role = coalesce(profiles.role, excluded.role),
        is_deleted = false,
        updated_at = now();

  RETURN json_build_object('ok', true, 'organization_id', org_id);
END;
$$;

-- 2) 기존 조직 참여 (조직 UUID 필요)
CREATE OR REPLACE FUNCTION public.join_organization(
  p_org_id uuid,
  p_display_name text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  org_exists boolean;
  existing_org uuid;
BEGIN
  IF uid IS NULL THEN
    RETURN json_build_object('ok', false, 'message', '로그인이 필요합니다.');
  END IF;

  IF coalesce(trim(p_display_name), '') = '' THEN
    RETURN json_build_object('ok', false, 'message', '사용자 이름을 입력해 주세요.');
  END IF;

  SELECT organization_id INTO existing_org FROM profiles WHERE id = uid;
  IF existing_org IS NOT NULL THEN
    RETURN json_build_object('ok', true, 'organization_id', existing_org, 'message', '이미 조직에 속해 있습니다.');
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM organizations WHERE id = p_org_id AND coalesce(is_deleted, false) = false
  ) INTO org_exists;

  IF NOT org_exists THEN
    RETURN json_build_object('ok', false, 'message', '조직을 찾을 수 없습니다. 조직 코드를 확인해 주세요.');
  END IF;

  INSERT INTO profiles (id, name, organization_id, role, is_deleted)
  VALUES (uid, trim(p_display_name), p_org_id, 'member', false)
  ON CONFLICT (id) DO UPDATE
    SET name = excluded.name,
        organization_id = coalesce(profiles.organization_id, excluded.organization_id),
        role = coalesce(profiles.role, 'member'),
        is_deleted = false,
        updated_at = now();

  RETURN json_build_object('ok', true, 'organization_id', p_org_id);
END;
$$;

-- 3) 아이디(이메일) 찾기 — 이름 일치 시 마스킹된 이메일 반환
CREATE OR REPLACE FUNCTION public.find_login_emails_by_name(p_name text)
RETURNS TABLE(masked_email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(trim(p_name), '') = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    CASE
      WHEN position('@' in u.email) > 1 THEN
        left(u.email, 2)
        || repeat('*', greatest(1, position('@' in u.email) - 3))
        || substring(u.email from position('@' in u.email))
      ELSE '***'
    END AS masked_email
  FROM profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE coalesce(p.is_deleted, false) = false
    AND lower(trim(p.name)) = lower(trim(p_name))
    AND u.email IS NOT NULL
  LIMIT 10;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_signup(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_organization(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_login_emails_by_name(text) TO anon, authenticated;

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own_or_org" ON profiles;
CREATE POLICY "profiles_select_own_or_org" ON profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR organization_id = public.my_org_id()
  );

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
