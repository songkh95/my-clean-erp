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
    
    // ✅ [수정 1] 입력 데이터 우선순위 변경
    // 사용자가 입력한 값(inputData)이 있으면 그것을 쓰고, 없으면 DB의 final_counts를 씁니다.
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

    // A3 가중치가 적용된 변환 사용량 (정산 기준)
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

  // 2. 그룹핑 (billing_group_id가 같으면 묶음)
  const groups: { [key: string]: CalculatedAsset[] } = {};
  tempCalculations.forEach(calc => {
    const groupKey = calc.billing_group_id || `INDIVIDUAL_${calc.inventory_id}`;
    if (!groups[groupKey]) groups[groupKey] = [];
    groups[groupKey].push(calc);
  });

  // 3. 그룹별 요금 계산 및 배분
  Object.values(groups).forEach(groupAssets => {
    
    // ✅ [수정 2] 교체 로직 적용: 그룹 내에 '교체전' 기계가 있다면 요금제를 0으로 무력화
    // (사용량은 유지하되, 기본료와 무료매수는 새 기계(Leader)의 것만 사용하도록 함)
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

    // 3.1 그룹 전체 합산 데이터 계산
    const groupTotalFreeBW = groupAssets.reduce((sum, item) => sum + item.plan.free_bw, 0);
    const groupTotalFreeCol = groupAssets.reduce((sum, item) => sum + item.plan.free_col, 0);
    
    const groupTotalUsageBW = groupAssets.reduce((sum, item) => sum + item.converted.bw, 0);
    const groupTotalUsageCol = groupAssets.reduce((sum, item) => sum + item.converted.col, 0);

    // 3.2 그룹 전체의 순수 초과 사용량 (Net Excess)
    const groupNetExtraBW = Math.max(0, groupTotalUsageBW - groupTotalFreeBW);
    const groupNetExtraCol = Math.max(0, groupTotalUsageCol - groupTotalFreeCol);

    // 그룹 내 사용량 (기본 제공량 이내)
    const groupBasicUsageBW = Math.min(groupTotalUsageBW, groupTotalFreeBW);
    const groupBasicUsageCol = Math.min(groupTotalUsageCol, groupTotalFreeCol);

    // 단가 (그룹 내 첫번째 기계 기준 - 보통 새 기계가 Leader가 됨)
    const unitPriceBW = groupAssets[0].plan.price_bw;
    const unitPriceCol = groupAssets[0].plan.price_col;

    // 그룹 전체 추가 요금 총액
    const groupTotalExtraFee = Math.floor((groupNetExtraBW * unitPriceBW) + (groupNetExtraCol * unitPriceCol));

    // 3.3 기계별 "초과 기여도" 계산 (비용 배분용)
    let totalIndivExcessBW = 0;
    let totalIndivExcessCol = 0;

    const indivExcessMap = groupAssets.map(asset => {
      const excessBW = Math.max(0, asset.converted.bw - asset.plan.free_bw);
      const excessCol = Math.max(0, asset.converted.col - asset.plan.free_col);
      
      totalIndivExcessBW += excessBW;
      totalIndivExcessCol += excessCol;

      return { id: asset.id, excessBW, excessCol };
    });

    // 3.4 비용 및 사용량 할당
    let distributedExtraFee = 0;

    groupAssets.forEach((asset, idx) => {
      const isLeader = idx === 0;
      const isLast = idx === groupAssets.length - 1;

      // 3.4.1 UI 제어용 플래그
      asset.isGroupLeader = isLeader;
      asset.groupSpan = isLeader ? groupAssets.length : 0;

      // 3.4.2 리더에게 그룹 통계 데이터 주입 (합산 기계 UI 표시용)
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

      // 3.4.3 개별 기계 사용량 Breakdown
      asset.usageBreakdown = { 
        basicBW: Math.min(asset.converted.bw, asset.plan.free_bw),
        extraBW: Math.max(0, asset.converted.bw - asset.plan.free_bw),
        basicCol: Math.min(asset.converted.col, asset.plan.free_col),
        extraCol: Math.max(0, asset.converted.col - asset.plan.free_col)
      };

      // 3.4.4 금액 계산
      const myBasicFee = asset.plan.basic_fee;

      // 추가요금 배분 (초과 기여도 비례)
      let myExtraFee = 0;
      const myIndiv = indivExcessMap.find(x => x.id === asset.id)!;
      
      const myExcessValue = (myIndiv.excessBW * unitPriceBW) + (myIndiv.excessCol * unitPriceCol);
      const totalExcessValue = (totalIndivExcessBW * unitPriceBW) + (totalIndivExcessCol * unitPriceCol);

      if (groupTotalExtraFee > 0 && totalExcessValue > 0) {
        const ratio = myExcessValue / totalExcessValue;
        
        if (isLast) {
          myExtraFee = groupTotalExtraFee - distributedExtraFee; // 잔수 처리
        } else {
          myExtraFee = Math.floor(groupTotalExtraFee * ratio);
          distributedExtraFee += myExtraFee;
        }
      }

      // 최종 금액 세팅
      asset.rowCost = {
        basic: myBasicFee,
        extra: myExtraFee,
        total: myBasicFee + myExtraFee
      };
    });
  });

  // 4. 총 청구액 합계
  const totalAmount = tempCalculations.reduce((sum, d) => sum + d.rowCost.total, 0);

  return { details: tempCalculations, totalAmount };
};