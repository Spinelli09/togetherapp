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
    PostgrestVersion: "14.15"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      bank_accounts: {
        Row: {
          account_name: string
          account_type: string
          available_balance: number | null
          connection_id: string
          currency: string
          current_balance: number
          external_account_id: string
          id: string
          last_synced_at: string
        }
        Insert: {
          account_name: string
          account_type: string
          available_balance?: number | null
          connection_id: string
          currency: string
          current_balance: number
          external_account_id: string
          id?: string
          last_synced_at?: string
        }
        Update: {
          account_name?: string
          account_type?: string
          available_balance?: number | null
          connection_id?: string
          currency?: string
          current_balance?: number
          external_account_id?: string
          id?: string
          last_synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "bank_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_connections: {
        Row: {
          connected_by: string
          created_at: string
          household_id: string
          id: string
          institution: string
          last_sync_at: string | null
          last_transaction_synced_at: string | null
          provider: string
          status: string
          vault_secret_id: string | null
        }
        Insert: {
          connected_by: string
          created_at?: string
          household_id: string
          id?: string
          institution: string
          last_sync_at?: string | null
          last_transaction_synced_at?: string | null
          provider?: string
          status?: string
          vault_secret_id?: string | null
        }
        Update: {
          connected_by?: string
          created_at?: string
          household_id?: string
          id?: string
          institution?: string
          last_sync_at?: string | null
          last_transaction_synced_at?: string | null
          provider?: string
          status?: string
          vault_secret_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_connections_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_categories: {
        Row: {
          budget_id: string
          category_id: string
        }
        Insert: {
          budget_id: string
          category_id: string
        }
        Update: {
          budget_id?: string
          category_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_categories_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          created_at: string
          created_by: string
          household_id: string
          id: string
          is_active: boolean
          monthly_limit: number
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          household_id: string
          id?: string
          is_active?: boolean
          monthly_limit: number
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          household_id?: string
          id?: string
          is_active?: boolean
          monthly_limit?: number
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_uncategorized_default: boolean
          name: string
        }
        Insert: {
          created_at?: string
          display_order: number
          id?: string
          is_uncategorized_default?: boolean
          name: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_uncategorized_default?: boolean
          name?: string
        }
        Relationships: []
      }
      category_aliases: {
        Row: {
          akahu_category_id: string
          category_id: string
          created_at: string
        }
        Insert: {
          akahu_category_id: string
          category_id: string
          created_at?: string
        }
        Update: {
          akahu_category_id?: string
          category_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_aliases_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string
          current_amount: number
          household_id: string
          id: string
          name: string
          status: string
          target_amount: number
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by: string
          current_amount?: number
          household_id: string
          id?: string
          name: string
          status?: string
          target_amount: number
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string
          current_amount?: number
          household_id?: string
          id?: string
          name?: string
          status?: string
          target_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_invites: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          household_id: string
          id: string
          invited_by: string
          status: string
          token: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          household_id: string
          id?: string
          invited_by: string
          status?: string
          token?: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          household_id?: string
          id?: string
          invited_by?: string
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_invites_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_members: {
        Row: {
          display_name: string
          household_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          display_name: string
          household_id: string
          id?: string
          joined_at?: string
          role: string
          user_id: string
        }
        Update: {
          display_name?: string
          household_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          account_id: string
          amount: number
          created_at: string
          deleted_at: string | null
          description: string
          direction: string | null
          external_transaction_id: string
          household_id: string
          id: string
          merchant_name: string | null
          occurred_at: string
          provider_category: string | null
          provider_updated_at: string | null
          raw_payload: Json
          status: string
          updated_at: string
        }
        Insert: {
          account_id: string
          amount: number
          created_at?: string
          deleted_at?: string | null
          description: string
          direction?: string | null
          external_transaction_id: string
          household_id: string
          id?: string
          merchant_name?: string | null
          occurred_at: string
          provider_category?: string | null
          provider_updated_at?: string | null
          raw_payload: Json
          status?: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          amount?: number
          created_at?: string
          deleted_at?: string | null
          description?: string
          direction?: string | null
          external_transaction_id?: string
          household_id?: string
          id?: string
          merchant_name?: string | null
          occurred_at?: string
          provider_category?: string | null
          provider_updated_at?: string | null
          raw_payload?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      transaction_category_resolution: {
        Row: {
          amount: number | null
          category_id: string | null
          deleted_at: string | null
          direction: string | null
          household_id: string | null
          occurred_at: string | null
          provider_category: string | null
          transaction_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_household_invite: {
        Args: { invite_token: string }
        Returns: string
      }
      archive_goal: { Args: { p_goal_id: string }; Returns: undefined }
      connect_bank_account: {
        Args: {
          p_household_id: string
          p_institution: string
          p_provider: string
          p_token: string
        }
        Returns: string
      }
      create_budget: {
        Args: {
          p_category_ids: string[]
          p_household_id: string
          p_monthly_limit: number
          p_name: string
        }
        Returns: string
      }
      create_goal: {
        Args: {
          p_household_id: string
          p_name: string
          p_target_amount: number
        }
        Returns: string
      }
      deactivate_budget: { Args: { p_budget_id: string }; Returns: undefined }
      disconnect_bank_connection: {
        Args: { p_connection_id: string }
        Returns: undefined
      }
      expire_stale_household_invites: {
        Args: { target_household_id: string }
        Returns: undefined
      }
      get_bank_connection_token: {
        Args: { p_connection_id: string }
        Returns: string
      }
      get_household_budget_progress: {
        Args: { p_household_id: string; p_month_start: string }
        Returns: {
          budget_id: string
          gross_spent: number
          monthly_limit: number
          name: string
          net_spent: number
        }[]
      }
      get_household_insight_facts: {
        Args: { p_household_id: string; p_month_start: string }
        Returns: Json
      }
      get_household_monthly_summary: {
        Args: { p_household_id: string; p_month_start: string }
        Returns: {
          money_in: number
          money_out: number
          net: number
        }[]
      }
      get_invite_preview: {
        Args: { invite_token: string }
        Returns: {
          expires_at: string
          household_name: string
          invited_email: string
          status: string
        }[]
      }
      is_household_member: {
        Args: { target_household_id: string }
        Returns: boolean
      }
      is_household_owner: {
        Args: { target_household_id: string }
        Returns: boolean
      }
      list_household_transactions: {
        Args: {
          p_before_id?: string
          p_before_occurred_at?: string
          p_household_id: string
          p_limit?: number
        }
        Returns: {
          account_name: string
          amount: number
          description: string
          direction: string
          id: string
          merchant_name: string
          occurred_at: string
        }[]
      }
      mark_bank_connection_error: {
        Args: { p_connection_id: string }
        Returns: undefined
      }
      record_bank_sync: {
        Args: { p_accounts: Json; p_connection_id: string }
        Returns: undefined
      }
      record_goal_contribution: {
        Args: { p_amount: number; p_goal_id: string }
        Returns: undefined
      }
      record_transaction_sync: {
        Args: {
          p_connection_id: string
          p_synced_up_to: string
          p_transactions: Json
        }
        Returns: undefined
      }
      update_budget: {
        Args: {
          p_budget_id: string
          p_category_ids: string[]
          p_monthly_limit: number
          p_name: string
        }
        Returns: undefined
      }
      update_goal: {
        Args: { p_goal_id: string; p_name: string; p_target_amount: number }
        Returns: undefined
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
