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

  // 1. 각 기계별 기초 사용량 및 변환 매수 계산
  let tempCalculations: CalculatedAsset[] = assets.map(inv => {
    const p = prevData[inv.id] || { bw: 0, col: 0, bw_a3: 0, col_a3: 0 };
    
    const isWithdrawn = inv.is_replacement_before || inv.is_withdrawal;
    const c = inputData[inv.id] 
      ? inputData[inv.id] 
      : (isWithdrawn && inv.final_counts ? inv.final_counts : { bw: 0, col: 0, bw_a3: 0, col_a3: 0 });

    const usageRawBW = Math.max(0, (c.bw || 0) - (p.bw || 0));
    const usageRawCol = Math.max(0, (c.col || 0) - (p.col || 0));
    const usageRawBW_A3 = Math.max(0, (c.bw_a3 || 0) - (p.bw_a3 || 0));
    const usageRawCol_A3 = Math.max(0, (c.col_a3 || 0) - (p.col_a3 || 0));

    const weightBW = inv.plan_weight_a3_bw || 1;
    const weightCol = inv.plan_weight_a3_col || 1;

    const convertedBW = usageRawBW + (usageRawBW_A3 * weightBW);
    const convertedCol = usageRawCol + (usageRawCol_A3 * weightCol);

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
      isGroupLeader: false,
      groupSpan: 1
    };
  });

  // 2. 그룹핑
  const groups: { [key: string]: CalculatedAsset[] } = {};
  tempCalculations.forEach(calc => {
    const groupKey = calc.billing_group_id || `INDIVIDUAL_${calc.inventory_id}`;
    if (!groups[groupKey]) groups[groupKey] = [];
    groups[groupKey].push(calc);
  });

  // 3. 그룹별 요금 계산 및 배분
  Object.values(groups).forEach(groupAssets => {
    // 활성(설치 중) 기계를 리더로 — 교체전/철수 기계는 뒤로
    groupAssets.sort((a, b) => {
      const aInactive = (a.is_replacement_before || a.is_withdrawal) ? 1 : 0;
      const bInactive = (b.is_replacement_before || b.is_withdrawal) ? 1 : 0;
      if (aInactive !== bInactive) return aInactive - bInactive;
      return String(a.inventory_id).localeCompare(String(b.inventory_id));
    });

    const hasActiveMachine = groupAssets.some(a => !a.is_replacement_before && !a.is_withdrawal);
    
    if (hasActiveMachine) {
      groupAssets.forEach(asset => {
        if (asset.is_replacement_before || asset.is_withdrawal) {
          asset.plan.basic_fee = 0;
          asset.plan.free_bw = 0;
          asset.plan.free_col = 0;
        }
      });
    }

    const groupTotalFreeBW = groupAssets.reduce((sum, item) => sum + item.plan.free_bw, 0);
    const groupTotalFreeCol = groupAssets.reduce((sum, item) => sum + item.plan.free_col, 0);
    
    const groupTotalUsageBW = groupAssets.reduce((sum, item) => sum + item.converted.bw, 0);
    const groupTotalUsageCol = groupAssets.reduce((sum, item) => sum + item.converted.col, 0);

    const groupNetExtraBW = Math.max(0, groupTotalUsageBW - groupTotalFreeBW);
    const groupNetExtraCol = Math.max(0, groupTotalUsageCol - groupTotalFreeCol);

    const groupBasicUsageBW = Math.min(groupTotalUsageBW, groupTotalFreeBW);
    const groupBasicUsageCol = Math.min(groupTotalUsageCol, groupTotalFreeCol);

    // 리더(활성 기기) 단가 사용
    const leader = groupAssets[0];
    const unitPriceBW = leader.plan.price_bw;
    const unitPriceCol = leader.plan.price_col;

    const groupTotalExtraFee = Math.floor((groupNetExtraBW * unitPriceBW) + (groupNetExtraCol * unitPriceCol));

    let totalIndivExcessBW = 0;
    let totalIndivExcessCol = 0;

    const indivExcessMap = groupAssets.map(asset => {
      const excessBW = Math.max(0, asset.converted.bw - asset.plan.free_bw);
      const excessCol = Math.max(0, asset.converted.col - asset.plan.free_col);
      
      totalIndivExcessBW += excessBW;
      totalIndivExcessCol += excessCol;

      return { id: asset.id, excessBW, excessCol };
    });

    let distributedExtraFee = 0;

    groupAssets.forEach((asset, idx) => {
      const isLeader = idx === 0;
      const isLast = idx === groupAssets.length - 1;

      asset.isGroupLeader = isLeader;
      asset.groupSpan = isLeader ? groupAssets.length : 0;

      if (isLeader) {
        asset.groupUsageBreakdown = {
          poolBasicBW: groupTotalFreeBW,
          poolBasicCol: groupTotalFreeCol,
          basicBW: groupBasicUsageBW,
          extraBW: groupNetExtraBW,
          basicCol: groupBasicUsageCol,
          extraCol: groupNetExtraCol
        };
      }

      asset.usageBreakdown = { 
        basicBW: Math.min(asset.converted.bw, asset.plan.free_bw),
        extraBW: Math.max(0, asset.converted.bw - asset.plan.free_bw),
        basicCol: Math.min(asset.converted.col, asset.plan.free_col),
        extraCol: Math.max(0, asset.converted.col - asset.plan.free_col)
      };

      const myBasicFee = asset.plan.basic_fee;

      let myExtraFee = 0;
      const myIndiv = indivExcessMap.find(x => x.id === asset.id)!;
      
      const myExcessValue = (myIndiv.excessBW * unitPriceBW) + (myIndiv.excessCol * unitPriceCol);
      const totalExcessValue = (totalIndivExcessBW * unitPriceBW) + (totalIndivExcessCol * unitPriceCol);

      if (groupTotalExtraFee > 0 && totalExcessValue > 0) {
        const ratio = myExcessValue / totalExcessValue;
        
        if (isLast) {
          myExtraFee = groupTotalExtraFee - distributedExtraFee;
        } else {
          myExtraFee = Math.floor(groupTotalExtraFee * ratio);
          distributedExtraFee += myExtraFee;
        }
      }

      asset.rowCost = {
        basic: myBasicFee,
        extra: myExtraFee,
        total: myBasicFee + myExtraFee
      };
    });
  });

  const totalAmount = tempCalculations.reduce((sum, d) => sum + d.rowCost.total, 0);

  return { details: tempCalculations, totalAmount };
};

