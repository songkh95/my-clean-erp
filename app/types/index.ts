// app/types/index.ts

import { Database } from '@/types/supabase'

// 1. 기본 Row 타입 추출
type InventoryRow = Database['public']['Tables']['inventory']['Row']
type ClientRow = Database['public']['Tables']['clients']['Row']
type SettlementRow = Database['public']['Tables']['settlements']['Row']
type SettlementDetailRow = Database['public']['Tables']['settlement_details']['Row']
type MachineHistoryRow = Database['public']['Tables']['machine_history']['Row']

// 2. Client 타입
export interface Client extends ClientRow {}

// 3. Inventory 타입
export interface Inventory extends InventoryRow {
  client?: { name: string } | null; 
  is_active?: boolean;
  is_replacement_before?: boolean;
  is_replacement_after?: boolean;
  is_withdrawal?: boolean;
  final_counts?: CounterData;
}

// 4. CounterData
export interface CounterData {
  bw: number;
  col: number;
  bw_a3: number;
  col_a3: number;
}

// 5. CalculatedAsset
export interface CalculatedAsset {
  id: string;
  model_name: string;
  serial_number: string;
  client_id: string | null;
  billing_group_id: string | null;
  status: string;
  billing_date: string | null;
  plan_weight_a3_bw: number | null;
  plan_weight_a3_col: number | null;
  inventory_id: string;
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
  is_replacement_before?: boolean;
  is_replacement_after?: boolean;
  is_withdrawal?: boolean;
}

// 6. 정산 결과
export interface BillCalculationResult {
  details: CalculatedAsset[];
  totalAmount: number;
}

// 7. Settlement (✅ 최적화: 쿼리 별칭에 맞춰 깔끔하게 정리)
export interface Settlement extends SettlementRow {
  // 'client:clients' 쿼리 결과에 매핑
  client?: { 
    id: string;
    name: string; 
    business_number: string | null; 
    representative_name: string | null; 
    email: string | null; 
    address: string | null 
  } | null;
  
  // 'details:settlement_details' 쿼리 결과에 매핑
  details?: SettlementDetail[];
}

// 8. SettlementDetail
export interface SettlementDetail extends SettlementDetailRow {
  // 'inventory:inventory' 쿼리 결과에 매핑
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