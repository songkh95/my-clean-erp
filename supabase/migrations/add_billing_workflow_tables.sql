-- 정산 워크플로 기획서(BILLING_WORKFLOW_PLAN.md) 1차 구현
-- 1) 거래명세서 발송일 기록
alter table public.settlements
  add column if not exists sent_at timestamptz;

-- 2) 세금계산서 발행 기록 (홈택스 수동 발행 + 결과만 ERP에 기록)
create table if not exists public.tax_invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  settlement_id uuid not null references public.settlements(id) on delete cascade,
  status text not null default '정상' check (status in ('정상', '취소', '수정발행됨')),
  original_invoice_id uuid references public.tax_invoices(id),
  issued_at date,
  approval_no text,
  amount numeric,
  memo text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists tax_invoices_settlement_idx on public.tax_invoices (settlement_id);
create index if not exists tax_invoices_org_idx on public.tax_invoices (organization_id);

alter table public.tax_invoices enable row level security;

create policy "조직별 세금계산서 접근" on public.tax_invoices
  for all
  using (organization_id = get_my_org_id())
  with check (organization_id = get_my_org_id());
