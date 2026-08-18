-- 견적서 도장/본사 로고 (조직 공용)
create table if not exists public.quote_branding (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  stamp_path text null,
  hq_logo_path text null,
  updated_at timestamptz not null default now()
);

alter table public.quote_branding enable row level security;

drop policy if exists "quote_branding_org_select" on public.quote_branding;
create policy "quote_branding_org_select" on public.quote_branding for select to authenticated
  using (
    organization_id in (select organization_id from public.profiles where id = auth.uid())
  );

drop policy if exists "quote_branding_org_insert" on public.quote_branding;
create policy "quote_branding_org_insert" on public.quote_branding for insert to authenticated
  with check (
    organization_id in (select organization_id from public.profiles where id = auth.uid())
  );

drop policy if exists "quote_branding_org_update" on public.quote_branding;
create policy "quote_branding_org_update" on public.quote_branding for update to authenticated
  using (
    organization_id in (select organization_id from public.profiles where id = auth.uid())
  )
  with check (
    organization_id in (select organization_id from public.profiles where id = auth.uid())
  );

drop policy if exists "quote_branding_org_delete" on public.quote_branding;
create policy "quote_branding_org_delete" on public.quote_branding for delete to authenticated
  using (
    organization_id in (select organization_id from public.profiles where id = auth.uid())
  );

-- Storage 버킷 (공개 URL — 인쇄/미리보기용)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'quote-branding',
  'quote-branding',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/jpg']
)
on conflict (id) do update
set public = true,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/jpg'];

drop policy if exists quote_branding_select on storage.objects;
drop policy if exists quote_branding_insert on storage.objects;
drop policy if exists quote_branding_update on storage.objects;
drop policy if exists quote_branding_delete on storage.objects;

-- 공개 읽기
create policy quote_branding_select
on storage.objects for select
to public
using (bucket_id = 'quote-branding');

create policy quote_branding_insert
on storage.objects for insert
to authenticated
with check (bucket_id = 'quote-branding');

create policy quote_branding_update
on storage.objects for update
to authenticated
using (bucket_id = 'quote-branding')
with check (bucket_id = 'quote-branding');

create policy quote_branding_delete
on storage.objects for delete
to authenticated
using (bucket_id = 'quote-branding');

comment on table public.quote_branding is '견적서 도장/본사 로고 경로 (조직별)';
