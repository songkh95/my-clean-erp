import { Database } from '@/types/supabase'

// 1. 기본 Row 타입 추출
// (Supabase 자동 생성 타입은 모든 필드가 null일 수 있다고 가정하므로 이를 보완합니다)
type InventoryRow = Database['public']['Tables']['inventory']['Row']
type ClientRow = Database['public']['Tables']['clients']['Row']
type SettlementRow = Database['public']['Tables']['settlements']['Row']
type SettlementDetailRow = Database['public']['Tables']['settlement_details']['Row']
type MachineHistoryRow = Database['public']['Tables']['machine_history']['Row']

// 2. Client 타입
export interface Client extends ClientRow {}

// 3. Inventory 타입 (조인된 데이터 포함)
export interface Inventory extends InventoryRow {
  // Supabase join 결과는 단일 객체일수도, null일수도 있음
  client?: { name: string } | null; 

  // UI 확장 필드
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
// (Inventory 상속 대신 필요한 필드만 명시적으로 선언하여 충돌 방지)
export interface CalculatedAsset {
  // Inventory 기본 필드
  id: string;
  model_name: string;
  serial_number: string;
  client_id: string | null;
  billing_group_id: string | null;
  status: string;
  billing_date: string | null;
  plan_weight_a3_bw: number | null;
  plan_weight_a3_col: number | null;

  // 확장 필드
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

// 7. Settlement
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

// 8. SettlementDetail
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