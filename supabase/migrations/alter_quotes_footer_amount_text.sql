-- 견적서: 하단 안내문구 + 품목 공급가액 텍스트(복합기 조건 등)
alter table public.quotes
  add column if not exists footer_notice text null;

alter table public.quote_items
  add column if not exists amount_text text null;

comment on column public.quotes.footer_notice is '비고 아래 문의/안내 문구';
comment on column public.quote_items.amount_text is '공급가액 칸 표시용 텍스트(보증금/기본요금 등). 있으면 숫자 공급가액 대신 표시';
