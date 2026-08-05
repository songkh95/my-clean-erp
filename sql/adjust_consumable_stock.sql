-- 원자적 재고 RPC만 설치 (서비스 일지 경고 해결용)
-- Supabase → SQL Editor → New query → 전체 실행

DROP FUNCTION IF EXISTS decrement_stock(uuid, integer);
DROP FUNCTION IF EXISTS adjust_consumable_stock(uuid, integer);

CREATE OR REPLACE FUNCTION adjust_consumable_stock(p_id uuid, p_delta integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_stock integer;
BEGIN
  IF p_id IS NULL THEN
    RAISE EXCEPTION 'consumable id required';
  END IF;

  -- p_delta = 0 이면 존재 확인만 (스키마 체크용)
  IF p_delta = 0 THEN
    SELECT current_stock INTO new_stock FROM consumables WHERE id = p_id;
    IF NOT FOUND THEN
      RETURN 0; -- 없는 id여도 함수 존재만 확인하면 OK
    END IF;
    RETURN COALESCE(new_stock, 0);
  END IF;

  SELECT current_stock INTO new_stock
  FROM consumables
  WHERE id = p_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'consumable not found: %', p_id;
  END IF;

  new_stock := COALESCE(new_stock, 0) + p_delta;
  IF new_stock < 0 THEN
    RAISE EXCEPTION 'insufficient stock for % (result %)', p_id, new_stock;
  END IF;

  UPDATE consumables
  SET current_stock = new_stock
  WHERE id = p_id;

  RETURN new_stock;
END;
$$;

GRANT EXECUTE ON FUNCTION adjust_consumable_stock(uuid, integer) TO authenticated;

CREATE OR REPLACE FUNCTION decrement_stock(row_id uuid, amount integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN adjust_consumable_stock(row_id, -amount);
END;
$$;

GRANT EXECUTE ON FUNCTION decrement_stock(uuid, integer) TO authenticated;

-- 설치 확인 (에러 없이 0이 나오면 성공)
SELECT adjust_consumable_stock('00000000-0000-0000-0000-000000000000'::uuid, 0) AS ok;
