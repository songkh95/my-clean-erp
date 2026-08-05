-- 색상만 같다고 한 줄로 묶던 유니크 인덱스 제거
-- (품명이 다르면 같은 K/C/M/Y 토너를 여러 개 둘 수 있음)

DROP INDEX IF EXISTS consumables_org_toner_color_uidx;
