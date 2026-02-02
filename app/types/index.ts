// app/types/index.ts
import { Database } from '@/types/supabase'

// 1. 기본 Row 타입 추출 헬퍼
type InventoryRow = Database['public']['Tables']['inventory']['Row']
type ClientRow = Database['public']['Tables']['clients']['Row']
type SettlementRow = Database['public']['Tables']['settlements']['Row']
type SettlementDetailRow = Database['public']['Tables']['settlement_details']['Row']
type MachineHistoryRow = Database['public']['Tables']['machine_history']['Row']

// 2. Client 타입 (Row 그대로 사용 + null 처리 보완)
export interface Client extends ClientRow {}

// 3. Inventory 타입 (조인된 데이터 포함)
export interface Inventory extends InventoryRow {
  // Supabase join 결과는 단일 객체일수도, null일수도 있음
  client?: { name: string } | null; 

  // UI 확장 필드 (DB에는 없지만 프론트에서 쓰는 값들)
  is_active?: boolean;
  is_replacement_before?: boolean;
  is_replacement_after?: boolean;
  is_withdrawal?: boolean;
  final_counts?: CounterData;
}

// 4. CounterData (기존 유지)
export interface CounterData {
  bw: number;
  col: number;
  bw_a3: number;
  col_a3: number;
}

// 5. CalculatedAsset (Inventory 상속 + 계산 필드 추가)
// Inventory의 숫자 필드들이 DB에서는 null일 수 있지만, 계산 시에는 number로 취급해야 함
// 따라서 필요한 필드들을 필수(Required)로 재정의합니다.
export interface CalculatedAsset extends Omit<Inventory, 'plan_basic_fee' | 'plan_basic_cnt_bw' | 'plan_basic_cnt_col' | 'plan_price_bw' | 'plan_price_col'> {
  inventory_id: string;
  
  // 계산 로직에서 null 방지된 값들
  plan: {
    basic_fee: number;
    free_bw: number;
    free_col: number;
    price_bw: number;
    price_col: number;
  };

  prev: CounterData;
  curr: CounterData;
  usage: CounterData;
  converted: { bw: number; col: number };
  usageBreakdown: { basicBW: number; extraBW: number; basicCol: number; extraCol: number };
  
  rowCost: { basic: number; extra: number; total: number };
  isGroupLeader: boolean;
  groupSpan: number;
}

// 6. 정산 결과
export interface BillCalculationResult {
  details: CalculatedAsset[];
  totalAmount: number;
}

// 7. Settlement (조인 데이터 포함)
export interface Settlement extends SettlementRow {
  client?: { 
    name: string; 
    business_number: string | null; 
    representative_name: string | null; 
    email: string | null; 
    address: string | null 
  } | null;
  details?: SettlementDetail[];
}

// 8. SettlementDetail (조인 데이터 포함)
export interface SettlementDetail extends SettlementDetailRow {
  inventory?: {
    model_name: string;
    serial_number: string;
    status: string;
    billing_date: string | null;
  } | null;
}

// 9. MachineHistory
export interface MachineHistory extends MachineHistoryRow {
  inventory?: Inventory | null;
}