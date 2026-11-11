-- 기기 교체(맞교환)를 한 번의 트랜잭션으로 처리한다.
-- 회수 이력 → 구기계 회수 → 신기계 설치 → 설치 이력 4단계 중 하나라도 실패하면
-- 전부 되돌아가므로, 구기계만 빠진 채 남는 어긋난 상태가 생기지 않는다.
-- Supabase → SQL Editor → New query → 전체 실행

CREATE OR REPLACE FUNCTION replace_machine_tx(
  p_client uuid,
  p_old uuid,
  p_new uuid,
  p_final jsonb,
  p_init jsonb,
  p_contract jsonb,
  p_plan jsonb,
  p_memo text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid := get_my_org_id();
  v_old inventory;
  v_new inventory;
  v_group uuid;
BEGIN
  IF v_org IS NULL THEN
    RAISE EXCEPTION '조직 정보를 찾을 수 없습니다.';
  END IF;
  IF p_old IS NULL OR p_new IS NULL OR p_client IS NULL THEN
    RAISE EXCEPTION '거래처와 기기를 모두 선택해 주세요.';
  END IF;
  IF p_old = p_new THEN
    RAISE EXCEPTION '같은 기기로는 교체할 수 없습니다.';
  END IF;

  SELECT * INTO v_old FROM inventory WHERE id = p_old FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION '기존 기기 정보를 찾을 수 없습니다.';
  END IF;
  IF v_old.organization_id IS DISTINCT FROM v_org THEN
    RAISE EXCEPTION '권한이 없는 기기입니다.';
  END IF;
  IF v_old.client_id IS DISTINCT FROM p_client THEN
    RAISE EXCEPTION '기존 기기가 이 거래처에 설치되어 있지 않습니다. 화면을 새로 고친 뒤 다시 시도해 주세요.';
  END IF;

  SELECT * INTO v_new FROM inventory WHERE id = p_new FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION '새 기기 정보를 찾을 수 없습니다.';
  END IF;
  IF v_new.organization_id IS DISTINCT FROM v_org THEN
    RAISE EXCEPTION '권한이 없는 기기입니다.';
  END IF;
  IF COALESCE(v_new.is_deleted, false) THEN
    RAISE EXCEPTION '휴지통에 있는 기기는 설치할 수 없습니다. 먼저 복구해 주세요.';
  END IF;
  IF v_new.client_id IS NOT NULL THEN
    RAISE EXCEPTION '새 기기가 이미 다른 거래처에 설치되어 있습니다. 그 거래처에서 철수한 뒤 다시 시도해 주세요.';
  END IF;

  -- [1] 기존 기기 회수 이력
  INSERT INTO machine_history (
    inventory_id, client_id, organization_id, action_type,
    bw_count, col_count, bw_a3_count, col_a3_count, memo, is_replacement
  ) VALUES (
    p_old, p_client, v_org, 'WITHDRAW',
    COALESCE((p_final->>'bw')::int, 0),
    COALESCE((p_final->>'col')::int, 0),
    COALESCE((p_final->>'bw_a3')::int, 0),
    COALESCE((p_final->>'col_a3')::int, 0),
    '교체로 인한 회수: ' || COALESCE(p_memo, ''), true
  );

  -- [2] 기존 기기 회수 — 요금제·계약은 그대로 둔다(그 달 마지막 청구 계산에 쓰임)
  v_group := COALESCE(v_old.billing_group_id, gen_random_uuid());

  UPDATE inventory
  SET status = '창고',
      client_id = NULL,
      billing_group_id = v_group
  WHERE id = p_old;

  -- [3] 새 기기 설치 — 팝업에서 확정한 요금제 적용, 청구일은 승계
  UPDATE inventory
  SET status = '설치',
      client_id = p_client,
      initial_count_bw = COALESCE((p_init->>'bw')::int, 0),
      initial_count_col = COALESCE((p_init->>'col')::int, 0),
      initial_count_bw_a3 = COALESCE((p_init->>'bw_a3')::int, 0),
      initial_count_col_a3 = COALESCE((p_init->>'col_a3')::int, 0),
      contract_start_date = NULLIF(p_contract->>'start_date', '')::date,
      contract_end_date = NULLIF(p_contract->>'end_date', '')::date,
      billing_group_id = v_group,
      plan_basic_fee = COALESCE((p_plan->>'basic_fee')::numeric, 0),
      plan_basic_cnt_bw = COALESCE((p_plan->>'basic_cnt_bw')::int, 0),
      plan_basic_cnt_col = COALESCE((p_plan->>'basic_cnt_col')::int, 0),
      plan_price_bw = COALESCE((p_plan->>'price_bw')::numeric, 0),
      plan_price_col = COALESCE((p_plan->>'price_col')::numeric, 0),
      plan_weight_a3_bw = COALESCE((p_plan->>'weight_a3_bw')::numeric, 1),
      plan_weight_a3_col = COALESCE((p_plan->>'weight_a3_col')::numeric, 1),
      billing_date = v_old.billing_date
  WHERE id = p_new;

  -- [4] 새 기기 설치 이력
  INSERT INTO machine_history (
    inventory_id, client_id, organization_id, action_type,
    bw_count, col_count, bw_a3_count, col_a3_count, memo, is_replacement
  ) VALUES (
    p_new, p_client, v_org, 'INSTALL',
    COALESCE((p_init->>'bw')::int, 0),
    COALESCE((p_init->>'col')::int, 0),
    COALESCE((p_init->>'bw_a3')::int, 0),
    COALESCE((p_init->>'col_a3')::int, 0),
    '교체로 인한 설치', true
  );

  RETURN v_group;
END;
$$;

GRANT EXECUTE ON FUNCTION replace_machine_tx(uuid, uuid, uuid, jsonb, jsonb, jsonb, jsonb, text) TO authenticated;
