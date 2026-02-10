// app/types/index.ts

import { Database } from '@/types/supabase'

// 1. 기본 Row 타입 추출
type InventoryRow = Database['public']['Tables']['inventory']['Row']
type ClientRow = Database['public']['Tables']['clients']['Row']
type SettlementRow = Database['public']['Tables']['settlements']['Row']
type SettlementDetailRow = Database['public']['Tables']['settlement_details']['Row']
type MachineHistoryRow = Database['public']['Tables']['machine_history']['Row']
type OrganizationRow = Database['public']['Tables']['organizations']['Row']

// 2. Client 타입
export interface Client extends ClientRow {
  contract_start_date?: string | null; // ✅ 추가됨
}

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
  contract_start_date?: string | null; // ✅ 추가됨
  contract_end_date?: string | null;   // ✅ 추가됨
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
  
  // 개별 기계의 사용량 (단순 참고용)
  usageBreakdown: { basicBW: number; extraBW: number; basicCol: number; extraCol: number };
  
  // 그룹 합산 디스플레이용 데이터 (리더에게만 존재)
  groupUsageBreakdown?: {
    poolBasicBW: number;   // 그룹 총 기본제공 흑백
    poolBasicCol: number;  // 그룹 총 기본제공 칼라
    basicBW: number;       // 그룹 총 사용 흑백 (기본내)
    extraBW: number;       // 그룹 총 초과 흑백
    basicCol: number;      // 그룹 총 사용 칼라 (기본내)
    extraCol: number;      // 그룹 총 초과 칼라
  };

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
    id: string; // id 추가
    model_name: string;
    serial_number: string;
    status: string;
    billing_date: string | null;
    billing_group_id?: string | null; // 그룹 ID 추가
    // ✅ [수정] 아래 두 필드 추가 (AccountingHistory에서 사용됨)
    plan_basic_cnt_bw?: number | null;
    plan_basic_cnt_col?: number | null;
  } | null;
  
  // ✅ [수정] UI용 임시 속성 추가 (AccountingHistory에서 계산 후 사용됨)
  _ui?: {
    rowSpan: number;
    isHidden: boolean;
    groupStats: any;
  };
}

export interface MachineHistory extends MachineHistoryRow {
  inventory?: Inventory | null;
}

// 타임라인 수정을 위한 데이터 타입
export interface TimelineItem extends SettlementDetail {
  settlement_year: number;
  settlement_month: number;
  is_paid: boolean;
  inventory_model?: string;
  inventory_sn?: string;
  billing_group_id?: string | null;
  // UI 상태 관리용
  is_modified?: boolean;
  validation_error?: string;
}

export interface HistoryItem {
  id: string
  settlement_id: string
  inventory_id: string
  prev_count_bw: number
  curr_count_bw: number
  prev_count_col: number
  curr_count_col: number
  prev_count_bw_a3: number
  curr_count_bw_a3: number
  prev_count_col_a3: number
  curr_count_col_a3: number

  usage_bw: number
  usage_col: number
  usage_bw_a3: number
  usage_col_a3: number
  calculated_amount: number

  is_modified?: boolean

  settlement: {
    billing_year: number
    billing_month: number
    is_paid: boolean
  }
  inventory: {
    id: string
    model_name: string
    serial_number: string
    plan_basic_fee: number
    plan_price_bw: number
    plan_price_col: number
    plan_basic_cnt_bw: number
    plan_basic_cnt_col: number
    plan_weight_a3_bw: number
    plan_weight_a3_col: number
  } | null
}