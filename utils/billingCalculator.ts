// utils/billingCalculator.ts
import { Client, Inventory, CalculatedAsset, BillCalculationResult, CounterData } from '@/app/types';

export const calculateClientBill = (
  client: Client,
  assets: Inventory[],
  prevData: { [key: string]: CounterData },
  inputData: { [key: string]: CounterData }
): BillCalculationResult => {
  if (!assets || assets.length === 0) {
    return { details: [], totalAmount: 0 };
  }

  // 1. 각 기계별 사용량 계산
  let tempCalculations: CalculatedAsset[] = assets.map(inv => {
    const p = prevData[inv.id] || { bw: 0, col: 0, bw_a3: 0, col_a3: 0 };
    
    // 철수/교체 기기 대응 로직
    const isWithdrawn = inv.is_replacement_before || inv.is_withdrawal;
    const c = isWithdrawn && inv.final_counts 
      ? inv.final_counts 
      : (inputData[inv.id] || { bw: 0, col: 0, bw_a3: 0, col_a3: 0 });

    const usageRawBW = Math.max(0, (c.bw || 0) - (p.bw || 0));
    const usageRawCol = Math.max(0, (c.col || 0) - (p.col || 0));
    const usageRawBW_A3 = Math.max(0, (c.bw_a3 || 0) - (p.bw_a3 || 0));
    const usageRawCol_A3 = Math.max(0, (c.col_a3 || 0) - (p.col_a3 || 0));

    const weightBW = inv.plan_weight_a3_bw || 1;
    const weightCol = inv.plan_weight_a3_col || 1;

    const convertedBW = usageRawBW + (usageRawBW_A3 * weightBW);
    const convertedCol = usageRawCol + (usageRawCol_A3 * weightCol);

    // CalculatedAsset 객체 생성 (Inventory 속성 상속)
    return {
      ...inv,
      inventory_id: inv.id,
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

  // 2. 합산 청구 그룹화
  const groups: { [key: string]: CalculatedAsset[] } = {};
  tempCalculations.forEach(calc => {
    const groupKey = calc.billing_group_id || `INDIVIDUAL_${calc.inventory_id}`;
    if (!groups[groupKey]) groups[groupKey] = [];
    groups[groupKey].push(calc);
  });

  // 3. 그룹별 합산 요금 계산
  Object.values(groups).forEach(groupAssets => {
    const groupBasicFee = groupAssets.reduce((sum, item) => sum + item.plan.basic_fee, 0);
    const groupFreeBW = groupAssets.reduce((sum, item) => sum + item.plan.free_bw, 0);
    const groupFreeCol = groupAssets.reduce((sum, item) => sum + item.plan.free_col, 0);
    
    const groupUsageBW = groupAssets.reduce((sum, item) => sum + item.converted.bw, 0);
    const groupUsageCol = groupAssets.reduce((sum, item) => sum + item.converted.col, 0);

    const usedBasicBW = Math.min(groupUsageBW, groupFreeBW);
    const usedExtraBW = Math.max(0, groupUsageBW - groupFreeBW);
    const usedBasicCol = Math.min(groupUsageCol, groupFreeCol);
    const usedExtraCol = Math.max(0, groupUsageCol - groupFreeCol);

    const unitPriceBW = groupAssets[0].plan.price_bw;
    const unitPriceCol = groupAssets[0].plan.price_col;

    const groupExtraFee = (usedExtraBW * unitPriceBW) + (usedExtraCol * unitPriceCol);
    const groupTotal = groupBasicFee + groupExtraFee;

    groupAssets.forEach((asset, idx) => {
      if (idx === 0) {
        asset.isGroupLeader = true;
        asset.groupSpan = groupAssets.length;
        asset.rowCost = { basic: groupBasicFee, extra: groupExtraFee, total: groupTotal };
        asset.usageBreakdown = { basicBW: usedBasicBW, extraBW: usedExtraBW, basicCol: usedBasicCol, extraCol: usedExtraCol };
      } else { 
        asset.isGroupLeader = false;
        asset.groupSpan = 0; 
        asset.rowCost = { basic: 0, extra: 0, total: 0 };
        asset.usageBreakdown = { basicBW: 0, extraBW: 0, basicCol: 0, extraCol: 0 };
      }
    });
  });

  const totalAmount = tempCalculations.reduce((sum, d) => sum + (d.isGroupLeader ? d.rowCost.total : 0), 0);

  return { details: tempCalculations, totalAmount };
};