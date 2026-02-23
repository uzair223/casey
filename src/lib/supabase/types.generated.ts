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
      access_logs: {
        Row: {
          access_granted: boolean
          accessed_id: string | null
          accessed_table: string
          created_at: string
          error_message: string | null
          id: string
          ip_address: unknown
          magic_link_token: string | null
          user_agent: string | null
        }
        Insert: {
          access_granted?: boolean
          accessed_id?: string | null
          accessed_table: string
          created_at?: string
          error_message?: string | null
          id?: string
          ip_address?: unknown
          magic_link_token?: string | null
          user_agent?: string | null
        }
        Update: {
          access_granted?: boolean
          accessed_id?: string | null
          accessed_table?: string
          created_at?: string
          error_message?: string | null
          id?: string
          ip_address?: unknown
          magic_link_token?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      conversation_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          meta: Json | null
          progress: Json | null
          role: string
          statement_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          meta?: Json | null
          progress?: Json | null
          role: string
          statement_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          meta?: Json | null
          progress?: Json | null
          role?: string
          statement_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_messages_statement_id_fkey"
            columns: ["statement_id"]
            isOneToOne: false
            referencedRelation: "statements"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          created_by: string | null
          email: string | null
          expires_at: string
          id: string
          role: string
          tenant_id: string | null
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          expires_at: string
          id?: string
          role: string
          tenant_id?: string | null
          token: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          expires_at?: string
          id?: string
          role?: string
          tenant_id?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invites_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      magic_links: {
        Row: {
          access_count: number | null
          created_at: string
          expires_at: string
          first_access_ip: unknown
          first_accessed_at: string | null
          last_accessed_at: string | null
          statement_id: string
          tenant_id: string
          token: string
          used_at: string | null
        }
        Insert: {
          access_count?: number | null
          created_at?: string
          expires_at: string
          first_access_ip?: unknown
          first_accessed_at?: string | null
          last_accessed_at?: string | null
          statement_id: string
          tenant_id: string
          token: string
          used_at?: string | null
        }
        Update: {
          access_count?: number | null
          created_at?: string
          expires_at?: string
          first_access_ip?: unknown
          first_accessed_at?: string | null
          last_accessed_at?: string | null
          statement_id?: string
          tenant_id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "magic_links_statement_id_fkey"
            columns: ["statement_id"]
            isOneToOne: false
            referencedRelation: "statements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "magic_links_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          role: string
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          role?: string
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          role?: string
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      statements: {
        Row: {
          assigned_to: string | null
          claim_number: string | null
          created_at: string
          id: string
          incident_date: string | null
          reference: string
          sections: Json
          signed_document: Json
          status: string
          supporting_documents: Json
          tenant_id: string
          title: string
          updated_at: string
          witness_address: string | null
          witness_email: string
          witness_name: string
          witness_occupation: string | null
        }
        Insert: {
          assigned_to?: string | null
          claim_number?: string | null
          created_at?: string
          id?: string
          incident_date?: string | null
          reference: string
          sections?: Json
          signed_document?: Json
          status?: string
          supporting_documents?: Json
          tenant_id: string
          title: string
          updated_at?: string
          witness_address?: string | null
          witness_email: string
          witness_name: string
          witness_occupation?: string | null
        }
        Update: {
          assigned_to?: string | null
          claim_number?: string | null
          created_at?: string
          id?: string
          incident_date?: string | null
          reference?: string
          sections?: Json
          signed_document?: Json
          status?: string
          supporting_documents?: Json
          tenant_id?: string
          title?: string
          updated_at?: string
          witness_address?: string | null
          witness_email?: string
          witness_name?: string
          witness_occupation?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "statements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bucket_tenant_is_accessible_to_user: {
        Args: { bucket_id_param: string }
        Returns: boolean
      }
      check_intake_rate_limit: {
        Args: {
          p_ip_address?: unknown
          p_max_attempts?: number
          p_token?: string
          p_window_minutes?: number
        }
        Returns: {
          allowed: boolean
          attempts_count: number
          window_expires_at: string
        }[]
      }
      is_tenant_bucket: { Args: { bucket_id_param: string }; Returns: boolean }
      log_intake_access: {
        Args: {
          p_error?: string
          p_granted?: boolean
          p_id?: string
          p_ip_address?: unknown
          p_table: string
          p_token: string
          p_user_agent?: string
        }
        Returns: string
      }
      mark_magic_link_used: {
        Args: { ip_address?: unknown; token_param: string }
        Returns: boolean
      }
      statement_has_valid_magic_link: {
        Args: { statement_id_param: string }
        Returns: boolean
      }
      tenant_bucket_has_valid_magic_link: {
        Args: { bucket_id_param: string }
        Returns: boolean
      }
      tenant_has_valid_magic_link: {
        Args: { tenant_id_param: string }
        Returns: boolean
      }
      user_role: { Args: never; Returns: string }
      user_tenant_id: { Args: never; Returns: string }
      validate_magic_link: {
        Args: { token_param: string }
        Returns: {
          expires_at: string
          is_valid: boolean
          statement_id: string
          tenant_id: string
        }[]
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
