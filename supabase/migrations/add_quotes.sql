-- 견적서
create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  created_by uuid null references auth.users (id) on delete set null,
  quote_no text null,
  quote_date date not null default (current_date),
  client_id uuid null references public.clients (id) on delete set null,
  client_name text not null default '',
  title text not null default '見積書',
  intro text not null default '아래와 같이 見積합니다.',
  notes text null,
  footer_notice text null,
  -- 공급자(발행) 정보
  issuer_company text null,
  issuer_partner text null,
  issuer_ceo text null,
  issuer_biz_no text null,
  issuer_address text null,
  issuer_manager text null,
  issuer_tel text null,
  issuer_hp text null,
  issuer_homepage text null,
  issuer_blog text null,
  vat_rate numeric not null default 10,
  status text not null default 'draft', -- draft | sent | accepted | cancelled
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  sort_order int not null default 0,
  description text not null default '',
  unit text not null default '대',
  quantity numeric not null default 1,
  unit_price numeric not null default 0,
  -- 단가 칸 텍스트(보증금/기본요금 라벨 등)
  unit_price_text text null,
  -- 공급가액 칸 텍스트(보증금/기본요금 등). 있으면 숫자 대신 표시
  amount_text text null,
  -- 합계에서 제외 (모니터 옵션 등)
  exclude_from_total boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists quotes_org_date_idx on public.quotes (organization_id, quote_date desc);
create index if not exists quote_items_quote_idx on public.quote_items (quote_id, sort_order);

alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;

drop policy if exists "quotes_org_select" on public.quotes;
create policy "quotes_org_select" on public.quotes for select to authenticated
  using (
    organization_id in (select organization_id from public.profiles where id = auth.uid())
  );

drop policy if exists "quotes_org_insert" on public.quotes;
create policy "quotes_org_insert" on public.quotes for insert to authenticated
  with check (
    organization_id in (select organization_id from public.profiles where id = auth.uid())
  );

drop policy if exists "quotes_org_update" on public.quotes;
create policy "quotes_org_update" on public.quotes for update to authenticated
  using (
    organization_id in (select organization_id from public.profiles where id = auth.uid())
  )
  with check (
    organization_id in (select organization_id from public.profiles where id = auth.uid())
  );

drop policy if exists "quotes_org_delete" on public.quotes;
create policy "quotes_org_delete" on public.quotes for delete to authenticated
  using (
    organization_id in (select organization_id from public.profiles where id = auth.uid())
  );

drop policy if exists "quote_items_org_select" on public.quote_items;
create policy "quote_items_org_select" on public.quote_items for select to authenticated
  using (
    organization_id in (select organization_id from public.profiles where id = auth.uid())
  );

drop policy if exists "quote_items_org_insert" on public.quote_items;
create policy "quote_items_org_insert" on public.quote_items for insert to authenticated
  with check (
    organization_id in (select organization_id from public.profiles where id = auth.uid())
  );

drop policy if exists "quote_items_org_update" on public.quote_items;
create policy "quote_items_org_update" on public.quote_items for update to authenticated
  using (
    organization_id in (select organization_id from public.profiles where id = auth.uid())
  )
  with check (
    organization_id in (select organization_id from public.profiles where id = auth.uid())
  );

drop policy if exists "quote_items_org_delete" on public.quote_items;
create policy "quote_items_org_delete" on public.quote_items for delete to authenticated
  using (
    organization_id in (select organization_id from public.profiles where id = auth.uid())
  );

comment on table public.quotes is '견적서 헤더';
comment on table public.quote_items is '견적서 품목 행';
