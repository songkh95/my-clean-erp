export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      clients: {
        Row: {
          id: string
          organization_id: string | null
          name: string
          business_number: string | null
          representative_name: string | null
          contact_person: string | null
          phone: string | null
          office_phone: string | null
          email: string | null
          address: string | null
          parent_id: string | null
          status: string | null
          popup_memo: string | null
          created_at: string | null
          updated_at: string | null
          is_deleted: boolean | null
          billing_date: string | null
          is_rollover: boolean | null
          memo: string | null
        }
        Insert: {
          id?: string
          organization_id?: string | null
          name: string
          business_number?: string | null
          representative_name?: string | null
          contact_person?: string | null
          phone?: string | null
          office_phone?: string | null
          email?: string | null
          address?: string | null
          parent_id?: string | null
          status?: string | null
          popup_memo?: string | null
          created_at?: string | null
          updated_at?: string | null
          is_deleted?: boolean | null
          billing_date?: string | null
          is_rollover?: boolean | null
          memo?: string | null
        }
        Update: {
          id?: string
          organization_id?: string | null
          name?: string
          business_number?: string | null
          representative_name?: string | null
          contact_person?: string | null
          phone?: string | null
          office_phone?: string | null
          email?: string | null
          address?: string | null
          parent_id?: string | null
          status?: string | null
          popup_memo?: string | null
          created_at?: string | null
          updated_at?: string | null
          is_deleted?: boolean | null
          billing_date?: string | null
          is_rollover?: boolean | null
          memo?: string | null
        }
      }
      inventory: {
        Row: {
          id: string
          created_at: string
          type: string
          category: string
          model_name: string
          serial_number: string
          status: string
          client_id: string | null
          purchase_price: number | null
          memo: string | null
          organization_id: string
          brand: string | null
          product_condition: string | null
          initial_count_bw: number | null
          initial_count_col: number | null
          initial_count_bw_a3: number | null
          initial_count_col_a3: number | null
          plan_basic_fee: number | null
          plan_basic_cnt_bw: number | null
          plan_basic_cnt_col: number | null
          plan_price_bw: number | null
          plan_price_col: number | null
          plan_weight_a3_bw: number | null
          plan_weight_a3_col: number | null
          billing_group_id: string | null
          purchase_date: string | null
          billing_date: string | null
          last_status_updated_at: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          type: string
          category: string
          model_name: string
          serial_number: string
          status?: string
          client_id?: string | null
          purchase_price?: number | null
          memo?: string | null
          organization_id: string
          brand?: string | null
          product_condition?: string | null
          initial_count_bw?: number | null
          initial_count_col?: number | null
          initial_count_bw_a3?: number | null
          initial_count_col_a3?: number | null
          plan_basic_fee?: number | null
          plan_basic_cnt_bw?: number | null
          plan_basic_cnt_col?: number | null
          plan_price_bw?: number | null
          plan_price_col?: number | null
          plan_weight_a3_bw?: number | null
          plan_weight_a3_col?: number | null
          billing_group_id?: string | null
          purchase_date?: string | null
          billing_date?: string | null
          last_status_updated_at?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          type?: string
          category?: string
          model_name?: string
          serial_number?: string
          status?: string
          client_id?: string | null
          purchase_price?: number | null
          memo?: string | null
          organization_id?: string
          brand?: string | null
          product_condition?: string | null
          initial_count_bw?: number | null
          initial_count_col?: number | null
          initial_count_bw_a3?: number | null
          initial_count_col_a3?: number | null
          plan_basic_fee?: number | null
          plan_basic_cnt_bw?: number | null
          plan_basic_cnt_col?: number | null
          plan_price_bw?: number | null
          plan_price_col?: number | null
          plan_weight_a3_bw?: number | null
          plan_weight_a3_col?: number | null
          billing_group_id?: string | null
          purchase_date?: string | null
          billing_date?: string | null
          last_status_updated_at?: string | null
        }
      }
      settlements: {
        Row: {
          id: string
          created_at: string | null
          organization_id: string | null
          client_id: string | null
          billing_year: number
          billing_month: number
          billing_date: string | null
          total_amount: number | null
          basic_fee_snapshot: number | null
          extra_fee: number | null
          total_usage_bw: number | null
          total_usage_col: number | null
          is_paid: boolean | null
          memo: string | null
        }
        Insert: {
          id?: string
          created_at?: string | null
          organization_id?: string | null
          client_id?: string | null
          billing_year: number
          billing_month: number
          billing_date?: string | null
          total_amount?: number | null
          basic_fee_snapshot?: number | null
          extra_fee?: number | null
          total_usage_bw?: number | null
          total_usage_col?: number | null
          is_paid?: boolean | null
          memo?: string | null
        }
        Update: {
          id?: string
          created_at?: string | null
          organization_id?: string | null
          client_id?: string | null
          billing_year?: number
          billing_month?: number
          billing_date?: string | null
          total_amount?: number | null
          basic_fee_snapshot?: number | null
          extra_fee?: number | null
          total_usage_bw?: number | null
          total_usage_col?: number | null
          is_paid?: boolean | null
          memo?: string | null
        }
      }
      settlement_details: {
        Row: {
          id: string
          settlement_id: string | null
          inventory_id: string | null
          prev_count_bw: number | null
          curr_count_bw: number | null
          prev_count_col: number | null
          curr_count_col: number | null
          prev_count_bw_a3: number | null
          curr_count_bw_a3: number | null
          prev_count_col_a3: number | null
          curr_count_col_a3: number | null
          usage_bw: number | null
          usage_col: number | null
          usage_bw_a3: number | null
          usage_col_a3: number | null
          converted_usage_bw: number | null
          converted_usage_col: number | null
          calculated_amount: number | null
          is_replacement_record: boolean | null
          is_paid: boolean | null
        }
        Insert: {
          id?: string
          settlement_id?: string | null
          inventory_id?: string | null
          prev_count_bw?: number | null
          curr_count_bw?: number | null
          prev_count_col?: number | null
          curr_count_col?: number | null
          prev_count_bw_a3?: number | null
          curr_count_bw_a3?: number | null
          prev_count_col_a3?: number | null
          curr_count_col_a3?: number | null
          usage_bw?: number | null
          usage_col?: number | null
          usage_bw_a3?: number | null
          usage_col_a3?: number | null
          converted_usage_bw?: number | null
          converted_usage_col?: number | null
          calculated_amount?: number | null
          is_replacement_record?: boolean | null
          is_paid?: boolean | null
        }
        Update: {
          id?: string
          settlement_id?: string | null
          inventory_id?: string | null
          prev_count_bw?: number | null
          curr_count_bw?: number | null
          prev_count_col?: number | null
          curr_count_col?: number | null
          prev_count_bw_a3?: number | null
          curr_count_bw_a3?: number | null
          prev_count_col_a3?: number | null
          curr_count_col_a3?: number | null
          usage_bw?: number | null
          usage_col?: number | null
          usage_bw_a3?: number | null
          usage_col_a3?: number | null
          converted_usage_bw?: number | null
          converted_usage_col?: number | null
          calculated_amount?: number | null
          is_replacement_record?: boolean | null
          is_paid?: boolean | null
        }
      }
      machine_history: {
        Row: {
          id: string
          inventory_id: string | null
          client_id: string | null
          organization_id: string | null
          action_type: string
          bw_count: number | null
          col_count: number | null
          bw_a3_count: number | null
          col_a3_count: number | null
          recorded_at: string | null
          memo: string | null
        }
        Insert: {
          id?: string
          inventory_id?: string | null
          client_id?: string | null
          organization_id?: string | null
          action_type: string
          bw_count?: number | null
          col_count?: number | null
          bw_a3_count?: number | null
          col_a3_count?: number | null
          recorded_at?: string | null
          memo?: string | null
        }
        Update: {
          id?: string
          inventory_id?: string | null
          client_id?: string | null
          organization_id?: string | null
          action_type?: string
          bw_count?: number | null
          col_count?: number | null
          bw_a3_count?: number | null
          col_a3_count?: number | null
          recorded_at?: string | null
          memo?: string | null
        }
      }
      profiles: {
        Row: {
          id: string
          organization_id: string | null
          name: string | null
          role: string | null
          created_at: string | null
          updated_at: string | null
          is_deleted: boolean | null
        }
        Insert: {
          id: string
          organization_id?: string | null
          name?: string | null
          role?: string | null
          created_at?: string | null
          updated_at?: string | null
          is_deleted?: boolean | null
        }
        Update: {
          id?: string
          organization_id?: string | null
          name?: string | null
          role?: string | null
          created_at?: string | null
          updated_at?: string | null
          is_deleted?: boolean | null
        }
      }
      organizations: {
        Row: {
          id: string
          name: string
          plan_type: string | null
          created_at: string | null
          updated_at: string | null
          is_deleted: boolean | null
        }
        Insert: {
          id?: string
          name: string
          plan_type?: string | null
          created_at?: string | null
          updated_at?: string | null
          is_deleted?: boolean | null
        }
        Update: {
          id?: string
          name?: string
          plan_type?: string | null
          created_at?: string | null
          updated_at?: string | null
          is_deleted?: boolean | null
        }
      }
    }
  }
}