// types/index.ts

// 1. 거래처 (Clients)
export interface Client {
  id: string;
  organization_id: string;
  name: string;
  business_number?: string;
  representative_name?: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  parent_id?: string | null;
  status?: string;
  created_at?: string;
  is_deleted?: boolean;
}

// 2. 자산/기계 (Inventory)
export interface Inventory {
  id: string;
  organization_id: string;
  client_id: string | null;
  type: string;
  category: string;
  brand: string;
  model_name: string;
  serial_number: string;
  status: '창고' | '설치' | '수리중' | '폐기' | '교체전(철수)' | string; // string은 유연성을 위해 추가
  purchase_date?: string;
  purchase_price?: number;
  
  // 초기 카운터
  initial_count_bw: number;
  initial_count_col: number;
  initial_count_bw_a3: number;
  initial_count_col_a3: number;

  // 요금제 설정
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
  
  // Join된 데이터 (선택적)
  client?: Client;
}

// 3. 기계 이력 (Machine History) - 교체/철수/설치 기록
export interface MachineHistory {
  id: string;
  inventory_id: string;
  action_type: 'INSTALL' | 'WITHDRAW' | 'AS';
  recorded_at: string;
  memo?: string;
  bw_count: number;
  col_count: number;
  bw_a3_count: number;
  col_a3_count: number;
  
  // Join
  inventory?: Inventory;
}

// 4. 정산 메인 (Settlements) - 청구서 1장 개념
export interface Settlement {
  id: string;
  client_id: string;
  organization_id: string;
  billing_year: number;
  billing_month: number;
  total_amount: number;
  is_paid: boolean;
  created_at: string;
  
  // Join
  client?: Client;
  details?: SettlementDetail[];
}

// 5. 정산 상세 (Settlement Details) - 청구서 내 기계별 상세 라인
export interface SettlementDetail {
  id: string;
  settlement_id: string;
  inventory_id: string;
  
  prev_count_bw: number;
  curr_count_bw: number;
  prev_count_col: number;
  curr_count_col: number;
  // ... A3 카운터 등 필요시 추가
  
  calculated_amount: number;
  is_replacement_record: boolean;
  is_paid?: boolean; // 최근에 추가한 필드

  // Join
  inventory?: Inventory;
  
  // 계산 로직에서 쓰이는 확장 필드들 (DB에는 없지만 프론트에서 계산 후 붙이는 것들)
  usage?: { bw: number; col: number; bw_a3: number; col_a3: number };
  converted?: { bw: number; col: number };
  rowCost?: { basic: number; extra: number; total: number };
}