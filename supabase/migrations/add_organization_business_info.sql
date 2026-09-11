-- 홈택스 일괄등록 엑셀 생성에 필요한 공급자(우리 회사) 정보
alter table public.organizations
  add column if not exists business_number text,
  add column if not exists representative_name text,
  add column if not exists address text,
  add column if not exists email text,
  add column if not exists business_type text,   -- 업태
  add column if not exists business_item text;   -- 종목
