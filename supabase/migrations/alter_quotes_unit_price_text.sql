-- 견적서 품목: 단가란 텍스트(보증금/기본요금 라벨 등)
alter table public.quote_items
  add column if not exists unit_price_text text null;

comment on column public.quote_items.unit_price_text is '단가 칸 표시용 텍스트(보증금/기본요금 등). 있으면 숫자 단가 대신 표시';
