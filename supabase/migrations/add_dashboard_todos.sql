-- 홈 대시보드 할 일 (계정별 동기화)
create table if not exists public.dashboard_todos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  text text not null,
  due_date date null,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dashboard_todos_user_id_idx
  on public.dashboard_todos (user_id);

create index if not exists dashboard_todos_org_user_idx
  on public.dashboard_todos (organization_id, user_id);

create index if not exists dashboard_todos_due_date_idx
  on public.dashboard_todos (user_id, due_date);

comment on table public.dashboard_todos is '홈 대시보드 오늘 할 일 (사용자별)';
comment on column public.dashboard_todos.due_date is '예정일 YYYY-MM-DD, null이면 미정';

alter table public.dashboard_todos enable row level security;

drop policy if exists "dashboard_todos_select_own" on public.dashboard_todos;
create policy "dashboard_todos_select_own"
  on public.dashboard_todos for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "dashboard_todos_insert_own" on public.dashboard_todos;
create policy "dashboard_todos_insert_own"
  on public.dashboard_todos for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "dashboard_todos_update_own" on public.dashboard_todos;
create policy "dashboard_todos_update_own"
  on public.dashboard_todos for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "dashboard_todos_delete_own" on public.dashboard_todos;
create policy "dashboard_todos_delete_own"
  on public.dashboard_todos for delete
  to authenticated
  using (auth.uid() = user_id);
