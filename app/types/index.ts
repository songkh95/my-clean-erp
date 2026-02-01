// app/types/index.ts

// 1. 거래처 (Clients)
export interface Client {
  id: string;
  organization_id: string;
  name: string;
  business_number?: string;
  representative_name?: string;
  contact_person?: string;
  phone?: string;
  office_phone?: string;
  email?: string;
  address?: string;
  parent_id?: string | null;
  status?: string;
  created_at?: string;
  is_deleted?: boolean;
  memo?: string; // ✅ 에러 해결: memo 추가
}

// 2. 카운터 데이터 (CounterData)
export interface CounterData {
  bw: number;
  col: number;
  bw_a3: number;
  col_a3: number;
}

// 3. 자산/기계 (Inventory)
export interface Inventory {
  id: string;
  organization_id: string;
  client_id: string | null;
  type: string;
  category: string;
  brand: string;
  model_name: string;
  serial_number: string;
  status: string;
  purchase_date?: string;
  purchase_price?: number;
  created_at?: string; // ✅ 에러 해결: created_at 추가
  
  initial_count_bw: number;
  initial_count_col: number;
  initial_count_bw_a3: number;
  initial_count_col_a3: number;

  plan_basic_fee: number;
  plan_basic_cnt_bw: number;
  plan_basic_cnt_col: number;
  plan_price_bw: number;
  plan_price_col: number;
  plan_weight_a3_bw: number;
  plan_weight_a3_col: number;
  
  billing_group_id?: string | null;
  billing_date?: string;
  memo?: string;
  
  client?: Client;

  // UI 확장 필드
  is_active?: boolean;
  is_replacement_before?: boolean;
  is_replacement_after?: boolean;
  is_withdrawal?: boolean;
  final_counts?: CounterData;
}

// 4. 계산된 자산 정보 (CalculatedAsset)
export interface CalculatedAsset extends Inventory {
  inventory_id: string;
  prev: CounterData;
  curr: CounterData;
  usage: CounterData;
  converted: { bw: number; col: number };
  usageBreakdown: { basicBW: number; extraBW: number; basicCol: number; extraCol: number };
  plan: {
    basic_fee: number;
    free_bw: number;
    free_col: number;
    price_bw: number;
    price_col: number;
  };
  rowCost: { basic: number; extra: number; total: number };
  isGroupLeader: boolean;
  groupSpan: number;
}

// 5. 정산 계산 결과
export interface BillCalculationResult {
  details: CalculatedAsset[];
  totalAmount: number;
}

// 6. 기계 이력
export interface MachineHistory {
  id: string;
  inventory_id: string;
  client_id: string;
  organization_id: string;
  action_type: 'INSTALL' | 'WITHDRAW' | 'AS';
  recorded_at: string;
  memo?: string;
  bw_count: number;
  col_count: number;
  bw_a3_count: number;
  col_a3_count: number;
  inventory?: Inventory;
}

// 7. 정산 메인 (Settlement)
export interface Settlement {
  id: string;
  client_id: string;
  organization_id: string;
  billing_year: number;
  billing_month: number;
  total_amount: number;
  is_paid: boolean;
  created_at: string;
  client?: Client;
  details?: SettlementDetail[]; // ✅ 에러 해결: 선택적(?) 속성으로 변경
  memo?: string;
}

// 8. 정산 상세
export interface SettlementDetail {
  id: string;
  settlement_id: string;
  inventory_id: string;
  
  prev_count_bw: number;
  curr_count_bw: number;
  prev_count_col: number;
  curr_count_col: number;
  prev_count_bw_a3?: number;
  curr_count_bw_a3?: number;
  prev_count_col_a3?: number;
  curr_count_col_a3?: number;
  
  calculated_amount: number;
  is_replacement_record: boolean;
  is_paid: boolean;

  inventory?: Inventory;
}