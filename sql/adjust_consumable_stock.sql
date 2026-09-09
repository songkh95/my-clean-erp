-- 원자적 재고 RPC + 조직 소유권 검증 (보안 수정 반영)
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
  owner_org uuid;
BEGIN
  IF p_id IS NULL THEN
    RAISE EXCEPTION 'consumable id required';
  END IF;

  -- 다른 조직 소모품을 건드리지 못하도록 소유권 검증
  SELECT organization_id INTO owner_org FROM consumables WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'consumable not found: %', p_id;
  END IF;
  IF owner_org IS DISTINCT FROM get_my_org_id() THEN
    RAISE EXCEPTION 'not authorized for this consumable';
  END IF;

  -- p_delta = 0 이면 존재/소유권 확인만 (스키마 체크용, 재고 변경 없음)
  IF p_delta = 0 THEN
    SELECT current_stock INTO new_stock FROM consumables WHERE id = p_id;
    RETURN COALESCE(new_stock, 0);
  END IF;

  SELECT current_stock INTO new_stock
  FROM consumables
  WHERE id = p_id
  FOR UPDATE;

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

-- 설치 확인
-- 주의: 존재하지 않는 id(예: 전부 0인 UUID)로 호출하면 이제는
-- 'consumable not found' 예외가 정상 동작입니다 (소유권 검증이 먼저 실행되기 때문).
-- 함수가 정상 설치됐는지만 확인하려면 우리 조직 소유의 실제 소모품 id로 delta=0 호출하세요:
-- SELECT adjust_consumable_stock('<내 조직의 실제 consumable id>'::uuid, 0) AS ok;
