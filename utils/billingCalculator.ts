// utils/billingCalculator.ts

export interface BillCalculationResult {
  details: any[];
  totalAmount: number;
}

/**
 * 특정 거래처의 기계 목록에 대한 청구 금액을 계산하는 핵심 함수
 * @param client 거래처 객체
 * @param assets 해당 거래처에 설치된 기계 리스트 (inventoryMap[client.id])
 * @param prevData 전월 카운터 데이터 객체
 * @param inputData 당월 입력 카운터 데이터 객체
 */
export const calculateClientBill = (
  client: any,
  assets: any[],
  prevData: { [key: string]: any },
  inputData: { [key: string]: any }
): BillCalculationResult => {
  if (!assets || assets.length === 0) {
    return { details: [], totalAmount: 0 };
  }

  // 1. 각 기계별 사용량 계산 (1차 가공)
  let tempCalculations: any[] = assets.map(inv => {
    const p = prevData[inv.id] || { bw: 0, col: 0, bw_a3: 0, col_a3: 0 };
    
    // 철수/교체 전 기계는 final_counts 사용, 그 외는 inputData 사용
    const isWithdrawn = inv.is_replacement_before || inv.is_withdrawal;
    const c = isWithdrawn ? inv.final_counts : (inputData[inv.id] || { bw: 0, col: 0, bw_a3: 0, col_a3: 0 });

    const usageRawBW = Math.max(0, (c.bw || 0) - (p.bw || 0));
    const usageRawCol = Math.max(0, (c.col || 0) - (p.col || 0));
    const usageRawBW_A3 = Math.max(0, (c.bw_a3 || 0) - (p.bw_a3 || 0));
    const usageRawCol_A3 = Math.max(0, (c.col_a3 || 0) - (p.col_a3 || 0));

    const weightBW = inv.plan_weight_a3_bw || 1;
    const weightCol = inv.plan_weight_a3_col || 1;

    // A3 가중치 적용된 환산 매수
    const convertedBW = usageRawBW + (usageRawBW_A3 * weightBW);
    const convertedCol = usageRawCol + (usageRawCol_A3 * weightCol);

    return {
      inv,
      inventory_id: inv.id,
      model_name: inv.model_name,
      serial_number: inv.serial_number,
      billing_group_id: inv.billing_group_id,
      prev: p,
      curr: c,
      usage: { bw: usageRawBW, col: usageRawCol, bw_a3: usageRawBW_A3, col_a3: usageRawCol_A3 },
      converted: { bw: convertedBW, col: convertedCol },
      usageBreakdown: { basicBW: 0, extraBW: 0, basicCol: 0, extraCol: 0 },
      plan: {
        basic_fee: inv.plan_basic_fee || 0,
        free_bw: inv.plan_basic_cnt_bw || 0,
        free_col: inv.plan_basic_cnt_col || 0,
        price_bw: inv.plan_price_bw || 0,
        price_col: inv.plan_price_col || 0
      },
      rowCost: { basic: 0, extra: 0, total: 0 },
      isGroupLeader: true,
      groupSpan: 1
    };
  });

  // 2. 청구 그룹별로 묶기 (합산 청구 로직)
  const groups: { [key: string]: any[] } = {};
  tempCalculations.forEach(calc => {
    // 그룹 ID가 없으면 기계 ID를 사용하여 개별 그룹으로 취급
    const groupKey = calc.billing_group_id || `INDIVIDUAL_${calc.inventory_id}`;
    if (!groups[groupKey]) groups[groupKey] = [];
    groups[groupKey].push(calc);
  });

  // 3. 그룹별 요금 계산
  Object.values(groups).forEach(groupAssets => {
    // 그룹 내 모든 기계의 기본료, 무료 매수, 사용량 합산
    const groupBasicFee = groupAssets.reduce((sum, item) => sum + item.plan.basic_fee, 0);
    const groupFreeBW = groupAssets.reduce((sum, item) => sum + item.plan.free_bw, 0);
    const groupFreeCol = groupAssets.reduce((sum, item) => sum + item.plan.free_col, 0);
    
    const groupUsageBW = groupAssets.reduce((sum, item) => sum + item.converted.bw, 0);
    const groupUsageCol = groupAssets.reduce((sum, item) => sum + item.converted.col, 0);

    // 기본 제공량 차감 및 초과량 계산
    const usedBasicBW = Math.min(groupUsageBW, groupFreeBW);
    const usedExtraBW = Math.max(0, groupUsageBW - groupFreeBW);
    
    const usedBasicCol = Math.min(groupUsageCol, groupFreeCol);
    const usedExtraCol = Math.max(0, groupUsageCol - groupFreeCol);

    // 단가는 그룹 내 첫 번째 기계 기준 (그룹 내 기계는 단가가 동일해야 함을 가정)
    const unitPriceBW = groupAssets[0].plan.price_bw;
    const unitPriceCol = groupAssets[0].plan.price_col;

    const groupExtraFee = (usedExtraBW * unitPriceBW) + (usedExtraCol * unitPriceCol);
    const groupTotal = groupBasicFee + groupExtraFee;

    // 그룹 리더(첫 번째 기계)에게 금액 정보 몰아주기
    groupAssets.forEach((asset, idx) => {
      if (idx === 0) {
        asset.isGroupLeader = true;
        asset.groupSpan = groupAssets.length;
        asset.rowCost = { basic: groupBasicFee, extra: groupExtraFee, total: groupTotal };
        asset.usageBreakdown = { 
          basicBW: usedBasicBW, extraBW: usedExtraBW, 
          basicCol: usedBasicCol, extraCol: usedExtraCol 
        };
      } else { 
        asset.isGroupLeader = false;
        asset.groupSpan = 0; 
        asset.rowCost = { basic: 0, extra: 0, total: 0 };
        asset.usageBreakdown = { basicBW: 0, extraBW: 0, basicCol: 0, extraCol: 0 };
      }
    });
  });

  // 4. 총 청구액 계산
  const totalAmount = tempCalculations.reduce((sum, d) => sum + (d.isGroupLeader ? (d.rowCost?.total || 0) : 0), 0);

  return { details: tempCalculations, totalAmount };
};