/** 단기기(이력 수정)용 금액 재계산 — 그룹 없으면 개별 요금제 기준 */
export function calculateSingleDetailAmount(params: {
  prev: CounterData
  curr: CounterData
  plan_basic_fee?: number | null
  plan_basic_cnt_bw?: number | null
  plan_basic_cnt_col?: number | null
  plan_price_bw?: number | null
  plan_price_col?: number | null
  plan_weight_a3_bw?: number | null
  plan_weight_a3_col?: number | null
}) {
  const usage = {
    bw: Math.max(0, (params.curr.bw || 0) - (params.prev.bw || 0)),
    col: Math.max(0, (params.curr.col || 0) - (params.prev.col || 0)),
    bw_a3: Math.max(0, (params.curr.bw_a3 || 0) - (params.prev.bw_a3 || 0)),
    col_a3: Math.max(0, (params.curr.col_a3 || 0) - (params.prev.col_a3 || 0)),
  }
  const wBw = params.plan_weight_a3_bw || 1
  const wCol = params.plan_weight_a3_col || 1
  const converted = {
    bw: usage.bw + usage.bw_a3 * wBw,
    col: usage.col + usage.col_a3 * wCol,
  }
  const extraBw = Math.max(0, converted.bw - (params.plan_basic_cnt_bw || 0))
  const extraCol = Math.max(0, converted.col - (params.plan_basic_cnt_col || 0))
  const amount =
    (params.plan_basic_fee || 0) +
    extraBw * (params.plan_price_bw || 0) +
    extraCol * (params.plan_price_col || 0)

  return { usage, converted, amount }
}
