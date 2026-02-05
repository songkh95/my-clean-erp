// app/types/index.ts

import { Database } from '@/types/supabase'

// 1. 기본 Row 타입 추출
type InventoryRow = Database['public']['Tables']['inventory']['Row']
type ClientRow = Database['public']['Tables']['clients']['Row']
type SettlementRow = Database['public']['Tables']['settlements']['Row']
type SettlementDetailRow = Database['public']['Tables']['settlement_details']['Row']
// ✅ [핵심 수정] 이 줄이 있어야 MachineHistory 에러가 해결됩니다.
type MachineHistoryRow = Database['public']['Tables']['machine_history']['Row']
type OrganizationRow = Database['public']['Tables']['organizations']['Row']

// 2. Client 타입
export interface Client extends ClientRow {}

// 3. Organization 타입 (명세서용)
export interface Organization extends OrganizationRow {
  business_number?: string;
  representative_name?: string;
  address?: string;
  email?: string;
  phone?: string;
}

// 4. Inventory 타입
export interface Inventory extends InventoryRow {
  client?: { name: string } | null; 
  is_active?: boolean;
  is_replacement_before?: boolean;
  is_replacement_after?: boolean;
  is_withdrawal?: boolean;
  final_counts?: CounterData;
}

// 5. 공통 데이터 타입
export interface CounterData {
  bw: number;
  col: number;
  bw_a3: number;
  col_a3: number;
}

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

export interface BillCalculationResult {
  details: CalculatedAsset[];
  totalAmount: number;
}

export interface Settlement extends SettlementRow {
  client?: { 
    id: string;
    name: string; 
    business_number: string | null; 
    representative_name: string | null; 
    email: string | null; 
    address: string | null 
  } | null;
  details?: SettlementDetail[];
}

export interface SettlementDetail extends SettlementDetailRow {
  inventory?: {
    model_name: string;
    serial_number: string;
    status: string;
    billing_date: string | null;
  } | null;
}

// ✅ MachineHistoryRow를 상속받아 DB 컬럼 속성을 모두 갖게 됩니다.
export interface MachineHistory extends MachineHistoryRow {
  inventory?: Inventory | null;
}