export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
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
