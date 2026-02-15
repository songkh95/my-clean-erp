export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      clients: {
        Row: {
          address: string | null
          billing_date: string | null
          business_number: string | null
          contact_person: string | null
          created_at: string | null
          email: string | null
          id: string
          is_deleted: boolean | null
          is_rollover: boolean | null
          memo: string | null
          name: string
          office_phone: string | null
          organization_id: string | null
          parent_id: string | null
          phone: string | null
          popup_memo: string | null
          representative_name: string | null
          status: string | null
          updated_at: string | null
          contract_start_date: string | null
        }
        Insert: {
          address?: string | null
          billing_date?: string | null
          business_number?: string | null
          contact_person?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_deleted?: boolean | null
          is_rollover?: boolean | null
          memo?: string | null
          name: string
          office_phone?: string | null
          organization_id?: string | null
          parent_id?: string | null
          phone?: string | null
          popup_memo?: string | null
          representative_name?: string | null
          status?: string | null
          updated_at?: string | null
          contract_start_date?: string | null
        }
        Update: {
          address?: string | null
          billing_date?: string | null
          business_number?: string | null
          contact_person?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_deleted?: boolean | null
          is_rollover?: boolean | null
          memo?: string | null
          name?: string
          office_phone?: string | null
          organization_id?: string | null
          parent_id?: string | null
          phone?: string | null
          popup_memo?: string | null
          representative_name?: string | null
          status?: string | null
          updated_at?: string | null
          contract_start_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      consumables: {
        Row: {
          category: string
          code: string | null
          created_at: string | null
          current_stock: number | null
          id: string
          model_name: string
          organization_id: string
          unit_price: number | null
        }
        Insert: {
          category: string
          code?: string | null
          created_at?: string | null
          current_stock?: number | null
          id?: string
          model_name: string
          organization_id: string
          unit_price?: number | null
        }
        Update: {
          category?: string
          code?: string | null
          created_at?: string | null
          current_stock?: number | null
          id?: string
          model_name?: string
          organization_id?: string
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "consumables_org_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          }
        ]
      }
      inventory: {
        Row: {
          billing_date: string | null
          billing_group_id: string | null
          brand: string | null
          category: string
          client_id: string | null
          created_at: string
          id: string
          initial_count_bw: number | null
          initial_count_bw_a3: number | null
          initial_count_col: number | null
          initial_count_col_a3: number | null
          last_status_updated_at: string | null
          memo: string | null
          model_name: string
          organization_id: string
          plan_basic_cnt_bw: number | null
          plan_basic_cnt_col: number | null
          plan_basic_fee: number | null
          plan_price_bw: number | null
          plan_price_col: number | null
          plan_weight_a3_bw: number | null
          plan_weight_a3_col: number | null
          product_condition: string | null
          purchase_date: string | null
          purchase_price: number | null
          serial_number: string
          status: string
          type: string
          contract_start_date: string | null
          contract_end_date: string | null
        }
        Insert: {
          billing_date?: string | null
          billing_group_id?: string | null
          brand?: string | null
          category: string
          client_id?: string | null
          created_at?: string
          id?: string
          initial_count_bw?: number | null
          initial_count_bw_a3?: number | null
          initial_count_col?: number | null
          initial_count_col_a3?: number | null
          last_status_updated_at?: string | null
          memo?: string | null
          model_name: string
          organization_id: string
          plan_basic_cnt_bw?: number | null
          plan_basic_cnt_col?: number | null
          plan_basic_fee?: number | null
          plan_price_bw?: number | null
          plan_price_col?: number | null
          plan_weight_a3_bw?: number | null
          plan_weight_a3_col?: number | null
          product_condition?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          serial_number: string
          status?: string
          type: string
          contract_start_date?: string | null
          contract_end_date?: string | null
        }
        Update: {
          billing_date?: string | null
          billing_group_id?: string | null
          brand?: string | null
          category?: string
          client_id?: string | null
          created_at?: string
          id?: string
          initial_count_bw?: number | null
          initial_count_bw_a3?: number | null
          initial_count_col?: number | null
          initial_count_col_a3?: number | null
          last_status_updated_at?: string | null
          memo?: string | null
          model_name?: string
          organization_id?: string
          plan_basic_cnt_bw?: number | null
          plan_basic_cnt_col?: number | null
          plan_basic_fee?: number | null
          plan_price_bw?: number | null
          plan_price_col?: number | null
          plan_weight_a3_bw?: number | null
          plan_weight_a3_col?: number | null
          product_condition?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          serial_number?: string
          status?: string
          type?: string
          contract_start_date?: string | null
          contract_end_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_history: {
        Row: {
          action_type: string
          bw_a3_count: number | null
          bw_count: number | null
          client_id: string | null
          col_a3_count: number | null
          col_count: number | null
          id: string
          inventory_id: string | null
          memo: string | null
          organization_id: string | null
          recorded_at: string | null
          is_replacement: boolean | null
        }
        Insert: {
          action_type: string
          bw_a3_count?: number | null
          bw_count?: number | null
          client_id?: string | null
          col_a3_count?: number | null
          col_count?: number | null
          id?: string
          inventory_id?: string | null
          memo?: string | null
          organization_id?: string | null
          recorded_at?: string | null
          is_replacement?: boolean | null
        }
        Update: {
          action_type?: string
          bw_a3_count?: number | null
          bw_count?: number | null
          client_id?: string | null
          col_a3_count?: number | null
          col_count?: number | null
          id?: string
          inventory_id?: string | null
          memo?: string | null
          organization_id?: string | null
          recorded_at?: string | null
          is_replacement: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "machine_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_history_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string | null
          id: string
          is_deleted: boolean | null
          name: string
          plan_type: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_deleted?: boolean | null
          name: string
          plan_type?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_deleted?: boolean | null
          name?: string
          plan_type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          id: string
          is_deleted: boolean | null
          name: string | null
          organization_id: string | null
          role: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id: string
          is_deleted?: boolean | null
          name?: string | null
          organization_id?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_deleted?: boolean | null
          name?: string | null
          organization_id?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      service_logs: {
        Row: {
          action_detail: string | null
          client_id: string
          created_at: string | null
          id: string
          inventory_id: string | null
          manager_id: string | null
          meter_bw: number | null
          meter_col: number | null
          organization_id: string
          service_type: string
          status: string
          symptom: string | null
          updated_at: string | null
          visit_date: string
        }
        Insert: {
          action_detail?: string | null
          client_id: string
          created_at?: string | null
          id?: string
          inventory_id?: string | null
          manager_id?: string | null
          meter_bw?: number | null
          meter_col?: number | null
          organization_id: string
          service_type: string
          status?: string
          symptom?: string | null
          updated_at?: string | null
          visit_date?: string
        }
        Update: {
          action_detail?: string | null
          client_id?: string
          created_at?: string | null
          id?: string
          inventory_id?: string | null
          manager_id?: string | null
          meter_bw?: number | null
          meter_col?: number | null
          organization_id?: string
          service_type?: string
          status?: string
          symptom?: string | null
          updated_at?: string | null
          visit_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_logs_client_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_logs_inventory_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_logs_manager_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_logs_org_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          }
        ]
      }
      service_parts_usage: {
        Row: {
          consumable_id: string
          created_at: string | null
          id: string
          quantity: number | null
          service_log_id: string
        }
        Insert: {
          consumable_id: string
          created_at?: string | null
          id?: string
          quantity?: number | null
          service_log_id: string
        }
        Update: {
          consumable_id?: string
          created_at?: string | null
          id?: string
          quantity?: number | null
          service_log_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parts_usage_consumable_fkey"
            columns: ["consumable_id"]
            isOneToOne: false
            referencedRelation: "consumables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parts_usage_log_fkey"
            columns: ["service_log_id"]
            isOneToOne: false
            referencedRelation: "service_logs"
            referencedColumns: ["id"]
          }
        ]
      }
      settlement_details: {
        Row: {
          calculated_amount: number | null
          converted_usage_bw: number | null
          converted_usage_col: number | null
          curr_count_bw: number | null
          curr_count_bw_a3: number | null
          curr_count_col: number | null
          curr_count_col_a3: number | null
          id: string
          inventory_id: string | null
          is_paid: boolean | null
          is_replacement_record: boolean | null
          prev_count_bw: number | null
          prev_count_bw_a3: number | null
          prev_count_col: number | null
          prev_count_col_a3: number | null
          settlement_id: string | null
          usage_bw: number | null
          usage_bw_a3: number | null
          usage_col: number | null
          usage_col_a3: number | null
        }
        Insert: {
          calculated_amount?: number | null
          converted_usage_bw?: number | null
          converted_usage_col?: number | null
          curr_count_bw?: number | null
          curr_count_bw_a3?: number | null
          curr_count_col?: number | null
          curr_count_col_a3?: number | null
          id?: string
          inventory_id?: string | null
          is_paid?: boolean | null
          is_replacement_record?: boolean | null
          prev_count_bw?: number | null
          prev_count_bw_a3?: number | null
          prev_count_col?: number | null
          prev_count_col_a3?: number | null
          settlement_id?: string | null
          usage_bw?: number | null
          usage_bw_a3?: number | null
          usage_col?: number | null
          usage_col_a3?: number | null
        }
        Update: {
          calculated_amount?: number | null
          converted_usage_bw?: number | null
          converted_usage_col?: number | null
          curr_count_bw?: number | null
          curr_count_bw_a3?: number | null
          curr_count_col?: number | null
          curr_count_col_a3?: number | null
          id?: string
          inventory_id?: string | null
          is_paid?: boolean | null
          is_replacement_record?: boolean | null
          prev_count_bw?: number | null
          prev_count_bw_a3?: number | null
          prev_count_col?: number | null
          prev_count_col_a3?: number | null
          settlement_id?: string | null
          usage_bw?: number | null
          usage_bw_a3?: number | null
          usage_col?: number | null
          usage_col_a3?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "settlement_details_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_details_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "settlements"
            referencedColumns: ["id"]
          },
        ]
      }
      settlements: {
        Row: {
          basic_fee_snapshot: number | null
          billing_date: string | null
          billing_month: number
          billing_year: number
          client_id: string | null
          created_at: string | null
          extra_fee: number | null
          id: string
          is_paid: boolean | null
          memo: string | null
          organization_id: string | null
          total_amount: number | null
          total_usage_bw: number | null
          total_usage_col: number | null
        }
        Insert: {
          basic_fee_snapshot?: number | null
          billing_date?: string | null
          billing_month: number
          billing_year: number
          client_id?: string | null
          created_at?: string | null
          extra_fee?: number | null
          id?: string
          is_paid?: boolean | null
          memo?: string | null
          organization_id?: string | null
          total_amount?: number | null
          total_usage_bw?: number | null
          total_usage_col?: number | null
        }
        Update: {
          basic_fee_snapshot?: number | null
          billing_date?: string | null
          billing_month?: number
          billing_year?: number
          client_id?: string | null
          created_at?: string | null
          extra_fee?: number | null
          id?: string
          is_paid?: boolean | null
          memo?: string | null
          organization_id?: string | null
          total_amount?: number | null
          total_usage_bw?: number | null
          total_usage_col?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "settlements_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_my_org_id: { Args: never; Returns: string }
      save_monthly_settlement: {
        Args: {
          p_year: number
          p_month: number
          p_org_id: string
          p_items: Json
        }
        Returns: void
      }
      decrement_stock: {
        Args: {
          row_id: string
          amount: number
        }
        Returns: void
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
  | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
    DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
  : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
    DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
  ? R
  : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
    DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] &
    DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
  ? R
  : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
  | keyof DefaultSchema["Tables"]
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
  : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Insert: infer I
  }
  ? I
  : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
    Insert: infer I
  }
  ? I
  : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
  | keyof DefaultSchema["Tables"]
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
  : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Update: infer U
  }
  ? U
  : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
    Update: infer U
  }
  ? U
  : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
  | keyof DefaultSchema["Enums"]
  | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
  : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
  | keyof DefaultSchema["CompositeTypes"]
  | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
  : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const