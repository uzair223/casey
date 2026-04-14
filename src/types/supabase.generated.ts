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
      account_deletion_requests: {
        Row: {
          created_at: string
          executed_at: string | null
          id: string
          reason: string | null
          requested_by_user_id: string
          requested_user_id: string
          reviewed_at: string | null
          reviewed_by_user_id: string | null
          status: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          executed_at?: string | null
          id?: string
          reason?: string | null
          requested_by_user_id: string
          requested_user_id: string
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          executed_at?: string | null
          id?: string
          reason?: string | null
          requested_by_user_id?: string
          requested_user_id?: string
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_deletion_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          id: string
          metadata: Json
          target_id: string | null
          target_type: string | null
          tenant_id: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          target_id?: string | null
          target_type?: string | null
          tenant_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          target_id?: string | null
          target_type?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      case_config_snapshots: {
        Row: {
          config_json: Json
          config_name: string
          created_at: string
          created_for_case_id: string | null
          id: string
          template_document: Json | null
          template_id: string | null
          template_scope: string
          tenant_id: string
        }
        Insert: {
          config_json: Json
          config_name: string
          created_at?: string
          created_for_case_id?: string | null
          id?: string
          template_document?: Json | null
          template_id?: string | null
          template_scope: string
          tenant_id: string
        }
        Update: {
          config_json?: Json
          config_name?: string
          created_at?: string
          created_for_case_id?: string | null
          id?: string
          template_document?: Json | null
          template_id?: string | null
          template_scope?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_config_snapshots_created_for_case_id_fkey"
            columns: ["created_for_case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_config_snapshots_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "case_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_config_snapshots_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      case_documents: {
        Row: {
          case_id: string
          created_at: string
          document: Json
          id: string
          tenant_id: string
          uploaded_by_user_id: string
        }
        Insert: {
          case_id: string
          created_at?: string
          document: Json
          id?: string
          tenant_id: string
          uploaded_by_user_id: string
        }
        Update: {
          case_id?: string
          created_at?: string
          document?: Json
          id?: string
          tenant_id?: string
          uploaded_by_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      case_note_mentions: {
        Row: {
          case_note_id: string
          created_at: string
          created_by_user_id: string
          id: string
          mentioned_user_id: string
          tenant_id: string
        }
        Insert: {
          case_note_id: string
          created_at?: string
          created_by_user_id: string
          id?: string
          mentioned_user_id: string
          tenant_id: string
        }
        Update: {
          case_note_id?: string
          created_at?: string
          created_by_user_id?: string
          id?: string
          mentioned_user_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_note_mentions_case_note_id_fkey"
            columns: ["case_note_id"]
            isOneToOne: false
            referencedRelation: "case_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_note_mentions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      case_notes: {
        Row: {
          author_user_id: string
          body: string
          case_id: string
          created_at: string
          id: string
          is_pinned: boolean
          pinned_at: string | null
          pinned_by_user_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          author_user_id: string
          body: string
          case_id: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          pinned_at?: string | null
          pinned_by_user_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          author_user_id?: string
          body?: string
          case_id?: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          pinned_at?: string | null
          pinned_by_user_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_notes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      case_template_statement_templates: {
        Row: {
          case_template_id: string
          created_at: string
          is_default: boolean
          statement_template_id: string
        }
        Insert: {
          case_template_id: string
          created_at?: string
          is_default?: boolean
          statement_template_id: string
        }
        Update: {
          case_template_id?: string
          created_at?: string
          is_default?: boolean
          statement_template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_template_statement_templates_case_template_id_fkey"
            columns: ["case_template_id"]
            isOneToOne: false
            referencedRelation: "case_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_template_statement_templates_statement_template_id_fkey"
            columns: ["statement_template_id"]
            isOneToOne: false
            referencedRelation: "statement_config_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      case_template_tenant_preferences: {
        Row: {
          created_at: string
          default_case_template_id: string | null
          favourite_case_template_ids: string[]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_case_template_id?: string | null
          favourite_case_template_ids?: string[]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_case_template_id?: string | null
          favourite_case_template_ids?: string[]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_template_tenant_preferences_default_case_template_id_fkey"
            columns: ["default_case_template_id"]
            isOneToOne: false
            referencedRelation: "case_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_template_tenant_preferences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      case_templates: {
        Row: {
          created_at: string
          created_by: string | null
          draft_config: Json
          id: string
          name: string
          published_at: string | null
          published_config: Json | null
          source_template_id: string | null
          status: string
          template_scope: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          draft_config?: Json
          id?: string
          name: string
          published_at?: string | null
          published_config?: Json | null
          source_template_id?: string | null
          status?: string
          template_scope: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          draft_config?: Json
          id?: string
          name?: string
          published_at?: string | null
          published_config?: Json | null
          source_template_id?: string | null
          status?: string
          template_scope?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_templates_source_template_id_fkey"
            columns: ["source_template_id"]
            isOneToOne: false
            referencedRelation: "case_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cases: {
        Row: {
          assigned_to: string | null
          assigned_to_ids: string[]
          case_metadata: Json
          case_template_id: string | null
          config_snapshot_id: string | null
          created_at: string
          id: string
          incident_date: string | null
          status: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          assigned_to_ids?: string[]
          case_metadata?: Json
          case_template_id?: string | null
          config_snapshot_id?: string | null
          created_at?: string
          id?: string
          incident_date?: string | null
          status?: string
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          assigned_to_ids?: string[]
          case_metadata?: Json
          case_template_id?: string | null
          config_snapshot_id?: string | null
          created_at?: string
          id?: string
          incident_date?: string | null
          status?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cases_case_template_id_fkey"
            columns: ["case_template_id"]
            isOneToOne: false
            referencedRelation: "case_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_config_snapshot_id_fkey"
            columns: ["config_snapshot_id"]
            isOneToOne: false
            referencedRelation: "case_config_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          meta: Json | null
          role: string
          statement_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          meta?: Json | null
          role: string
          statement_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          meta?: Json | null
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
          created_at: string
          expires_at: string
          statement_id: string
          tenant_id: string
          token: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          statement_id: string
          tenant_id: string
          token: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          statement_id?: string
          tenant_id?: string
          token?: string
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
      statement_config_snapshots: {
        Row: {
          config_json: Json
          config_name: string
          created_at: string
          created_for_statement_id: string | null
          id: string
          template_document: Json | null
          template_id: string | null
          template_scope: string
          tenant_id: string
        }
        Insert: {
          config_json: Json
          config_name: string
          created_at?: string
          created_for_statement_id?: string | null
          id?: string
          template_document?: Json | null
          template_id?: string | null
          template_scope: string
          tenant_id: string
        }
        Update: {
          config_json?: Json
          config_name?: string
          created_at?: string
          created_for_statement_id?: string | null
          id?: string
          template_document?: Json | null
          template_id?: string | null
          template_scope?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "statement_config_snapshots_created_for_statement_id_fkey"
            columns: ["created_for_statement_id"]
            isOneToOne: false
            referencedRelation: "statements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "statement_config_snapshots_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "statement_config_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "statement_config_snapshots_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      statement_config_templates: {
        Row: {
          created_at: string
          created_by: string | null
          docx_template_document: Json | null
          draft_config: Json
          id: string
          name: string
          published_at: string | null
          published_config: Json | null
          source_template_id: string | null
          status: string
          template_scope: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          docx_template_document?: Json | null
          draft_config?: Json
          id?: string
          name: string
          published_at?: string | null
          published_config?: Json | null
          source_template_id?: string | null
          status?: string
          template_scope: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          docx_template_document?: Json | null
          draft_config?: Json
          id?: string
          name?: string
          published_at?: string | null
          published_config?: Json | null
          source_template_id?: string | null
          status?: string
          template_scope?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "statement_config_templates_source_template_id_fkey"
            columns: ["source_template_id"]
            isOneToOne: false
            referencedRelation: "statement_config_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "statement_config_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      statement_internal_documents: {
        Row: {
          created_at: string
          document: Json
          id: string
          statement_id: string
          tenant_id: string
          uploaded_by_user_id: string
        }
        Insert: {
          created_at?: string
          document: Json
          id?: string
          statement_id: string
          tenant_id: string
          uploaded_by_user_id: string
        }
        Update: {
          created_at?: string
          document?: Json
          id?: string
          statement_id?: string
          tenant_id?: string
          uploaded_by_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "statement_internal_documents_statement_id_fkey"
            columns: ["statement_id"]
            isOneToOne: false
            referencedRelation: "statements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "statement_internal_documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      statement_note_mentions: {
        Row: {
          created_at: string
          created_by_user_id: string
          id: string
          mentioned_user_id: string
          statement_note_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_by_user_id: string
          id?: string
          mentioned_user_id: string
          statement_note_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string
          id?: string
          mentioned_user_id?: string
          statement_note_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "statement_note_mentions_statement_note_id_fkey"
            columns: ["statement_note_id"]
            isOneToOne: false
            referencedRelation: "statement_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "statement_note_mentions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      statement_notes: {
        Row: {
          author_user_id: string
          body: string
          created_at: string
          id: string
          is_pinned: boolean
          pinned_at: string | null
          pinned_by_user_id: string | null
          statement_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          author_user_id: string
          body: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          pinned_at?: string | null
          pinned_by_user_id?: string | null
          statement_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          author_user_id?: string
          body?: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          pinned_at?: string | null
          pinned_by_user_id?: string | null
          statement_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "statement_notes_statement_id_fkey"
            columns: ["statement_id"]
            isOneToOne: false
            referencedRelation: "statements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "statement_notes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      statement_reminder_events: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          error_message: string | null
          id: string
          metadata: Json
          recipient_email: string | null
          reminder_rule_id: string | null
          send_type: string
          sent_at: string | null
          statement_id: string
          status: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json
          recipient_email?: string | null
          reminder_rule_id?: string | null
          send_type: string
          sent_at?: string | null
          statement_id: string
          status?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json
          recipient_email?: string | null
          reminder_rule_id?: string | null
          send_type?: string
          sent_at?: string | null
          statement_id?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "statement_reminder_events_reminder_rule_id_fkey"
            columns: ["reminder_rule_id"]
            isOneToOne: false
            referencedRelation: "statement_reminder_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "statement_reminder_events_statement_id_fkey"
            columns: ["statement_id"]
            isOneToOne: false
            referencedRelation: "statements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "statement_reminder_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      statement_reminder_rules: {
        Row: {
          cadence_days: number
          created_at: string
          created_by_user_id: string
          id: string
          is_enabled: boolean
          last_sent_at: string | null
          max_reminders: number | null
          next_send_at: string | null
          reminders_sent_count: number
          statement_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          cadence_days?: number
          created_at?: string
          created_by_user_id: string
          id?: string
          is_enabled?: boolean
          last_sent_at?: string | null
          max_reminders?: number | null
          next_send_at?: string | null
          reminders_sent_count?: number
          statement_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          cadence_days?: number
          created_at?: string
          created_by_user_id?: string
          id?: string
          is_enabled?: boolean
          last_sent_at?: string | null
          max_reminders?: number | null
          next_send_at?: string | null
          reminders_sent_count?: number
          statement_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "statement_reminder_rules_statement_id_fkey"
            columns: ["statement_id"]
            isOneToOne: true
            referencedRelation: "statements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "statement_reminder_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      statements: {
        Row: {
          case_id: string
          config_snapshot_id: string | null
          created_at: string
          gdpr_notice_acknowledgement: Json | null
          id: string
          sections: Json
          signed_document: Json | null
          status: string
          supporting_documents: Json
          template_id: string | null
          tenant_id: string
          title: string
          updated_at: string
          witness_email: string
          witness_metadata: Json
          witness_name: string
        }
        Insert: {
          case_id: string
          config_snapshot_id?: string | null
          created_at?: string
          gdpr_notice_acknowledgement?: Json | null
          id?: string
          sections?: Json
          signed_document?: Json | null
          status?: string
          supporting_documents?: Json
          template_id?: string | null
          tenant_id: string
          title: string
          updated_at?: string
          witness_email: string
          witness_metadata?: Json
          witness_name: string
        }
        Update: {
          case_id?: string
          config_snapshot_id?: string | null
          created_at?: string
          gdpr_notice_acknowledgement?: Json | null
          id?: string
          sections?: Json
          signed_document?: Json | null
          status?: string
          supporting_documents?: Json
          template_id?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string
          witness_email?: string
          witness_metadata?: Json
          witness_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "statements_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "statements_config_snapshot_id_fkey"
            columns: ["config_snapshot_id"]
            isOneToOne: false
            referencedRelation: "statement_config_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "statements_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "statement_config_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "statements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_notification_preferences: {
        Row: {
          created_at: string
          digest_frequency: string
          follow_up_requests_channel: string
          mention_channel: string
          reminders_channel: string
          submissions_channel: string
          tenant_id: string
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          created_at?: string
          digest_frequency?: string
          follow_up_requests_channel?: string
          mention_channel?: string
          reminders_channel?: string
          submissions_channel?: string
          tenant_id: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          created_at?: string
          digest_frequency?: string
          follow_up_requests_channel?: string
          mention_channel?: string
          reminders_channel?: string
          submissions_channel?: string
          tenant_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_notification_preferences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          data_retention_days: number
          id: string
          name: string
          purge_after: string | null
          soft_deleted_at: string | null
        }
        Insert: {
          created_at?: string
          data_retention_days?: number
          id?: string
          name: string
          purge_after?: string | null
          soft_deleted_at?: string | null
        }
        Update: {
          created_at?: string
          data_retention_days?: number
          id?: string
          name?: string
          purge_after?: string | null
          soft_deleted_at?: string | null
        }
        Relationships: []
      }
      user_notifications: {
        Row: {
          actor_user_id: string | null
          body: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          link_path: string
          metadata: Json
          notification_type: string
          read_at: string | null
          recipient_user_id: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          actor_user_id?: string | null
          body: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          link_path: string
          metadata?: Json
          notification_type: string
          read_at?: string | null
          recipient_user_id: string
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          actor_user_id?: string | null
          body?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          link_path?: string
          metadata?: Json
          notification_type?: string
          read_at?: string | null
          recipient_user_id?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist_signups: {
        Row: {
          company_name: string
          created_at: string
          email: string
          full_name: string
          id: string
          invited_at: string | null
          updated_at: string
        }
        Insert: {
          company_name: string
          created_at?: string
          email: string
          full_name: string
          id?: string
          invited_at?: string | null
          updated_at?: string
        }
        Update: {
          company_name?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          invited_at?: string | null
          updated_at?: string
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
      current_tenant_is_active: { Args: never; Returns: boolean }
      delete_storage_document: {
        Args: { default_bucket?: string; document_json: Json }
        Returns: undefined
      }
      is_tenant_active: { Args: { tenant_id_param: string }; Returns: boolean }
      is_tenant_bucket: { Args: { bucket_id_param: string }; Returns: boolean }
      permanently_delete_expired_soft_deleted_tenants: {
        Args: never
        Returns: number
      }
      restore_tenant: { Args: { tenant_id_param: string }; Returns: undefined }
      run_retention_purge_job: { Args: never; Returns: number }
      run_statement_reminders_job: { Args: never; Returns: number }
      soft_delete_tenant: {
        Args: { tenant_id_param: string }
        Returns: undefined
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
