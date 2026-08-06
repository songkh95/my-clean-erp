-- 엑셀 거래처/기기 양식 대응 컬럼
-- Supabase SQL Editor에서 실행하세요.

alter table public.clients
  add column if not exists job_title text;

alter table public.inventory
  add column if not exists contract_type text;

alter table public.inventory
  add column if not exists deposit numeric;

alter table public.inventory
  add column if not exists sale_price numeric;

alter table public.inventory
  add column if not exists contract_years numeric;

alter table public.inventory
  add column if not exists department text;

comment on column public.clients.job_title is '담당자 직책';
comment on column public.inventory.contract_type is '계약구분: 임대/판매/유지보수';
comment on column public.inventory.deposit is '보증금';
comment on column public.inventory.sale_price is '판매금액';
comment on column public.inventory.contract_years is '계약년수';
comment on column public.inventory.department is '설치 부서/호출명';
