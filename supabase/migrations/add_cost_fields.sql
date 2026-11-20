-- 원가 분석에 쓰는 선택 입력 항목들
--  · consumables.life_pages      : 소모품 1개로 찍을 수 있는 장수 (환산 원가용)
--  · inventory.setup_cost        : 설치비
--  · inventory.initial_toner_cost: 설치 시 넣어 준 초기 소모품 값
-- 모두 비워 둬도 되고, 비면 0 또는 "환산 안 함"으로 본다.

alter table public.consumables
  add column if not exists life_pages integer null;

comment on column public.consumables.life_pages is '라이프(장) — 1개로 찍을 수 있는 장수. 비면 환산 원가를 내지 않는다';

alter table public.inventory
  add column if not exists setup_cost integer null,
  add column if not exists initial_toner_cost integer null;

comment on column public.inventory.setup_cost is '설치비 (선택). 감가 계산에 매입가와 함께 들어간다';
comment on column public.inventory.initial_toner_cost is '설치 시 초기 소모품 값 (선택). 감가 계산에 매입가와 함께 들어간다';
