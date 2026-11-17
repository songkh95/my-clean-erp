-- 원가계산 (복합기 렌탈 시뮬레이션) 저장
create table if not exists public.cost_simulations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  created_by uuid null references auth.users (id) on delete set null,
  name text not null default '',
  client_id uuid null references public.clients (id) on delete set null,
  client_name text null,
  model text null,
  memo text null,
  -- 입력값 전체 (utils/rentalCosting.ts 의 CostInputs)
  inputs jsonb not null default '{}'::jsonb,
  -- 소모품 목록 (CostPart[])
  parts jsonb not null default '[]'::jsonb,
  -- 목록에서 바로 보여줄 결과 요약 (월 렌탈료, 월 순이익, 회수 개월 등)
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cost_simulations_org_idx
  on public.cost_simulations (organization_id, updated_at desc);

alter table public.cost_simulations enable row level security;

drop policy if exists "cost_simulations_org_select" on public.cost_simulations;
create policy "cost_simulations_org_select" on public.cost_simulations for select to authenticated
  using (
    organization_id in (select organization_id from public.profiles where id = auth.uid())
  );

drop policy if exists "cost_simulations_org_insert" on public.cost_simulations;
create policy "cost_simulations_org_insert" on public.cost_simulations for insert to authenticated
  with check (
    organization_id in (select organization_id from public.profiles where id = auth.uid())
  );

drop policy if exists "cost_simulations_org_update" on public.cost_simulations;
create policy "cost_simulations_org_update" on public.cost_simulations for update to authenticated
  using (
    organization_id in (select organization_id from public.profiles where id = auth.uid())
  )
  with check (
    organization_id in (select organization_id from public.profiles where id = auth.uid())
  );

drop policy if exists "cost_simulations_org_delete" on public.cost_simulations;
create policy "cost_simulations_org_delete" on public.cost_simulations for delete to authenticated
  using (
    organization_id in (select organization_id from public.profiles where id = auth.uid())
  );

comment on table public.cost_simulations is '복합기 렌탈 원가계산 저장 (입력값 + 소모품 + 결과 요약)';
