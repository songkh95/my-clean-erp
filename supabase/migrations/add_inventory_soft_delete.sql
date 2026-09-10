-- 기기(inventory) 소프트 삭제 지원
-- 삭제해도 machine_history(설치/철수 이력), settlement_details(정산), service_logs(서비스 일지)는
-- 그대로 유지되도록 실제 DELETE 대신 is_deleted 플래그로 숨김 처리한다. (휴지통 기능)
alter table public.inventory
  add column if not exists is_deleted boolean not null default false,
  add column if not exists deleted_at timestamptz;

create index if not exists inventory_is_deleted_idx
  on public.inventory (organization_id, is_deleted);
