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
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      agent_events: {
        Row: {
          anthropic_batch_id: string | null
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          error_message: string | null
          event_type: string
          id: string
          parent_event_id: string | null
          payload: Json | null
          rejected_reason: string | null
          requires_approval: boolean | null
          result: Json | null
          status: string
          triggered_by: string
          triggered_by_user_id: string | null
          updated_at: string | null
        }
        Insert: {
          anthropic_batch_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          error_message?: string | null
          event_type: string
          id?: string
          parent_event_id?: string | null
          payload?: Json | null
          rejected_reason?: string | null
          requires_approval?: boolean | null
          result?: Json | null
          status?: string
          triggered_by: string
          triggered_by_user_id?: string | null
          updated_at?: string | null
        }
        Update: {
          anthropic_batch_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          parent_event_id?: string | null
          payload?: Json | null
          rejected_reason?: string | null
          requires_approval?: boolean | null
          result?: Json | null
          status?: string
          triggered_by?: string
          triggered_by_user_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_events_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_events_parent_event_id_fkey"
            columns: ["parent_event_id"]
            isOneToOne: false
            referencedRelation: "agent_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_events_triggered_by_user_id_fkey"
            columns: ["triggered_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_tokens: {
        Row: {
          agent_event_id: string | null
          approval_type: string
          created_at: string | null
          decided_at: string | null
          decision: string | null
          expires_at: string
          id: string
          reference_id: string
          token: string
          used: boolean | null
          user_id: string | null
        }
        Insert: {
          agent_event_id?: string | null
          approval_type: string
          created_at?: string | null
          decided_at?: string | null
          decision?: string | null
          expires_at?: string
          id?: string
          reference_id: string
          token?: string
          used?: boolean | null
          user_id?: string | null
        }
        Update: {
          agent_event_id?: string | null
          approval_type?: string
          created_at?: string | null
          decided_at?: string | null
          decision?: string | null
          expires_at?: string
          id?: string
          reference_id?: string
          token?: string
          used?: boolean | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_tokens_agent_event_id_fkey"
            columns: ["agent_event_id"]
            isOneToOne: false
            referencedRelation: "agent_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_conversations: {
        Row: {
          created_at: string
          id: string
          messages: Json
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          messages?: Json
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          messages?: Json
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_events: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          metadata: Json | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      batch_records: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          id: string
          schedule_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          id?: string
          schedule_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          id?: string
          schedule_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "batch_records_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: true
            referencedRelation: "production_schedule_items"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_stage_tracking: {
        Row: {
          corn_starch_used_kg: number | null
          entered_at: string
          exited_at: string | null
          id: string
          notes: string | null
          performed_by: string | null
          production_schedule_item_id: string
          quality_check_passed: boolean | null
          stage: string
          stage_duration_hours: number | null
          sticking_issue: boolean | null
        }
        Insert: {
          corn_starch_used_kg?: number | null
          entered_at?: string
          exited_at?: string | null
          id?: string
          notes?: string | null
          performed_by?: string | null
          production_schedule_item_id: string
          quality_check_passed?: boolean | null
          stage: string
          stage_duration_hours?: number | null
          sticking_issue?: boolean | null
        }
        Update: {
          corn_starch_used_kg?: number | null
          entered_at?: string
          exited_at?: string | null
          id?: string
          notes?: string | null
          performed_by?: string | null
          production_schedule_item_id?: string
          quality_check_passed?: boolean | null
          stage?: string
          stage_duration_hours?: number | null
          sticking_issue?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "batch_stage_tracking_production_schedule_item_id_fkey"
            columns: ["production_schedule_item_id"]
            isOneToOne: false
            referencedRelation: "production_schedule_items"
            referencedColumns: ["id"]
          },
        ]
      }
      bright_stock: {
        Row: {
          allocated_to_order_id: string | null
          bottle_size: number
          created_at: string
          customer_id: string | null
          form: string
          formula_id: string
          gummies_per_pouch: number | null
          id: string
          is_allocated: boolean
          is_labeled: boolean
          label_customer_product: string | null
          notes: string | null
          pouch_inventory_id: string | null
          pouches_used: number | null
          production_date: string
          production_schedule_item_id: string | null
          qty_gummies: number | null
          quantity_bottles: number
          updated_at: string
        }
        Insert: {
          allocated_to_order_id?: string | null
          bottle_size: number
          created_at?: string
          customer_id?: string | null
          form?: string
          formula_id: string
          gummies_per_pouch?: number | null
          id?: string
          is_allocated?: boolean
          is_labeled?: boolean
          label_customer_product?: string | null
          notes?: string | null
          pouch_inventory_id?: string | null
          pouches_used?: number | null
          production_date: string
          production_schedule_item_id?: string | null
          qty_gummies?: number | null
          quantity_bottles: number
          updated_at?: string
        }
        Update: {
          allocated_to_order_id?: string | null
          bottle_size?: number
          created_at?: string
          customer_id?: string | null
          form?: string
          formula_id?: string
          gummies_per_pouch?: number | null
          id?: string
          is_allocated?: boolean
          is_labeled?: boolean
          label_customer_product?: string | null
          notes?: string | null
          pouch_inventory_id?: string | null
          pouches_used?: number | null
          production_date?: string
          production_schedule_item_id?: string | null
          qty_gummies?: number | null
          quantity_bottles?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bright_stock_allocated_to_order_id_fkey"
            columns: ["allocated_to_order_id"]
            isOneToOne: false
            referencedRelation: "order_headers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bright_stock_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bright_stock_formula_id_fkey"
            columns: ["formula_id"]
            isOneToOne: false
            referencedRelation: "formulas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bright_stock_pouch_inventory_id_fkey"
            columns: ["pouch_inventory_id"]
            isOneToOne: false
            referencedRelation: "pouch_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bright_stock_production_schedule_item_id_fkey"
            columns: ["production_schedule_item_id"]
            isOneToOne: false
            referencedRelation: "production_schedule_items"
            referencedColumns: ["id"]
          },
        ]
      }
      certificates_of_analysis: {
        Row: {
          approved_by_name: string | null
          batch_lot: string
          created_at: string
          customer_name: string
          expiration_date: string | null
          formula_id: string
          generated_by: string | null
          generated_data: Json
          id: string
          manufacturing_date: string | null
          pdf_path: string | null
          production_batch_id: string | null
          qf_revision: string
          remark: string | null
          shelf_life_text: string
        }
        Insert: {
          approved_by_name?: string | null
          batch_lot: string
          created_at?: string
          customer_name: string
          expiration_date?: string | null
          formula_id: string
          generated_by?: string | null
          generated_data?: Json
          id?: string
          manufacturing_date?: string | null
          pdf_path?: string | null
          production_batch_id?: string | null
          qf_revision?: string
          remark?: string | null
          shelf_life_text?: string
        }
        Update: {
          approved_by_name?: string | null
          batch_lot?: string
          created_at?: string
          customer_name?: string
          expiration_date?: string | null
          formula_id?: string
          generated_by?: string | null
          generated_data?: Json
          id?: string
          manufacturing_date?: string | null
          pdf_path?: string | null
          production_batch_id?: string | null
          qf_revision?: string
          remark?: string | null
          shelf_life_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificates_of_analysis_formula_id_fkey"
            columns: ["formula_id"]
            isOneToOne: false
            referencedRelation: "formulas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_of_analysis_production_batch_id_fkey"
            columns: ["production_batch_id"]
            isOneToOne: false
            referencedRelation: "completed_batch_deductions"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_knowledge: {
        Row: {
          category: string
          content: string
          created_at: string | null
          id: string
          is_active: boolean | null
          keywords: string[]
          last_used: string | null
          source: string
          taught_by: string | null
          title: string
          updated_at: string | null
          usage_count: number | null
        }
        Insert: {
          category: string
          content: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          keywords: string[]
          last_used?: string | null
          source: string
          taught_by?: string | null
          title: string
          updated_at?: string | null
          usage_count?: number | null
        }
        Update: {
          category?: string
          content?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          keywords?: string[]
          last_used?: string | null
          source?: string
          taught_by?: string | null
          title?: string
          updated_at?: string | null
          usage_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_knowledge_taught_by_fkey"
            columns: ["taught_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coa_settings: {
        Row: {
          active_assay_tolerance_pct: number
          allergen_text: string
          analytical_testing_text: string
          created_at: string
          data_logger_text: string
          formula_id: string | null
          id: string
          is_global_default: boolean
          others_bullets: Json
          overage_text: string
          qf_revision: string
          shelf_life_bullets: Json
          shelf_life_months: number
          shelf_life_text: string
          stability_text: string
          storage_condition: string
          transport_text: string
          updated_at: string
        }
        Insert: {
          active_assay_tolerance_pct?: number
          allergen_text?: string
          analytical_testing_text?: string
          created_at?: string
          data_logger_text?: string
          formula_id?: string | null
          id?: string
          is_global_default?: boolean
          others_bullets?: Json
          overage_text?: string
          qf_revision?: string
          shelf_life_bullets?: Json
          shelf_life_months?: number
          shelf_life_text?: string
          stability_text?: string
          storage_condition?: string
          transport_text?: string
          updated_at?: string
        }
        Update: {
          active_assay_tolerance_pct?: number
          allergen_text?: string
          analytical_testing_text?: string
          created_at?: string
          data_logger_text?: string
          formula_id?: string | null
          id?: string
          is_global_default?: boolean
          others_bullets?: Json
          overage_text?: string
          qf_revision?: string
          shelf_life_bullets?: Json
          shelf_life_months?: number
          shelf_life_text?: string
          stability_text?: string
          storage_condition?: string
          transport_text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coa_settings_formula_id_fkey"
            columns: ["formula_id"]
            isOneToOne: false
            referencedRelation: "formulas"
            referencedColumns: ["id"]
          },
        ]
      }
      completed_batch_deductions: {
        Row: {
          agent_event_id: string | null
          approved_at: string | null
          approved_by: string | null
          batch_count: number
          completed_at: string
          completed_by: string
          created_at: string
          deduction_status: string | null
          formula_code: string
          formula_name: string
          id: string
          schedule_item_id: string
          status: string
          total_produced_qty: number
          updated_at: string
        }
        Insert: {
          agent_event_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          batch_count: number
          completed_at?: string
          completed_by: string
          created_at?: string
          deduction_status?: string | null
          formula_code: string
          formula_name: string
          id?: string
          schedule_item_id: string
          status?: string
          total_produced_qty: number
          updated_at?: string
        }
        Update: {
          agent_event_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          batch_count?: number
          completed_at?: string
          completed_by?: string
          created_at?: string
          deduction_status?: string | null
          formula_code?: string
          formula_name?: string
          id?: string
          schedule_item_id?: string
          status?: string
          total_produced_qty?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "completed_batch_deductions_agent_event_id_fkey"
            columns: ["agent_event_id"]
            isOneToOne: false
            referencedRelation: "agent_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "completed_batch_deductions_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_completed_batch_deductions_schedule_item"
            columns: ["schedule_item_id"]
            isOneToOne: false
            referencedRelation: "production_schedule_items"
            referencedColumns: ["id"]
          },
        ]
      }
      corrugated_shippers: {
        Row: {
          bottles_per_box: number
          created_at: string
          created_by: string | null
          id: string
          name: string
          quantity: number
          total_bottles: number
          updated_at: string
        }
        Insert: {
          bottles_per_box?: number
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          quantity?: number
          total_bottles?: number
          updated_at?: string
        }
        Update: {
          bottles_per_box?: number
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          quantity?: number
          total_bottles?: number
          updated_at?: string
        }
        Relationships: []
      }
      customer_documents: {
        Row: {
          created_at: string
          customer_id: string
          formula_id: string | null
          id: string
          kind: string
          order_id: string | null
          storage_path: string
          title: string
          uploaded_by: string | null
          visible_to_customer: boolean
        }
        Insert: {
          created_at?: string
          customer_id: string
          formula_id?: string | null
          id?: string
          kind: string
          order_id?: string | null
          storage_path: string
          title: string
          uploaded_by?: string | null
          visible_to_customer?: boolean
        }
        Update: {
          created_at?: string
          customer_id?: string
          formula_id?: string | null
          id?: string
          kind?: string
          order_id?: string | null
          storage_path?: string
          title?: string
          uploaded_by?: string | null
          visible_to_customer?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "customer_documents_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_documents_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_headers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_inquiries: {
        Row: {
          assigned_to: string | null
          closed_at: string | null
          company_name: string | null
          created_at: string | null
          customer_email: string
          customer_id: string | null
          customer_name: string
          customer_phone: string | null
          id: string
          inquiry_number: string | null
          inquiry_type: string
          message: string
          related_order_id: string | null
          status: string | null
          subject: string
          updated_at: string | null
          urgency: string | null
        }
        Insert: {
          assigned_to?: string | null
          closed_at?: string | null
          company_name?: string | null
          created_at?: string | null
          customer_email: string
          customer_id?: string | null
          customer_name: string
          customer_phone?: string | null
          id?: string
          inquiry_number?: string | null
          inquiry_type: string
          message: string
          related_order_id?: string | null
          status?: string | null
          subject: string
          updated_at?: string | null
          urgency?: string | null
        }
        Update: {
          assigned_to?: string | null
          closed_at?: string | null
          company_name?: string | null
          created_at?: string | null
          customer_email?: string
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string | null
          id?: string
          inquiry_number?: string | null
          inquiry_type?: string
          message?: string
          related_order_id?: string | null
          status?: string | null
          subject?: string
          updated_at?: string | null
          urgency?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_inquiries_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_inquiries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_inquiries_related_order_id_fkey"
            columns: ["related_order_id"]
            isOneToOne: false
            referencedRelation: "order_headers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          customer_id: string
          email: string
          expires_at: string
          id: string
          invited_at: string
          invited_by: string | null
          role_at_company: string
          short_code: string | null
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          customer_id: string
          email: string
          expires_at?: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          role_at_company?: string
          short_code?: string | null
          token?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          customer_id?: string
          email?: string
          expires_at?: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          role_at_company?: string
          short_code?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_invitations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_invoice_lines: {
        Row: {
          created_at: string
          description: string
          id: string
          invoice_id: string
          line_total: number
          quantity: number
          shipping_entry_id: string | null
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          line_total?: number
          quantity?: number
          shipping_entry_id?: string | null
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          line_total?: number
          quantity?: number
          shipping_entry_id?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "customer_invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "customer_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_invoice_lines_shipping_entry_id_fkey"
            columns: ["shipping_entry_id"]
            isOneToOne: false
            referencedRelation: "shipping_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_invoices: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string | null
          customer_name: string | null
          due_date: string | null
          id: string
          invoice_number: string
          issue_date: string
          notes: string | null
          order_header_id: string | null
          pdf_url: string | null
          source: string | null
          status: string
          subtotal: number
          tax: number
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string | null
          due_date?: string | null
          id?: string
          invoice_number: string
          issue_date?: string
          notes?: string | null
          order_header_id?: string | null
          pdf_url?: string | null
          source?: string | null
          status?: string
          subtotal?: number
          tax?: number
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string
          issue_date?: string
          notes?: string | null
          order_header_id?: string | null
          pdf_url?: string | null
          source?: string | null
          status?: string
          subtotal?: number
          tax?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_invoices_order_header_id_fkey"
            columns: ["order_header_id"]
            isOneToOne: false
            referencedRelation: "order_headers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_onboarding: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          billing_address: Json
          coi_path: string | null
          company_info: Json
          contacts: Json
          created_at: string
          current_step: string
          customer_id: string
          payment_terms: Json
          rejection_reason: string | null
          shipping_address: Json
          signature_name: string | null
          signature_signed_at: string | null
          signed_agreement_path: string | null
          status: string
          submitted_at: string | null
          updated_at: string
          w9_path: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          billing_address?: Json
          coi_path?: string | null
          company_info?: Json
          contacts?: Json
          created_at?: string
          current_step?: string
          customer_id: string
          payment_terms?: Json
          rejection_reason?: string | null
          shipping_address?: Json
          signature_name?: string | null
          signature_signed_at?: string | null
          signed_agreement_path?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
          w9_path?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          billing_address?: Json
          coi_path?: string | null
          company_info?: Json
          contacts?: Json
          created_at?: string
          current_step?: string
          customer_id?: string
          payment_terms?: Json
          rejection_reason?: string | null
          shipping_address?: Json
          signature_name?: string | null
          signature_signed_at?: string | null
          signed_agreement_path?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
          w9_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_onboarding_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_users: {
        Row: {
          accepted_at: string | null
          created_at: string
          customer_id: string
          id: string
          invited_at: string
          invited_by: string | null
          is_primary: boolean
          role_at_company: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          customer_id: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          is_primary?: boolean
          role_at_company?: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          is_primary?: boolean
          role_at_company?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_users_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          company_code: string
          company_name: string
          contact_person: string | null
          contact_title: string | null
          created_at: string
          email: string | null
          id: string
          is_rd_customer: boolean | null
          notes: string | null
          phone: string | null
          signup_short_code: string
          updated_at: string
        }
        Insert: {
          company_code: string
          company_name: string
          contact_person?: string | null
          contact_title?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_rd_customer?: boolean | null
          notes?: string | null
          phone?: string | null
          signup_short_code?: string
          updated_at?: string
        }
        Update: {
          company_code?: string
          company_name?: string
          contact_person?: string | null
          contact_title?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_rd_customer?: boolean | null
          notes?: string | null
          phone?: string | null
          signup_short_code?: string
          updated_at?: string
        }
        Relationships: []
      }
      customers_access_audit: {
        Row: {
          access_type: string
          accessed_at: string | null
          customer_id: string | null
          details: Json | null
          id: string
          user_email: string | null
          user_id: string
        }
        Insert: {
          access_type: string
          accessed_at?: string | null
          customer_id?: string | null
          details?: Json | null
          id?: string
          user_email?: string | null
          user_id: string
        }
        Update: {
          access_type?: string
          accessed_at?: string | null
          customer_id?: string | null
          details?: Json | null
          id?: string
          user_email?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_access_audit_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_shortcuts: {
        Row: {
          created_at: string
          id: string
          is_visible: boolean
          position: number
          shortcut_key: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_visible?: boolean
          position: number
          shortcut_key: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_visible?: boolean
          position?: number
          shortcut_key?: string
          user_id?: string
        }
        Relationships: []
      }
      demand_anomalies: {
        Row: {
          acknowledged: boolean | null
          acknowledged_at: string | null
          acknowledged_by: string | null
          actual_orders: number
          alerted_at: string | null
          anomaly_month: string
          expected_orders: number
          formula_id: string | null
          id: string
          notes: string | null
          severity: string | null
          variance_percent: number | null
        }
        Insert: {
          acknowledged?: boolean | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          actual_orders: number
          alerted_at?: string | null
          anomaly_month: string
          expected_orders: number
          formula_id?: string | null
          id?: string
          notes?: string | null
          severity?: string | null
          variance_percent?: number | null
        }
        Update: {
          acknowledged?: boolean | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          actual_orders?: number
          alerted_at?: string | null
          anomaly_month?: string
          expected_orders?: number
          formula_id?: string | null
          id?: string
          notes?: string | null
          severity?: string | null
          variance_percent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "demand_anomalies_formula_id_fkey"
            columns: ["formula_id"]
            isOneToOne: false
            referencedRelation: "formulas"
            referencedColumns: ["id"]
          },
        ]
      }
      demand_forecasts: {
        Row: {
          confidence_score: number | null
          forecast_month: string
          forecasted_batches: number
          forecasted_bottles: number
          formula_id: string | null
          generated_at: string | null
          id: string
          trend: string | null
        }
        Insert: {
          confidence_score?: number | null
          forecast_month: string
          forecasted_batches: number
          forecasted_bottles: number
          formula_id?: string | null
          generated_at?: string | null
          id?: string
          trend?: string | null
        }
        Update: {
          confidence_score?: number | null
          forecast_month?: string
          forecasted_batches?: number
          forecasted_bottles?: number
          formula_id?: string | null
          generated_at?: string | null
          id?: string
          trend?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demand_forecasts_formula_id_fkey"
            columns: ["formula_id"]
            isOneToOne: false
            referencedRelation: "formulas"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_messages: {
        Row: {
          created_at: string | null
          id: string
          message: string
          read_at: string | null
          receiver_id: string
          sender_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          read_at?: string | null
          receiver_id: string
          sender_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          read_at?: string | null
          receiver_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      email_events: {
        Row: {
          created_at: string | null
          error_message: string | null
          event_type: string
          id: string
          order_id: string
          recipient_email: string
          sent_at: string | null
          status: string
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          event_type: string
          id?: string
          order_id: string
          recipient_email: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          order_id?: string
          recipient_email?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_headers"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_critical_data: {
        Row: {
          access_count: number | null
          created_at: string | null
          employee_id: string
          home_address: string | null
          home_address_encrypted: string | null
          id: string
          last_accessed_at: string | null
          last_accessed_by: string | null
          salary_band: string | null
          salary_band_encrypted: string | null
          social_security_encrypted: string | null
          social_security_partial: string | null
          updated_at: string | null
        }
        Insert: {
          access_count?: number | null
          created_at?: string | null
          employee_id: string
          home_address?: string | null
          home_address_encrypted?: string | null
          id?: string
          last_accessed_at?: string | null
          last_accessed_by?: string | null
          salary_band?: string | null
          salary_band_encrypted?: string | null
          social_security_encrypted?: string | null
          social_security_partial?: string | null
          updated_at?: string | null
        }
        Update: {
          access_count?: number | null
          created_at?: string | null
          employee_id?: string
          home_address?: string | null
          home_address_encrypted?: string | null
          id?: string
          last_accessed_at?: string | null
          last_accessed_by?: string | null
          salary_band?: string | null
          salary_band_encrypted?: string | null
          social_security_encrypted?: string | null
          social_security_partial?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      employee_critical_data_audit: {
        Row: {
          access_reason: string | null
          access_type: string
          accessed_at: string | null
          accessed_by: string
          employee_id: string
          id: string
          ip_address: unknown
          risk_level: string | null
          session_id: string | null
          user_agent: string | null
        }
        Insert: {
          access_reason?: string | null
          access_type: string
          accessed_at?: string | null
          accessed_by: string
          employee_id: string
          id?: string
          ip_address?: unknown
          risk_level?: string | null
          session_id?: string | null
          user_agent?: string | null
        }
        Update: {
          access_reason?: string | null
          access_type?: string
          accessed_at?: string | null
          accessed_by?: string
          employee_id?: string
          id?: string
          ip_address?: unknown
          risk_level?: string | null
          session_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      employee_schedule: {
        Row: {
          building: Database["public"]["Enums"]["schedule_building"] | null
          created_at: string
          created_by: string | null
          date: string
          employee_id: string | null
          end_time: string | null
          entry_type: Database["public"]["Enums"]["schedule_entry_type"]
          id: string
          leave_type: Database["public"]["Enums"]["schedule_leave_type"] | null
          notes: string | null
          roster_employee_id: string | null
          start_time: string | null
          team: Database["public"]["Enums"]["schedule_team"] | null
          updated_at: string
        }
        Insert: {
          building?: Database["public"]["Enums"]["schedule_building"] | null
          created_at?: string
          created_by?: string | null
          date: string
          employee_id?: string | null
          end_time?: string | null
          entry_type: Database["public"]["Enums"]["schedule_entry_type"]
          id?: string
          leave_type?: Database["public"]["Enums"]["schedule_leave_type"] | null
          notes?: string | null
          roster_employee_id?: string | null
          start_time?: string | null
          team?: Database["public"]["Enums"]["schedule_team"] | null
          updated_at?: string
        }
        Update: {
          building?: Database["public"]["Enums"]["schedule_building"] | null
          created_at?: string
          created_by?: string | null
          date?: string
          employee_id?: string | null
          end_time?: string | null
          entry_type?: Database["public"]["Enums"]["schedule_entry_type"]
          id?: string
          leave_type?: Database["public"]["Enums"]["schedule_leave_type"] | null
          notes?: string | null
          roster_employee_id?: string | null
          start_time?: string | null
          team?: Database["public"]["Enums"]["schedule_team"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_schedule_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_schedule_roster_employee_id_fkey"
            columns: ["roster_employee_id"]
            isOneToOne: false
            referencedRelation: "schedule_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_sensitive_data: {
        Row: {
          created_at: string | null
          data_classification: string | null
          department: string | null
          display_name: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          employee_id: string | null
          full_name: string | null
          hire_date: string | null
          home_address: string | null
          home_address_encrypted: string | null
          id: string
          job_title: string | null
          manager_id: string | null
          phone_number: string | null
          salary_band: string | null
          salary_band_encrypted: string | null
          security_clearance: string | null
          social_security_encrypted: string | null
          social_security_partial: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          data_classification?: string | null
          department?: string | null
          display_name?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employee_id?: string | null
          full_name?: string | null
          hire_date?: string | null
          home_address?: string | null
          home_address_encrypted?: string | null
          id: string
          job_title?: string | null
          manager_id?: string | null
          phone_number?: string | null
          salary_band?: string | null
          salary_band_encrypted?: string | null
          security_clearance?: string | null
          social_security_encrypted?: string | null
          social_security_partial?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          data_classification?: string | null
          department?: string | null
          display_name?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employee_id?: string | null
          full_name?: string | null
          hire_date?: string | null
          home_address?: string | null
          home_address_encrypted?: string | null
          id?: string
          job_title?: string | null
          manager_id?: string | null
          phone_number?: string | null
          salary_band?: string | null
          salary_band_encrypted?: string | null
          security_clearance?: string | null
          social_security_encrypted?: string | null
          social_security_partial?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      employee_sensitive_data_audit: {
        Row: {
          access_reason: string | null
          access_type: string
          accessed_at: string | null
          accessed_by: string
          data_fields_accessed: string[] | null
          employee_id: string
          id: string
          ip_address: unknown
          risk_level: string | null
          session_id: string | null
          user_agent: string | null
        }
        Insert: {
          access_reason?: string | null
          access_type: string
          accessed_at?: string | null
          accessed_by: string
          data_fields_accessed?: string[] | null
          employee_id: string
          id?: string
          ip_address?: unknown
          risk_level?: string | null
          session_id?: string | null
          user_agent?: string | null
        }
        Update: {
          access_reason?: string | null
          access_type?: string
          accessed_at?: string | null
          accessed_by?: string
          data_fields_accessed?: string[] | null
          employee_id?: string
          id?: string
          ip_address?: unknown
          risk_level?: string | null
          session_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      finished_goods_excess_transactions: {
        Row: {
          bright_stock_id: string | null
          created_at: string
          created_by: string | null
          id: string
          line_item_id: string | null
          notes: string | null
          order_id: string | null
          qty: number
          transaction_type: string
        }
        Insert: {
          bright_stock_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          line_item_id?: string | null
          notes?: string | null
          order_id?: string | null
          qty: number
          transaction_type: string
        }
        Update: {
          bright_stock_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          line_item_id?: string | null
          notes?: string | null
          order_id?: string | null
          qty?: number
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "finished_goods_excess_transactions_bright_stock_id_fkey"
            columns: ["bright_stock_id"]
            isOneToOne: false
            referencedRelation: "bright_stock"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finished_goods_excess_transactions_line_item_id_fkey"
            columns: ["line_item_id"]
            isOneToOne: false
            referencedRelation: "order_line_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finished_goods_excess_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_headers"
            referencedColumns: ["id"]
          },
        ]
      }
      formula_access_audit: {
        Row: {
          access_type: string
          accessed_at: string | null
          details: Json | null
          formula_id: string | null
          id: string
          ip_address: unknown
          risk_level: string | null
          session_id: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          access_type: string
          accessed_at?: string | null
          details?: Json | null
          formula_id?: string | null
          id?: string
          ip_address?: unknown
          risk_level?: string | null
          session_id?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          access_type?: string
          accessed_at?: string | null
          details?: Json | null
          formula_id?: string | null
          id?: string
          ip_address?: unknown
          risk_level?: string | null
          session_id?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      formula_access_permissions: {
        Row: {
          access_conditions: Json | null
          access_type: string
          approval_count: number | null
          approver_ids: string[] | null
          expires_at: string | null
          formula_id: string
          granted_at: string | null
          granted_by: string
          id: string
          is_active: boolean | null
          justification: string
          requires_multi_approval: boolean | null
          security_clearance_level: string | null
          user_id: string
        }
        Insert: {
          access_conditions?: Json | null
          access_type: string
          approval_count?: number | null
          approver_ids?: string[] | null
          expires_at?: string | null
          formula_id: string
          granted_at?: string | null
          granted_by: string
          id?: string
          is_active?: boolean | null
          justification: string
          requires_multi_approval?: boolean | null
          security_clearance_level?: string | null
          user_id: string
        }
        Update: {
          access_conditions?: Json | null
          access_type?: string
          approval_count?: number | null
          approver_ids?: string[] | null
          expires_at?: string | null
          formula_id?: string
          granted_at?: string | null
          granted_by?: string
          id?: string
          is_active?: boolean | null
          justification?: string
          requires_multi_approval?: boolean | null
          security_clearance_level?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "formula_access_permissions_formula_id_fkey"
            columns: ["formula_id"]
            isOneToOne: false
            referencedRelation: "formulas"
            referencedColumns: ["id"]
          },
        ]
      }
      formula_access_requests: {
        Row: {
          access_type: string
          approved_at: string | null
          approved_by: string | null
          business_justification: string
          created_at: string | null
          denial_reason: string | null
          denied_at: string | null
          denied_by: string | null
          expires_at: string | null
          formula_id: string
          id: string
          requested_at: string | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_type: string
          approved_at?: string | null
          approved_by?: string | null
          business_justification: string
          created_at?: string | null
          denial_reason?: string | null
          denied_at?: string | null
          denied_by?: string | null
          expires_at?: string | null
          formula_id: string
          id?: string
          requested_at?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_type?: string
          approved_at?: string | null
          approved_by?: string | null
          business_justification?: string
          created_at?: string | null
          denial_reason?: string | null
          denied_at?: string | null
          denied_by?: string | null
          expires_at?: string | null
          formula_id?: string
          id?: string
          requested_at?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      formula_cost_estimates: {
        Row: {
          batches: number
          created_at: string | null
          created_by: string
          estimate_name: string
          formula_id: string
          id: string
          is_default: boolean
          labor_coating: Json
          labor_manufacturing: Json
          labor_packaging: Json
          rm_lines: Json
          totals: Json
          updated_at: string | null
          utilities_mode: string
          utilities_value: Json
        }
        Insert: {
          batches?: number
          created_at?: string | null
          created_by: string
          estimate_name: string
          formula_id: string
          id?: string
          is_default?: boolean
          labor_coating?: Json
          labor_manufacturing?: Json
          labor_packaging?: Json
          rm_lines?: Json
          totals?: Json
          updated_at?: string | null
          utilities_mode?: string
          utilities_value?: Json
        }
        Update: {
          batches?: number
          created_at?: string | null
          created_by?: string
          estimate_name?: string
          formula_id?: string
          id?: string
          is_default?: boolean
          labor_coating?: Json
          labor_manufacturing?: Json
          labor_packaging?: Json
          rm_lines?: Json
          totals?: Json
          updated_at?: string | null
          utilities_mode?: string
          utilities_value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "formula_cost_estimates_formula_id_fkey"
            columns: ["formula_id"]
            isOneToOne: false
            referencedRelation: "formulas"
            referencedColumns: ["id"]
          },
        ]
      }
      formula_ingredients: {
        Row: {
          created_at: string
          formula_id: string
          id: string
          percentage: number
          raw_material_id: string
          updated_at: string
          vessel: string | null
        }
        Insert: {
          created_at?: string
          formula_id: string
          id?: string
          percentage: number
          raw_material_id: string
          updated_at?: string
          vessel?: string | null
        }
        Update: {
          created_at?: string
          formula_id?: string
          id?: string
          percentage?: number
          raw_material_id?: string
          updated_at?: string
          vessel?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "formula_ingredients_formula_id_fkey"
            columns: ["formula_id"]
            isOneToOne: false
            referencedRelation: "formulas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formula_ingredients_raw_material_id_fkey"
            columns: ["raw_material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      formula_user_permissions: {
        Row: {
          access_conditions: Json | null
          approval_count: number | null
          expires_at: string | null
          formula_id: string
          granted_at: string | null
          granted_by: string
          id: string
          is_active: boolean | null
          last_used_at: string | null
          permission_type: string
          required_approvals: number | null
          usage_count: number | null
          user_id: string
        }
        Insert: {
          access_conditions?: Json | null
          approval_count?: number | null
          expires_at?: string | null
          formula_id: string
          granted_at?: string | null
          granted_by: string
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          permission_type: string
          required_approvals?: number | null
          usage_count?: number | null
          user_id: string
        }
        Update: {
          access_conditions?: Json | null
          approval_count?: number | null
          expires_at?: string | null
          formula_id?: string
          granted_at?: string | null
          granted_by?: string
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          permission_type?: string
          required_approvals?: number | null
          usage_count?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "formula_user_permissions_formula_id_fkey"
            columns: ["formula_id"]
            isOneToOne: false
            referencedRelation: "formulas"
            referencedColumns: ["id"]
          },
        ]
      }
      formulas: {
        Row: {
          access_count: number | null
          active_ingredients_json: Json | null
          average_piece_weight: number | null
          classification_level: string | null
          code: string
          created_at: string
          customer_id: string | null
          default_batch_size_kg: number
          formula_code: string | null
          gummies_per_batch: number | null
          id: string
          is_deleted: boolean | null
          last_accessed_at: string | null
          name: string
          notes: string | null
          procedure_text: string | null
          product_code_line: string | null
          recipe_json: Json | null
          requires_approval: boolean | null
          security_level: string | null
          serving_size: number | null
          spec_color_text: string | null
          spec_consistency_text: string | null
          spec_flavor_text: string | null
          spec_foreign_particles_text: string | null
          spec_shape_text: string | null
          spec_weight_range_text: string | null
          status: string | null
          total_pieces: number | null
          updated_at: string
          version: string | null
          yield_uom: string | null
        }
        Insert: {
          access_count?: number | null
          active_ingredients_json?: Json | null
          average_piece_weight?: number | null
          classification_level?: string | null
          code: string
          created_at?: string
          customer_id?: string | null
          default_batch_size_kg?: number
          formula_code?: string | null
          gummies_per_batch?: number | null
          id?: string
          is_deleted?: boolean | null
          last_accessed_at?: string | null
          name: string
          notes?: string | null
          procedure_text?: string | null
          product_code_line?: string | null
          recipe_json?: Json | null
          requires_approval?: boolean | null
          security_level?: string | null
          serving_size?: number | null
          spec_color_text?: string | null
          spec_consistency_text?: string | null
          spec_flavor_text?: string | null
          spec_foreign_particles_text?: string | null
          spec_shape_text?: string | null
          spec_weight_range_text?: string | null
          status?: string | null
          total_pieces?: number | null
          updated_at?: string
          version?: string | null
          yield_uom?: string | null
        }
        Update: {
          access_count?: number | null
          active_ingredients_json?: Json | null
          average_piece_weight?: number | null
          classification_level?: string | null
          code?: string
          created_at?: string
          customer_id?: string | null
          default_batch_size_kg?: number
          formula_code?: string | null
          gummies_per_batch?: number | null
          id?: string
          is_deleted?: boolean | null
          last_accessed_at?: string | null
          name?: string
          notes?: string | null
          procedure_text?: string | null
          product_code_line?: string | null
          recipe_json?: Json | null
          requires_approval?: boolean | null
          security_level?: string | null
          serving_size?: number | null
          spec_color_text?: string | null
          spec_consistency_text?: string | null
          spec_flavor_text?: string | null
          spec_foreign_particles_text?: string | null
          spec_shape_text?: string | null
          spec_weight_range_text?: string | null
          status?: string | null
          total_pieces?: number | null
          updated_at?: string
          version?: string | null
          yield_uom?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "formulas_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      graph_tokens: {
        Row: {
          access_token: string
          created_at: string | null
          expires_at: string
          id: string
          last_message_id: string | null
          last_poll_at: string | null
          mailbox_email: string
          refresh_token: string
          user_id: string | null
          webhook_expires_at: string | null
          webhook_subscription_id: string | null
        }
        Insert: {
          access_token: string
          created_at?: string | null
          expires_at: string
          id?: string
          last_message_id?: string | null
          last_poll_at?: string | null
          mailbox_email: string
          refresh_token: string
          user_id?: string | null
          webhook_expires_at?: string | null
          webhook_subscription_id?: string | null
        }
        Update: {
          access_token?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          last_message_id?: string | null
          last_poll_at?: string | null
          mailbox_email?: string
          refresh_token?: string
          user_id?: string | null
          webhook_expires_at?: string | null
          webhook_subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "graph_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_data_access_requests: {
        Row: {
          access_reason: string
          access_type: string
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          denial_reason: string | null
          denied_at: string | null
          denied_by: string | null
          employee_id: string
          expires_at: string | null
          id: string
          requested_at: string | null
          requester_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          access_reason: string
          access_type?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          denial_reason?: string | null
          denied_at?: string | null
          denied_by?: string | null
          employee_id: string
          expires_at?: string | null
          id?: string
          requested_at?: string | null
          requester_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          access_reason?: string
          access_type?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          denial_reason?: string | null
          denied_at?: string | null
          denied_by?: string | null
          employee_id?: string
          expires_at?: string | null
          id?: string
          requested_at?: string | null
          requester_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      hr_sensitive_data_sessions: {
        Row: {
          created_at: string | null
          employee_id: string
          expires_at: string
          id: string
          ip_address: unknown
          is_active: boolean | null
          request_id: string
          started_at: string | null
          terminated_at: string | null
          terminated_reason: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          employee_id: string
          expires_at: string
          id?: string
          ip_address?: unknown
          is_active?: boolean | null
          request_id: string
          started_at?: string | null
          terminated_at?: string | null
          terminated_reason?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          employee_id?: string
          expires_at?: string
          id?: string
          ip_address?: unknown
          is_active?: boolean | null
          request_id?: string
          started_at?: string | null
          terminated_at?: string | null
          terminated_reason?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_sensitive_data_sessions_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "hr_data_access_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      ingested_emails: {
        Row: {
          agent_event_id: string | null
          attachment_filenames: string[] | null
          attachment_storage_paths: string[] | null
          body_preview: string | null
          created_at: string | null
          from_email: string
          from_name: string | null
          graph_message_id: string
          has_attachments: boolean | null
          id: string
          po_detected: boolean | null
          processing_status: string | null
          received_at: string
          subject: string | null
        }
        Insert: {
          agent_event_id?: string | null
          attachment_filenames?: string[] | null
          attachment_storage_paths?: string[] | null
          body_preview?: string | null
          created_at?: string | null
          from_email: string
          from_name?: string | null
          graph_message_id: string
          has_attachments?: boolean | null
          id?: string
          po_detected?: boolean | null
          processing_status?: string | null
          received_at: string
          subject?: string | null
        }
        Update: {
          agent_event_id?: string | null
          attachment_filenames?: string[] | null
          attachment_storage_paths?: string[] | null
          body_preview?: string | null
          created_at?: string | null
          from_email?: string
          from_name?: string | null
          graph_message_id?: string
          has_attachments?: boolean | null
          id?: string
          po_detected?: boolean | null
          processing_status?: string | null
          received_at?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ingested_emails_agent_event_id_fkey"
            columns: ["agent_event_id"]
            isOneToOne: false
            referencedRelation: "agent_events"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredient_deductions: {
        Row: {
          completed_batch_id: string
          created_at: string
          deducted_quantity_kg: number
          id: string
          ingredient_name: string
          lot_id: string | null
          lot_number: string | null
          raw_material_id: string
          supplier_name: string | null
        }
        Insert: {
          completed_batch_id: string
          created_at?: string
          deducted_quantity_kg: number
          id?: string
          ingredient_name: string
          lot_id?: string | null
          lot_number?: string | null
          raw_material_id: string
          supplier_name?: string | null
        }
        Update: {
          completed_batch_id?: string
          created_at?: string
          deducted_quantity_kg?: number
          id?: string
          ingredient_name?: string
          lot_id?: string | null
          lot_number?: string | null
          raw_material_id?: string
          supplier_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ingredient_deductions_completed_batch_id_fkey"
            columns: ["completed_batch_id"]
            isOneToOne: false
            referencedRelation: "completed_batch_deductions"
            referencedColumns: ["id"]
          },
        ]
      }
      inquiry_messages: {
        Row: {
          attachments: Json | null
          created_at: string | null
          id: string
          inquiry_id: string
          is_internal_note: boolean | null
          message: string
          sender_email: string | null
          sender_id: string | null
          sender_name: string
          sender_type: string
        }
        Insert: {
          attachments?: Json | null
          created_at?: string | null
          id?: string
          inquiry_id: string
          is_internal_note?: boolean | null
          message: string
          sender_email?: string | null
          sender_id?: string | null
          sender_name: string
          sender_type: string
        }
        Update: {
          attachments?: Json | null
          created_at?: string | null
          id?: string
          inquiry_id?: string
          is_internal_note?: boolean | null
          message?: string
          sender_email?: string | null
          sender_id?: string | null
          sender_name?: string
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "inquiry_messages_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "customer_inquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inquiry_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inquiry_order_details: {
        Row: {
          bottle_size: number | null
          created_at: string | null
          formula_code: string | null
          id: string
          inquiry_id: string
          order_type: string | null
          po_number: string | null
          preferred_delivery_date: string | null
          product_name: string | null
          products: Json | null
          quantity: number | null
          special_requirements: string | null
        }
        Insert: {
          bottle_size?: number | null
          created_at?: string | null
          formula_code?: string | null
          id?: string
          inquiry_id: string
          order_type?: string | null
          po_number?: string | null
          preferred_delivery_date?: string | null
          product_name?: string | null
          products?: Json | null
          quantity?: number | null
          special_requirements?: string | null
        }
        Update: {
          bottle_size?: number | null
          created_at?: string | null
          formula_code?: string | null
          id?: string
          inquiry_id?: string
          order_type?: string | null
          po_number?: string | null
          preferred_delivery_date?: string | null
          product_name?: string | null
          products?: Json | null
          quantity?: number | null
          special_requirements?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inquiry_order_details_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "customer_inquiries"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_reservations: {
        Row: {
          created_at: string
          id: string
          lot_id: string
          reserved_kg: number
          schedule_item_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lot_id: string
          reserved_kg: number
          schedule_item_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lot_id?: string
          reserved_kg?: number
          schedule_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_reservations_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "raw_material_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_reservations_schedule_item_id_fkey"
            columns: ["schedule_item_id"]
            isOneToOne: false
            referencedRelation: "production_schedule_items"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_thresholds: {
        Row: {
          alert_enabled: boolean
          created_at: string
          created_by: string | null
          id: string
          min_quantity_kg: number
          raw_material_id: string
          reorder_quantity_kg: number
          updated_at: string
        }
        Insert: {
          alert_enabled?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          min_quantity_kg?: number
          raw_material_id: string
          reorder_quantity_kg?: number
          updated_at?: string
        }
        Update: {
          alert_enabled?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          min_quantity_kg?: number
          raw_material_id?: string
          reorder_quantity_kg?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_thresholds_raw_material_id_fkey"
            columns: ["raw_material_id"]
            isOneToOne: true
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_update_session_items: {
        Row: {
          created_at: string | null
          id: string
          item_name: string
          item_type: string
          label_inventory_id: string | null
          movement_id: string | null
          quantity_deducted: number
          session_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          item_name: string
          item_type: string
          label_inventory_id?: string | null
          movement_id?: string | null
          quantity_deducted: number
          session_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          item_name?: string
          item_type?: string
          label_inventory_id?: string | null
          movement_id?: string | null
          quantity_deducted?: number
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_update_session_items_label_inventory_id_fkey"
            columns: ["label_inventory_id"]
            isOneToOne: false
            referencedRelation: "label_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_update_session_items_movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: false
            referencedRelation: "packaging_movement"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_update_session_items_movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: false
            referencedRelation: "v_packaging_history"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_update_session_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "inventory_update_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_update_sessions: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          item_count: number | null
          notes: string | null
          session_date: string
          total_deductions: number | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          item_count?: number | null
          notes?: string | null
          session_date: string
          total_deductions?: number | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          item_count?: number | null
          notes?: string | null
          session_date?: string
          total_deductions?: number | null
        }
        Relationships: []
      }
      label_inventory: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string | null
          customer_product: string
          date: string
          id: string
          lot_number: string | null
          on_hand: number | null
          order_header_id: string | null
          product_name: string | null
          received_qty: number | null
          source_sheet: string | null
          updated_at: string
          used_qty: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_product: string
          date: string
          id?: string
          lot_number?: string | null
          on_hand?: number | null
          order_header_id?: string | null
          product_name?: string | null
          received_qty?: number | null
          source_sheet?: string | null
          updated_at?: string
          used_qty?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_product?: string
          date?: string
          id?: string
          lot_number?: string | null
          on_hand?: number | null
          order_header_id?: string | null
          product_name?: string | null
          received_qty?: number | null
          source_sheet?: string | null
          updated_at?: string
          used_qty?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "label_inventory_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "label_inventory_order_header_id_fkey"
            columns: ["order_header_id"]
            isOneToOne: false
            referencedRelation: "order_headers"
            referencedColumns: ["id"]
          },
        ]
      }
      label_reviews: {
        Row: {
          created_at: string
          error: string | null
          gummy_weight_g: number | null
          id: string
          label_file_name: string
          label_file_path: string
          report_file_path: string | null
          report_path: string | null
          reviewer_name: string | null
          status: string
          summary: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          gummy_weight_g?: number | null
          id?: string
          label_file_name: string
          label_file_path: string
          report_file_path?: string | null
          report_path?: string | null
          reviewer_name?: string | null
          status?: string
          summary?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          gummy_weight_g?: number | null
          id?: string
          label_file_name?: string
          label_file_path?: string
          report_file_path?: string | null
          report_path?: string | null
          reviewer_name?: string | null
          status?: string
          summary?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      launch_attachments: {
        Row: {
          file_name: string
          file_size: number | null
          file_type: string | null
          id: string
          project_id: string | null
          storage_path: string
          task_id: string | null
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          file_name: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          project_id?: string | null
          storage_path: string
          task_id?: string | null
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          project_id?: string | null
          storage_path?: string
          task_id?: string | null
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "launch_attachments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "launch_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "launch_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "launch_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      launch_charters: {
        Row: {
          assumptions: string | null
          budget_amount: number | null
          budget_currency: string
          business_case: string | null
          constraints: string | null
          created_at: string
          created_by: string | null
          executive_sponsor_id: string | null
          id: string
          in_scope: string | null
          objectives: string | null
          out_of_scope: string | null
          project_id: string
          project_owner_id: string | null
          success_criteria: string | null
          updated_at: string
        }
        Insert: {
          assumptions?: string | null
          budget_amount?: number | null
          budget_currency?: string
          business_case?: string | null
          constraints?: string | null
          created_at?: string
          created_by?: string | null
          executive_sponsor_id?: string | null
          id?: string
          in_scope?: string | null
          objectives?: string | null
          out_of_scope?: string | null
          project_id: string
          project_owner_id?: string | null
          success_criteria?: string | null
          updated_at?: string
        }
        Update: {
          assumptions?: string | null
          budget_amount?: number | null
          budget_currency?: string
          business_case?: string | null
          constraints?: string | null
          created_at?: string
          created_by?: string | null
          executive_sponsor_id?: string | null
          id?: string
          in_scope?: string | null
          objectives?: string | null
          out_of_scope?: string | null
          project_id?: string
          project_owner_id?: string | null
          success_criteria?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "launch_charters_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "launch_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      launch_milestone_tasks: {
        Row: {
          milestone_id: string
          task_id: string
        }
        Insert: {
          milestone_id: string
          task_id: string
        }
        Update: {
          milestone_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "launch_milestone_tasks_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "launch_milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "launch_milestone_tasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "launch_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      launch_milestones: {
        Row: {
          completed_at: string | null
          created_at: string
          date: string
          description: string | null
          id: string
          name: string
          owner_id: string | null
          position: number
          product_line_id: string | null
          project_id: string | null
          signed_off_at: string | null
          signed_off_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          date: string
          description?: string | null
          id?: string
          name: string
          owner_id?: string | null
          position?: number
          product_line_id?: string | null
          project_id?: string | null
          signed_off_at?: string | null
          signed_off_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          name?: string
          owner_id?: string | null
          position?: number
          product_line_id?: string | null
          project_id?: string | null
          signed_off_at?: string | null
          signed_off_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "launch_milestones_product_line_id_fkey"
            columns: ["product_line_id"]
            isOneToOne: false
            referencedRelation: "launch_product_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "launch_milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "launch_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      launch_product_lines: {
        Row: {
          color: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          target_launch_date: string | null
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          target_launch_date?: string | null
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          target_launch_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      launch_project_members: {
        Row: {
          added_at: string
          id: string
          project_id: string
          role: string
          user_id: string
        }
        Insert: {
          added_at?: string
          id?: string
          project_id: string
          role?: string
          user_id: string
        }
        Update: {
          added_at?: string
          id?: string
          project_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "launch_project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "launch_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      launch_projects: {
        Row: {
          code: string | null
          color: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          owner_id: string | null
          priority: Database["public"]["Enums"]["launch_priority"]
          product_line_id: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["launch_project_status"]
          target_date: string | null
          updated_at: string
        }
        Insert: {
          code?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          owner_id?: string | null
          priority?: Database["public"]["Enums"]["launch_priority"]
          product_line_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["launch_project_status"]
          target_date?: string | null
          updated_at?: string
        }
        Update: {
          code?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          owner_id?: string | null
          priority?: Database["public"]["Enums"]["launch_priority"]
          product_line_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["launch_project_status"]
          target_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "launch_projects_product_line_id_fkey"
            columns: ["product_line_id"]
            isOneToOne: false
            referencedRelation: "launch_product_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      launch_risks: {
        Row: {
          contingency: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          impact: number
          likelihood: number
          mitigation: string | null
          owner_id: string | null
          project_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          contingency?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          impact?: number
          likelihood?: number
          mitigation?: string | null
          owner_id?: string | null
          project_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          contingency?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          impact?: number
          likelihood?: number
          mitigation?: string | null
          owner_id?: string | null
          project_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "launch_risks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "launch_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      launch_stakeholders: {
        Row: {
          created_at: string
          external_email: string | null
          external_name: string | null
          id: string
          notes: string | null
          project_id: string
          raci: string
          user_id: string | null
          workstream: string
        }
        Insert: {
          created_at?: string
          external_email?: string | null
          external_name?: string | null
          id?: string
          notes?: string | null
          project_id: string
          raci: string
          user_id?: string | null
          workstream?: string
        }
        Update: {
          created_at?: string
          external_email?: string | null
          external_name?: string | null
          id?: string
          notes?: string | null
          project_id?: string
          raci?: string
          user_id?: string | null
          workstream?: string
        }
        Relationships: [
          {
            foreignKeyName: "launch_stakeholders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "launch_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      launch_status_snapshots: {
        Row: {
          accomplishments: string | null
          blockers: string | null
          captured_at: string
          captured_by: string | null
          health: string
          id: string
          milestones_done: number
          milestones_total: number
          next_steps: string | null
          open_risks_count: number
          percent_complete: number
          project_id: string
        }
        Insert: {
          accomplishments?: string | null
          blockers?: string | null
          captured_at?: string
          captured_by?: string | null
          health?: string
          id?: string
          milestones_done?: number
          milestones_total?: number
          next_steps?: string | null
          open_risks_count?: number
          percent_complete?: number
          project_id: string
        }
        Update: {
          accomplishments?: string | null
          blockers?: string | null
          captured_at?: string
          captured_by?: string | null
          health?: string
          id?: string
          milestones_done?: number
          milestones_total?: number
          next_steps?: string | null
          open_risks_count?: number
          percent_complete?: number
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "launch_status_snapshots_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "launch_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      launch_task_updates: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          kind: string
          task_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          kind?: string
          task_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          kind?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "launch_task_updates_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "launch_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      launch_tasks: {
        Row: {
          assignee_id: string | null
          checklist: Json
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          phase: Database["public"]["Enums"]["launch_phase"]
          position: number
          priority: Database["public"]["Enums"]["launch_priority"]
          product_line_id: string | null
          project_id: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["launch_status"]
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          checklist?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          phase?: Database["public"]["Enums"]["launch_phase"]
          position?: number
          priority?: Database["public"]["Enums"]["launch_priority"]
          product_line_id?: string | null
          project_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["launch_status"]
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          checklist?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          phase?: Database["public"]["Enums"]["launch_phase"]
          position?: number
          priority?: Database["public"]["Enums"]["launch_priority"]
          product_line_id?: string | null
          project_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["launch_status"]
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "launch_tasks_product_line_id_fkey"
            columns: ["product_line_id"]
            isOneToOne: false
            referencedRelation: "launch_product_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "launch_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "launch_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      material_reservations_history: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          order_id: string | null
          reservation_details: Json | null
          reserved_at: string | null
          reserved_by: string | null
          schedule_item_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          reservation_details?: Json | null
          reserved_at?: string | null
          reserved_by?: string | null
          schedule_item_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          reservation_details?: Json | null
          reserved_at?: string | null
          reserved_by?: string | null
          schedule_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "material_reservations_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_headers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_reservations_history_schedule_item_id_fkey"
            columns: ["schedule_item_id"]
            isOneToOne: false
            referencedRelation: "production_schedule_items"
            referencedColumns: ["id"]
          },
        ]
      }
      mentions: {
        Row: {
          context: string | null
          created_at: string
          id: string
          link: string | null
          mentioned_by: string | null
          mentioned_user_id: string
          source_id: string
          source_type: string
        }
        Insert: {
          context?: string | null
          created_at?: string
          id?: string
          link?: string | null
          mentioned_by?: string | null
          mentioned_user_id: string
          source_id: string
          source_type: string
        }
        Update: {
          context?: string | null
          created_at?: string
          id?: string
          link?: string | null
          mentioned_by?: string | null
          mentioned_user_id?: string
          source_id?: string
          source_type?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          categories: Json
          email_enabled: boolean
          in_app_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          categories?: Json
          email_enabled?: boolean
          in_app_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          categories?: Json
          email_enabled?: boolean
          in_app_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_required: boolean | null
          action_taken: boolean | null
          action_url: string | null
          created_at: string | null
          data: Json | null
          email_sent: boolean | null
          id: string
          message: string
          read: boolean | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          action_required?: boolean | null
          action_taken?: boolean | null
          action_url?: string | null
          created_at?: string | null
          data?: Json | null
          email_sent?: boolean | null
          id?: string
          message: string
          read?: boolean | null
          title: string
          type: string
          user_id?: string | null
        }
        Update: {
          action_required?: boolean | null
          action_taken?: boolean | null
          action_url?: string | null
          created_at?: string | null
          data?: Json | null
          email_sent?: boolean | null
          id?: string
          message?: string
          read?: boolean | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      office_supplies: {
        Row: {
          buy_link: string | null
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          item_name: string
          min_quantity: number | null
          notes: string | null
          quantity_on_hand: number
          supplier: string | null
          unit_of_measure: string
          updated_at: string
        }
        Insert: {
          buy_link?: string | null
          category: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          item_name: string
          min_quantity?: number | null
          notes?: string | null
          quantity_on_hand?: number
          supplier?: string | null
          unit_of_measure?: string
          updated_at?: string
        }
        Update: {
          buy_link?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          item_name?: string
          min_quantity?: number | null
          notes?: string | null
          quantity_on_hand?: number
          supplier?: string | null
          unit_of_measure?: string
          updated_at?: string
        }
        Relationships: []
      }
      office_supply_purchases: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          item_id: string
          notes: string | null
          purchase_date: string
          quantity: number
          shipping_cost: number
          supplier: string | null
          tax: number
          total_cost: number
          unit_cost: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          item_id: string
          notes?: string | null
          purchase_date: string
          quantity: number
          shipping_cost?: number
          supplier?: string | null
          tax?: number
          total_cost?: number
          unit_cost?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          item_id?: string
          notes?: string | null
          purchase_date?: string
          quantity?: number
          shipping_cost?: number
          supplier?: string | null
          tax?: number
          total_cost?: number
          unit_cost?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "office_supply_purchases_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "office_supplies"
            referencedColumns: ["id"]
          },
        ]
      }
      office_supply_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          buy_link: string | null
          created_at: string
          fulfilled_at: string | null
          fulfilled_by: string | null
          id: string
          item_id: string | null
          item_name: string
          notes: string | null
          priority: string
          quantity_requested: number
          reason: string | null
          rejection_reason: string | null
          requested_by: string
          requester_email: string
          requester_name: string
          status: string
          unit_of_measure: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          buy_link?: string | null
          created_at?: string
          fulfilled_at?: string | null
          fulfilled_by?: string | null
          id?: string
          item_id?: string | null
          item_name: string
          notes?: string | null
          priority?: string
          quantity_requested: number
          reason?: string | null
          rejection_reason?: string | null
          requested_by: string
          requester_email: string
          requester_name: string
          status?: string
          unit_of_measure?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          buy_link?: string | null
          created_at?: string
          fulfilled_at?: string | null
          fulfilled_by?: string | null
          id?: string
          item_id?: string | null
          item_name?: string
          notes?: string | null
          priority?: string
          quantity_requested?: number
          reason?: string | null
          rejection_reason?: string | null
          requested_by?: string
          requester_email?: string
          requester_name?: string
          status?: string
          unit_of_measure?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "office_supply_requests_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "office_supplies"
            referencedColumns: ["id"]
          },
        ]
      }
      office_supply_transactions: {
        Row: {
          cost: number | null
          created_at: string
          id: string
          item_id: string
          notes: string | null
          performed_by: string
          quantity: number
          transaction_type: string
        }
        Insert: {
          cost?: number | null
          created_at?: string
          id?: string
          item_id: string
          notes?: string | null
          performed_by: string
          quantity: number
          transaction_type: string
        }
        Update: {
          cost?: number | null
          created_at?: string
          id?: string
          item_id?: string
          notes?: string | null
          performed_by?: string
          quantity?: number
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "office_supply_transactions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "office_supplies"
            referencedColumns: ["id"]
          },
        ]
      }
      order_delivery_milestones: {
        Row: {
          created_at: string | null
          id: string
          line_item_id: string | null
          milestone_number: number
          notes: string | null
          order_id: string
          shipped_bottles: number | null
          status: string | null
          target_bottles: number
          target_date: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          line_item_id?: string | null
          milestone_number: number
          notes?: string | null
          order_id: string
          shipped_bottles?: number | null
          status?: string | null
          target_bottles: number
          target_date: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          line_item_id?: string | null
          milestone_number?: number
          notes?: string | null
          order_id?: string
          shipped_bottles?: number | null
          status?: string | null
          target_bottles?: number
          target_date?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_delivery_milestones_line_item_id_fkey"
            columns: ["line_item_id"]
            isOneToOne: false
            referencedRelation: "order_line_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_delivery_milestones_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_headers"
            referencedColumns: ["id"]
          },
        ]
      }
      order_drafts: {
        Row: {
          created_at: string | null
          id: string
          order_data: Json
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          order_data: Json
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          order_data?: Json
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      order_fulfillment_wizard_runs: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          current_step: number
          id: string
          order_id: string
          started_at: string
          step_status: Json
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          current_step?: number
          id?: string
          order_id: string
          started_at?: string
          step_status?: Json
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          current_step?: number
          id?: string
          order_id?: string
          started_at?: string
          step_status?: Json
        }
        Relationships: [
          {
            foreignKeyName: "order_fulfillment_wizard_runs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_headers"
            referencedColumns: ["id"]
          },
        ]
      }
      order_headers: {
        Row: {
          agent_event_id: string | null
          approval_status: string | null
          approved_at: string | null
          approved_by: string | null
          bottles_from_bright_stock: number | null
          bottles_from_new_production: number | null
          created_at: string
          created_by: string | null
          customer_id: string
          due_date: string
          fulfillment_status: string
          header_status: string | null
          id: string
          notes: string | null
          order_number: string
          pdf_url: string | null
          po_attachment_path: string | null
          po_number: string | null
          priority: string
          received_date: string | null
          received_from_email: string | null
          received_via: string | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          source: string | null
          source_email_id: string | null
          special_instructions: string | null
          status: string
          total_bottles_ordered: number | null
          total_bottles_shipped: number | null
          total_line_items: number | null
          updated_at: string
          wizard_run_id: string | null
        }
        Insert: {
          agent_event_id?: string | null
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          bottles_from_bright_stock?: number | null
          bottles_from_new_production?: number | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          due_date: string
          fulfillment_status?: string
          header_status?: string | null
          id?: string
          notes?: string | null
          order_number: string
          pdf_url?: string | null
          po_attachment_path?: string | null
          po_number?: string | null
          priority?: string
          received_date?: string | null
          received_from_email?: string | null
          received_via?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          source?: string | null
          source_email_id?: string | null
          special_instructions?: string | null
          status?: string
          total_bottles_ordered?: number | null
          total_bottles_shipped?: number | null
          total_line_items?: number | null
          updated_at?: string
          wizard_run_id?: string | null
        }
        Update: {
          agent_event_id?: string | null
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          bottles_from_bright_stock?: number | null
          bottles_from_new_production?: number | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          due_date?: string
          fulfillment_status?: string
          header_status?: string | null
          id?: string
          notes?: string | null
          order_number?: string
          pdf_url?: string | null
          po_attachment_path?: string | null
          po_number?: string | null
          priority?: string
          received_date?: string | null
          received_from_email?: string | null
          received_via?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          source?: string | null
          source_email_id?: string | null
          special_instructions?: string | null
          status?: string
          total_bottles_ordered?: number | null
          total_bottles_shipped?: number | null
          total_line_items?: number | null
          updated_at?: string
          wizard_run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_headers_agent_event_id_fkey"
            columns: ["agent_event_id"]
            isOneToOne: false
            referencedRelation: "agent_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_headers_source_email_id_fkey"
            columns: ["source_email_id"]
            isOneToOne: false
            referencedRelation: "ingested_emails"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_headers_wizard_run_id_fkey"
            columns: ["wizard_run_id"]
            isOneToOne: false
            referencedRelation: "order_fulfillment_wizard_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      order_line_items: {
        Row: {
          batch_size_kg: number | null
          batches_required: number | null
          bottle_container: string | null
          bottle_size: number
          bottles_ordered: number
          bottles_remaining: number | null
          bottles_shipped: number | null
          created_at: string | null
          excess_created: number
          formula_id: string | null
          id: string
          invoice_status: string
          invoiceable_qty: number
          line_number: string
          line_total: number | null
          notes: string | null
          order_id: string
          order_type: string
          piece_weight: number | null
          price_per_unit: number | null
          product_name: string | null
          production_status: string | null
          qty_accepted_total: number
          qty_allocated_from_excess: number
          qty_packed: number
          qty_shipped_total: number
          qty_to_produce: number
          scheduled_production_date: string | null
          selected_bottle_id: string | null
          selected_cap_id: string | null
          selected_label_id: string | null
          shortage_qty: number
          shortage_status: string | null
          suggested_start_date: string | null
          updated_at: string | null
        }
        Insert: {
          batch_size_kg?: number | null
          batches_required?: number | null
          bottle_container?: string | null
          bottle_size: number
          bottles_ordered: number
          bottles_remaining?: number | null
          bottles_shipped?: number | null
          created_at?: string | null
          excess_created?: number
          formula_id?: string | null
          id?: string
          invoice_status?: string
          invoiceable_qty?: number
          line_number: string
          line_total?: number | null
          notes?: string | null
          order_id: string
          order_type?: string
          piece_weight?: number | null
          price_per_unit?: number | null
          product_name?: string | null
          production_status?: string | null
          qty_accepted_total?: number
          qty_allocated_from_excess?: number
          qty_packed?: number
          qty_shipped_total?: number
          qty_to_produce?: number
          scheduled_production_date?: string | null
          selected_bottle_id?: string | null
          selected_cap_id?: string | null
          selected_label_id?: string | null
          shortage_qty?: number
          shortage_status?: string | null
          suggested_start_date?: string | null
          updated_at?: string | null
        }
        Update: {
          batch_size_kg?: number | null
          batches_required?: number | null
          bottle_container?: string | null
          bottle_size?: number
          bottles_ordered?: number
          bottles_remaining?: number | null
          bottles_shipped?: number | null
          created_at?: string | null
          excess_created?: number
          formula_id?: string | null
          id?: string
          invoice_status?: string
          invoiceable_qty?: number
          line_number?: string
          line_total?: number | null
          notes?: string | null
          order_id?: string
          order_type?: string
          piece_weight?: number | null
          price_per_unit?: number | null
          product_name?: string | null
          production_status?: string | null
          qty_accepted_total?: number
          qty_allocated_from_excess?: number
          qty_packed?: number
          qty_shipped_total?: number
          qty_to_produce?: number
          scheduled_production_date?: string | null
          selected_bottle_id?: string | null
          selected_cap_id?: string | null
          selected_label_id?: string | null
          shortage_qty?: number
          shortage_status?: string | null
          suggested_start_date?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_order_line_items_selected_bottle"
            columns: ["selected_bottle_id"]
            isOneToOne: false
            referencedRelation: "packaging_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_order_line_items_selected_bottle"
            columns: ["selected_bottle_id"]
            isOneToOne: false
            referencedRelation: "v_packaging_balances"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "fk_order_line_items_selected_cap"
            columns: ["selected_cap_id"]
            isOneToOne: false
            referencedRelation: "packaging_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_order_line_items_selected_cap"
            columns: ["selected_cap_id"]
            isOneToOne: false
            referencedRelation: "v_packaging_balances"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "fk_order_line_items_selected_label"
            columns: ["selected_label_id"]
            isOneToOne: false
            referencedRelation: "label_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_line_items_formula_id_fkey"
            columns: ["formula_id"]
            isOneToOne: false
            referencedRelation: "formulas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_line_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_headers"
            referencedColumns: ["id"]
          },
        ]
      }
      order_production_batches: {
        Row: {
          actual_bottles_packed: number | null
          batch_sequence: number
          bright_stock_id: string | null
          created_at: string
          estimated_bottles: number
          id: string
          is_bright_stock: boolean | null
          line_item_id: string | null
          production_schedule_item_id: string
        }
        Insert: {
          actual_bottles_packed?: number | null
          batch_sequence: number
          bright_stock_id?: string | null
          created_at?: string
          estimated_bottles: number
          id?: string
          is_bright_stock?: boolean | null
          line_item_id?: string | null
          production_schedule_item_id: string
        }
        Update: {
          actual_bottles_packed?: number | null
          batch_sequence?: number
          bright_stock_id?: string | null
          created_at?: string
          estimated_bottles?: number
          id?: string
          is_bright_stock?: boolean | null
          line_item_id?: string | null
          production_schedule_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_production_batches_bright_stock_id_fkey"
            columns: ["bright_stock_id"]
            isOneToOne: false
            referencedRelation: "bright_stock"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_production_batches_line_item_id_fkey"
            columns: ["line_item_id"]
            isOneToOne: false
            referencedRelation: "order_line_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_production_batches_production_schedule_item_id_fkey"
            columns: ["production_schedule_item_id"]
            isOneToOne: false
            referencedRelation: "production_schedule_items"
            referencedColumns: ["id"]
          },
        ]
      }
      order_shipment_lines: {
        Row: {
          acceptance_status: string
          created_at: string
          customer_confirmation_doc_url: string | null
          id: string
          order_line_id: string
          qty_accepted: number | null
          qty_shipped: number
          shipment_id: string
        }
        Insert: {
          acceptance_status?: string
          created_at?: string
          customer_confirmation_doc_url?: string | null
          id?: string
          order_line_id: string
          qty_accepted?: number | null
          qty_shipped?: number
          shipment_id: string
        }
        Update: {
          acceptance_status?: string
          created_at?: string
          customer_confirmation_doc_url?: string | null
          id?: string
          order_line_id?: string
          qty_accepted?: number | null
          qty_shipped?: number
          shipment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_shipment_lines_order_line_id_fkey"
            columns: ["order_line_id"]
            isOneToOne: false
            referencedRelation: "order_line_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_shipment_lines_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "order_shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      order_shipments: {
        Row: {
          carrier: string | null
          created_at: string | null
          id: string
          line_item_id: string | null
          notes: string | null
          order_id: string | null
          shipment_date: string
          shipped_by: string | null
          shipped_quantity: number
          tracking_number: string | null
          updated_at: string | null
        }
        Insert: {
          carrier?: string | null
          created_at?: string | null
          id?: string
          line_item_id?: string | null
          notes?: string | null
          order_id?: string | null
          shipment_date: string
          shipped_by?: string | null
          shipped_quantity: number
          tracking_number?: string | null
          updated_at?: string | null
        }
        Update: {
          carrier?: string | null
          created_at?: string | null
          id?: string
          line_item_id?: string | null
          notes?: string | null
          order_id?: string | null
          shipment_date?: string
          shipped_by?: string | null
          shipped_quantity?: number
          tracking_number?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_shipments_line_item_id_fkey"
            columns: ["line_item_id"]
            isOneToOne: false
            referencedRelation: "order_line_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_headers"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          changed_at: string | null
          changed_by: string | null
          created_at: string | null
          id: string
          new_status: string | null
          notes: string | null
          old_status: string | null
          order_id: string | null
        }
        Insert: {
          changed_at?: string | null
          changed_by?: string | null
          created_at?: string | null
          id?: string
          new_status?: string | null
          notes?: string | null
          old_status?: string | null
          order_id?: string | null
        }
        Update: {
          changed_at?: string | null
          changed_by?: string | null
          created_at?: string | null
          id?: string
          new_status?: string | null
          notes?: string | null
          old_status?: string | null
          order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_headers"
            referencedColumns: ["id"]
          },
        ]
      }
      packaging_completion_records: {
        Row: {
          bottles_packed: number
          bottles_used: number
          bright_stock_id: string | null
          bright_stock_qty: number | null
          caps_used: number
          completed_by: string | null
          completion_date: string
          created_at: string | null
          extra_bottle_count: string | null
          extra_form: string | null
          extra_gummies_per_pouch: number | null
          extra_is_labeled: boolean | null
          extra_label_customer_product: string | null
          extra_pouch_inventory_id: string | null
          extra_pouches_used: number | null
          extra_total_gummies: number | null
          id: string
          labels_used: number
          notes: string | null
          order_line_item_id: string | null
          schedule_id: string | null
        }
        Insert: {
          bottles_packed: number
          bottles_used: number
          bright_stock_id?: string | null
          bright_stock_qty?: number | null
          caps_used: number
          completed_by?: string | null
          completion_date: string
          created_at?: string | null
          extra_bottle_count?: string | null
          extra_form?: string | null
          extra_gummies_per_pouch?: number | null
          extra_is_labeled?: boolean | null
          extra_label_customer_product?: string | null
          extra_pouch_inventory_id?: string | null
          extra_pouches_used?: number | null
          extra_total_gummies?: number | null
          id?: string
          labels_used: number
          notes?: string | null
          order_line_item_id?: string | null
          schedule_id?: string | null
        }
        Update: {
          bottles_packed?: number
          bottles_used?: number
          bright_stock_id?: string | null
          bright_stock_qty?: number | null
          caps_used?: number
          completed_by?: string | null
          completion_date?: string
          created_at?: string | null
          extra_bottle_count?: string | null
          extra_form?: string | null
          extra_gummies_per_pouch?: number | null
          extra_is_labeled?: boolean | null
          extra_label_customer_product?: string | null
          extra_pouch_inventory_id?: string | null
          extra_pouches_used?: number | null
          extra_total_gummies?: number | null
          id?: string
          labels_used?: number
          notes?: string | null
          order_line_item_id?: string | null
          schedule_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "packaging_completion_records_bright_stock_id_fkey"
            columns: ["bright_stock_id"]
            isOneToOne: false
            referencedRelation: "bright_stock"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packaging_completion_records_extra_pouch_inventory_id_fkey"
            columns: ["extra_pouch_inventory_id"]
            isOneToOne: false
            referencedRelation: "pouch_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packaging_completion_records_order_line_item_id_fkey"
            columns: ["order_line_item_id"]
            isOneToOne: false
            referencedRelation: "order_line_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packaging_completion_records_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "packaging_schedule"
            referencedColumns: ["id"]
          },
        ]
      }
      packaging_item: {
        Row: {
          bottles_per_unit: number | null
          category: string
          created_at: string | null
          customer_id: string | null
          description: string | null
          id: string
          item_name: string
          location: string | null
          min_level: number | null
          notes: string | null
          sku: string | null
          uom: string | null
          updated_at: string | null
        }
        Insert: {
          bottles_per_unit?: number | null
          category: string
          created_at?: string | null
          customer_id?: string | null
          description?: string | null
          id?: string
          item_name: string
          location?: string | null
          min_level?: number | null
          notes?: string | null
          sku?: string | null
          uom?: string | null
          updated_at?: string | null
        }
        Update: {
          bottles_per_unit?: number | null
          category?: string
          created_at?: string | null
          customer_id?: string | null
          description?: string | null
          id?: string
          item_name?: string
          location?: string | null
          min_level?: number | null
          notes?: string | null
          sku?: string | null
          uom?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "packaging_item_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      packaging_movement: {
        Row: {
          created_at: string | null
          id: string
          item_id: string | null
          location: string | null
          lot_number: string | null
          move_date: string
          move_type: string
          notes: string | null
          order_header_id: string | null
          packable_bottles: number | null
          po: string | null
          qty: number
          vendor: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          item_id?: string | null
          location?: string | null
          lot_number?: string | null
          move_date: string
          move_type: string
          notes?: string | null
          order_header_id?: string | null
          packable_bottles?: number | null
          po?: string | null
          qty: number
          vendor?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          item_id?: string | null
          location?: string | null
          lot_number?: string | null
          move_date?: string
          move_type?: string
          notes?: string | null
          order_header_id?: string | null
          packable_bottles?: number | null
          po?: string | null
          qty?: number
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "packaging_movement_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "packaging_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packaging_movement_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_packaging_balances"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "packaging_movement_order_header_id_fkey"
            columns: ["order_header_id"]
            isOneToOne: false
            referencedRelation: "order_headers"
            referencedColumns: ["id"]
          },
        ]
      }
      packaging_schedule: {
        Row: {
          bottle_item_id: string | null
          cap_item_id: string | null
          count: string
          created_at: string | null
          created_by: string | null
          customer_name: string
          expected_bottles: number
          id: string
          label_customer_product: string | null
          lot_number: string | null
          notes: string | null
          order_header_id: string | null
          order_line_item_id: string | null
          product_name: string
          schedule_date: string
          status: string
          updated_at: string | null
        }
        Insert: {
          bottle_item_id?: string | null
          cap_item_id?: string | null
          count: string
          created_at?: string | null
          created_by?: string | null
          customer_name: string
          expected_bottles?: number
          id?: string
          label_customer_product?: string | null
          lot_number?: string | null
          notes?: string | null
          order_header_id?: string | null
          order_line_item_id?: string | null
          product_name: string
          schedule_date: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          bottle_item_id?: string | null
          cap_item_id?: string | null
          count?: string
          created_at?: string | null
          created_by?: string | null
          customer_name?: string
          expected_bottles?: number
          id?: string
          label_customer_product?: string | null
          lot_number?: string | null
          notes?: string | null
          order_header_id?: string | null
          order_line_item_id?: string | null
          product_name?: string
          schedule_date?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "packaging_schedule_bottle_item_id_fkey"
            columns: ["bottle_item_id"]
            isOneToOne: false
            referencedRelation: "packaging_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packaging_schedule_bottle_item_id_fkey"
            columns: ["bottle_item_id"]
            isOneToOne: false
            referencedRelation: "v_packaging_balances"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "packaging_schedule_cap_item_id_fkey"
            columns: ["cap_item_id"]
            isOneToOne: false
            referencedRelation: "packaging_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packaging_schedule_cap_item_id_fkey"
            columns: ["cap_item_id"]
            isOneToOne: false
            referencedRelation: "v_packaging_balances"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "packaging_schedule_order_header_id_fkey"
            columns: ["order_header_id"]
            isOneToOne: false
            referencedRelation: "order_headers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packaging_schedule_order_line_item_id_fkey"
            columns: ["order_line_item_id"]
            isOneToOne: false
            referencedRelation: "order_line_items"
            referencedColumns: ["id"]
          },
        ]
      }
      po_scan_results: {
        Row: {
          applied_at: string | null
          applied_by: string | null
          confidence: number | null
          created_at: string
          created_by: string | null
          id: string
          matched: Json
          model_used: string | null
          order_id: string
          pdf_path: string
          raw_extraction: Json
          unmatched: Json
          updated_at: string
        }
        Insert: {
          applied_at?: string | null
          applied_by?: string | null
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          matched?: Json
          model_used?: string | null
          order_id: string
          pdf_path: string
          raw_extraction?: Json
          unmatched?: Json
          updated_at?: string
        }
        Update: {
          applied_at?: string | null
          applied_by?: string | null
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          matched?: Json
          model_used?: string | null
          order_id?: string
          pdf_path?: string
          raw_extraction?: Json
          unmatched?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "po_scan_results_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_headers"
            referencedColumns: ["id"]
          },
        ]
      }
      pouch_inventory: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string | null
          quantity_on_hand: number
          unit: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          quantity_on_hand?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          quantity_on_hand?: number
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      production_ingredient_usage: {
        Row: {
          actual_quantity_kg: number
          batches_used: number
          created_at: string
          created_by: string
          id: string
          lot_id: string | null
          lot_number: string | null
          raw_material_id: string
          required_quantity_kg: number
          schedule_item_id: string
          session_checksum: string | null
          supplier_name: string
          updated_at: string
          usage_date: string
        }
        Insert: {
          actual_quantity_kg?: number
          batches_used?: number
          created_at?: string
          created_by: string
          id?: string
          lot_id?: string | null
          lot_number?: string | null
          raw_material_id: string
          required_quantity_kg?: number
          schedule_item_id: string
          session_checksum?: string | null
          supplier_name: string
          updated_at?: string
          usage_date?: string
        }
        Update: {
          actual_quantity_kg?: number
          batches_used?: number
          created_at?: string
          created_by?: string
          id?: string
          lot_id?: string | null
          lot_number?: string | null
          raw_material_id?: string
          required_quantity_kg?: number
          schedule_item_id?: string
          session_checksum?: string | null
          supplier_name?: string
          updated_at?: string
          usage_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_production_ingredient_usage_schedule_item"
            columns: ["schedule_item_id"]
            isOneToOne: false
            referencedRelation: "production_schedule_items"
            referencedColumns: ["id"]
          },
        ]
      }
      production_schedule_items: {
        Row: {
          actual_gummies_produced: number | null
          actual_yield_kg: number | null
          agent_event_id: string | null
          auto_scheduled: boolean | null
          avg_wet_piece_weight_g: number | null
          batches: number
          bottle_label_override: string | null
          bottles_packed: number | null
          created_at: string
          current_stage: string | null
          display_order: number | null
          estimated_bottles: number | null
          formula_code: string | null
          formula_id: string | null
          id: string
          locked: boolean | null
          manual_customer_name: string | null
          manual_formula_name: string | null
          materials_ok: boolean
          moisture_loss_percent: number | null
          notes: string | null
          notes_log: Json | null
          number_of_towers: number | null
          order_header_id: string | null
          schedule_id: string
          selected_bottle_id: string | null
          selected_cap_id: string | null
          selected_corrugated_id: string | null
          selected_label_id: string | null
          shortages_json: Json
          total_required_kg: number
          updated_at: string
          wastage_gummies: number | null
          weighed_at: string | null
          yield_variance_percent: number | null
        }
        Insert: {
          actual_gummies_produced?: number | null
          actual_yield_kg?: number | null
          agent_event_id?: string | null
          auto_scheduled?: boolean | null
          avg_wet_piece_weight_g?: number | null
          batches: number
          bottle_label_override?: string | null
          bottles_packed?: number | null
          created_at?: string
          current_stage?: string | null
          display_order?: number | null
          estimated_bottles?: number | null
          formula_code?: string | null
          formula_id?: string | null
          id?: string
          locked?: boolean | null
          manual_customer_name?: string | null
          manual_formula_name?: string | null
          materials_ok?: boolean
          moisture_loss_percent?: number | null
          notes?: string | null
          notes_log?: Json | null
          number_of_towers?: number | null
          order_header_id?: string | null
          schedule_id: string
          selected_bottle_id?: string | null
          selected_cap_id?: string | null
          selected_corrugated_id?: string | null
          selected_label_id?: string | null
          shortages_json?: Json
          total_required_kg?: number
          updated_at?: string
          wastage_gummies?: number | null
          weighed_at?: string | null
          yield_variance_percent?: number | null
        }
        Update: {
          actual_gummies_produced?: number | null
          actual_yield_kg?: number | null
          agent_event_id?: string | null
          auto_scheduled?: boolean | null
          avg_wet_piece_weight_g?: number | null
          batches?: number
          bottle_label_override?: string | null
          bottles_packed?: number | null
          created_at?: string
          current_stage?: string | null
          display_order?: number | null
          estimated_bottles?: number | null
          formula_code?: string | null
          formula_id?: string | null
          id?: string
          locked?: boolean | null
          manual_customer_name?: string | null
          manual_formula_name?: string | null
          materials_ok?: boolean
          moisture_loss_percent?: number | null
          notes?: string | null
          notes_log?: Json | null
          number_of_towers?: number | null
          order_header_id?: string | null
          schedule_id?: string
          selected_bottle_id?: string | null
          selected_cap_id?: string | null
          selected_corrugated_id?: string | null
          selected_label_id?: string | null
          shortages_json?: Json
          total_required_kg?: number
          updated_at?: string
          wastage_gummies?: number | null
          weighed_at?: string | null
          yield_variance_percent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_production_schedule_items_bottle"
            columns: ["selected_bottle_id"]
            isOneToOne: false
            referencedRelation: "packaging_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_production_schedule_items_bottle"
            columns: ["selected_bottle_id"]
            isOneToOne: false
            referencedRelation: "v_packaging_balances"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "production_schedule_items_agent_event_id_fkey"
            columns: ["agent_event_id"]
            isOneToOne: false
            referencedRelation: "agent_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_schedule_items_formula_id_fkey"
            columns: ["formula_id"]
            isOneToOne: false
            referencedRelation: "formulas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_schedule_items_order_header_id_fkey"
            columns: ["order_header_id"]
            isOneToOne: false
            referencedRelation: "order_headers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_schedule_items_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "production_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      production_schedules: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          schedule_date: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          schedule_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          schedule_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      profile_access_audit: {
        Row: {
          access_reason: string | null
          access_type: string
          accessed_at: string | null
          id: string
          ip_address: unknown
          profile_id: string
          risk_level: string | null
          session_id: string | null
          user_agent: string | null
          viewer_id: string
        }
        Insert: {
          access_reason?: string | null
          access_type: string
          accessed_at?: string | null
          id?: string
          ip_address?: unknown
          profile_id: string
          risk_level?: string | null
          session_id?: string | null
          user_agent?: string | null
          viewer_id: string
        }
        Update: {
          access_reason?: string | null
          access_type?: string
          accessed_at?: string | null
          id?: string
          ip_address?: unknown
          profile_id?: string
          risk_level?: string | null
          session_id?: string | null
          user_agent?: string | null
          viewer_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          data_classification: string | null
          department: string | null
          display_name: string | null
          email: string | null
          email_visible_to_public: boolean
          full_name: string | null
          id: string
          job_title: string | null
          privacy_consent_date: string | null
          privacy_consent_given: boolean | null
          role: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          data_classification?: string | null
          department?: string | null
          display_name?: string | null
          email?: string | null
          email_visible_to_public?: boolean
          full_name?: string | null
          id: string
          job_title?: string | null
          privacy_consent_date?: string | null
          privacy_consent_given?: boolean | null
          role?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          data_classification?: string | null
          department?: string | null
          display_name?: string | null
          email?: string | null
          email_visible_to_public?: boolean
          full_name?: string | null
          id?: string
          job_title?: string | null
          privacy_consent_date?: string | null
          privacy_consent_given?: boolean | null
          role?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      purchase_order_items: {
        Row: {
          created_at: string
          id: string
          ingredient_id: string | null
          ingredient_name: string
          purchase_order_id: string
          quantity: number
          total_cost: number | null
          unit_cost: number | null
          uom: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          ingredient_id?: string | null
          ingredient_name: string
          purchase_order_id: string
          quantity?: number
          total_cost?: number | null
          unit_cost?: number | null
          uom?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          ingredient_id?: string | null
          ingredient_name?: string
          purchase_order_id?: string
          quantity?: number
          total_cost?: number | null
          unit_cost?: number | null
          uom?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      purchase_orders: {
        Row: {
          created_at: string
          created_by: string | null
          expected_delivery: string | null
          id: string
          ingredient_id: string | null
          ingredient_name: string | null
          invoice_total: number
          ordered_date: string
          po_number: string
          quantity: number
          received_by: string | null
          received_date: string | null
          status: string
          terms: string | null
          tracking_number: string | null
          uom: string | null
          updated_at: string
          vendor_id: string | null
          vendor_name: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expected_delivery?: string | null
          id?: string
          ingredient_id?: string | null
          ingredient_name?: string | null
          invoice_total?: number
          ordered_date: string
          po_number: string
          quantity?: number
          received_by?: string | null
          received_date?: string | null
          status?: string
          terms?: string | null
          tracking_number?: string | null
          uom?: string | null
          updated_at?: string
          vendor_id?: string | null
          vendor_name?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expected_delivery?: string | null
          id?: string
          ingredient_id?: string | null
          ingredient_name?: string | null
          invoice_total?: number
          ordered_date?: string
          po_number?: string
          quantity?: number
          received_by?: string | null
          received_date?: string | null
          status?: string
          terms?: string | null
          tracking_number?: string | null
          uom?: string | null
          updated_at?: string
          vendor_id?: string | null
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      raw_material_lots: {
        Row: {
          coa_link: string | null
          cost: number
          created_at: string
          expires_on: string | null
          id: string
          lot_number: string | null
          qty_reserved_kg: number
          quantity: number
          raw_material_id: string
          receiving_date: string | null
          updated_at: string
        }
        Insert: {
          coa_link?: string | null
          cost: number
          created_at?: string
          expires_on?: string | null
          id?: string
          lot_number?: string | null
          qty_reserved_kg?: number
          quantity: number
          raw_material_id: string
          receiving_date?: string | null
          updated_at?: string
        }
        Update: {
          coa_link?: string | null
          cost?: number
          created_at?: string
          expires_on?: string | null
          id?: string
          lot_number?: string | null
          qty_reserved_kg?: number
          quantity?: number
          raw_material_id?: string
          receiving_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_raw_material_lots_raw_material_id"
            columns: ["raw_material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_material_lots_raw_material_id_fkey"
            columns: ["raw_material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      raw_materials: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          barcode: string | null
          code: string
          code_ci: string | null
          created_at: string
          density_kg_per_l: number | null
          id: string
          idempotency_key: string | null
          is_archived: boolean
          name: string
          supplier: string | null
          uom: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          barcode?: string | null
          code: string
          code_ci?: string | null
          created_at?: string
          density_kg_per_l?: number | null
          id?: string
          idempotency_key?: string | null
          is_archived?: boolean
          name: string
          supplier?: string | null
          uom: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          barcode?: string | null
          code?: string
          code_ci?: string | null
          created_at?: string
          density_kg_per_l?: number | null
          id?: string
          idempotency_key?: string | null
          is_archived?: boolean
          name?: string
          supplier?: string | null
          uom?: string
          updated_at?: string
        }
        Relationships: []
      }
      rd_base_template_ingredients: {
        Row: {
          created_at: string
          default_percent: number
          highlight_color: string | null
          id: string
          name: string
          role: string | null
          section: string
          sort_order: number
          supplier: string | null
          template_id: string
        }
        Insert: {
          created_at?: string
          default_percent?: number
          highlight_color?: string | null
          id?: string
          name: string
          role?: string | null
          section?: string
          sort_order?: number
          supplier?: string | null
          template_id: string
        }
        Update: {
          created_at?: string
          default_percent?: number
          highlight_color?: string | null
          id?: string
          name?: string
          role?: string | null
          section?: string
          sort_order?: number
          supplier?: string | null
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rd_base_template_ingredients_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "rd_base_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      rd_base_template_steps: {
        Row: {
          created_at: string
          id: string
          step_number: number
          template_id: string
          text: string
        }
        Insert: {
          created_at?: string
          id?: string
          step_number: number
          template_id: string
          text: string
        }
        Update: {
          created_at?: string
          id?: string
          step_number?: number
          template_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "rd_base_template_steps_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "rd_base_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      rd_base_templates: {
        Row: {
          add_active_temp_c: number | null
          brix_target: number | null
          cook_temp_c: number | null
          created_at: string
          created_by: string | null
          default_batch_weight_g: number
          default_piece_weight_g: number
          id: string
          is_active: boolean
          mold_size: string | null
          name: string
          tri_sodium_citrate_temp_c: number | null
          updated_at: string
        }
        Insert: {
          add_active_temp_c?: number | null
          brix_target?: number | null
          cook_temp_c?: number | null
          created_at?: string
          created_by?: string | null
          default_batch_weight_g?: number
          default_piece_weight_g?: number
          id?: string
          is_active?: boolean
          mold_size?: string | null
          name: string
          tri_sodium_citrate_temp_c?: number | null
          updated_at?: string
        }
        Update: {
          add_active_temp_c?: number | null
          brix_target?: number | null
          cook_temp_c?: number | null
          created_at?: string
          created_by?: string | null
          default_batch_weight_g?: number
          default_piece_weight_g?: number
          id?: string
          is_active?: boolean
          mold_size?: string | null
          name?: string
          tri_sodium_citrate_temp_c?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      rd_batch_feedback: {
        Row: {
          created_at: string | null
          created_by: string | null
          feedback_source: string | null
          feedback_text: string
          id: string
          rd_batch_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          feedback_source?: string | null
          feedback_text: string
          id?: string
          rd_batch_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          feedback_source?: string | null
          feedback_text?: string
          id?: string
          rd_batch_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rd_batch_feedback_rd_batch_id_fkey"
            columns: ["rd_batch_id"]
            isOneToOne: false
            referencedRelation: "rd_project_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      rd_color_options: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      rd_flavor_options: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      rd_project_actives: {
        Row: {
          active_name: string
          created_at: string | null
          id: string
          mg_per_gummy: number
          rd_project_id: string | null
          sort_order: number | null
        }
        Insert: {
          active_name: string
          created_at?: string | null
          id?: string
          mg_per_gummy: number
          rd_project_id?: string | null
          sort_order?: number | null
        }
        Update: {
          active_name?: string
          created_at?: string | null
          id?: string
          mg_per_gummy?: number
          rd_project_id?: string | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rd_project_actives_rd_project_id_fkey"
            columns: ["rd_project_id"]
            isOneToOne: false
            referencedRelation: "rd_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      rd_project_batches: {
        Row: {
          batch_date: string
          batch_number: string
          created_at: string | null
          created_by: string | null
          id: string
          notes: string | null
          quantity_produced: string | null
          rd_project_id: string | null
          sent_to: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          batch_date?: string
          batch_number: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          quantity_produced?: string | null
          rd_project_id?: string | null
          sent_to?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          batch_date?: string
          batch_number?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          quantity_produced?: string | null
          rd_project_id?: string | null
          sent_to?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rd_project_batches_rd_project_id_fkey"
            columns: ["rd_project_id"]
            isOneToOne: false
            referencedRelation: "rd_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      rd_project_versions: {
        Row: {
          active_overage_percent: Json | null
          approved_at: string | null
          approved_by: string | null
          base_template_id: string | null
          color: string
          created_at: string | null
          created_by: string | null
          flavor: string
          gummies_count: number | null
          id: string
          mold_size: string | null
          notes: string | null
          piece_weight_g: number | null
          qa_received_at: string | null
          qa_received_by: string | null
          rd_project_id: string
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          scheduled_date: string | null
          status: string
          updated_at: string | null
          version_number: string
        }
        Insert: {
          active_overage_percent?: Json | null
          approved_at?: string | null
          approved_by?: string | null
          base_template_id?: string | null
          color: string
          created_at?: string | null
          created_by?: string | null
          flavor: string
          gummies_count?: number | null
          id?: string
          mold_size?: string | null
          notes?: string | null
          piece_weight_g?: number | null
          qa_received_at?: string | null
          qa_received_by?: string | null
          rd_project_id: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          scheduled_date?: string | null
          status?: string
          updated_at?: string | null
          version_number: string
        }
        Update: {
          active_overage_percent?: Json | null
          approved_at?: string | null
          approved_by?: string | null
          base_template_id?: string | null
          color?: string
          created_at?: string | null
          created_by?: string | null
          flavor?: string
          gummies_count?: number | null
          id?: string
          mold_size?: string | null
          notes?: string | null
          piece_weight_g?: number | null
          qa_received_at?: string | null
          qa_received_by?: string | null
          rd_project_id?: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          scheduled_date?: string | null
          status?: string
          updated_at?: string | null
          version_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "rd_project_versions_base_template_id_fkey"
            columns: ["base_template_id"]
            isOneToOne: false
            referencedRelation: "rd_base_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rd_project_versions_rd_project_id_fkey"
            columns: ["rd_project_id"]
            isOneToOne: false
            referencedRelation: "rd_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      rd_projects: {
        Row: {
          agent_description: string | null
          approved_at: string | null
          approved_by: string | null
          color: string
          converted_at: string | null
          converted_to_formula_id: string | null
          created_at: string | null
          created_by: string | null
          current_version_id: string | null
          customer_id: string | null
          customer_name: string
          flavor: string
          formula_reference_link: string | null
          gummies_count: number | null
          id: string
          manufacturing_approval_status: string | null
          manufacturing_approved_at: string | null
          manufacturing_approved_by: string | null
          mold_size: string | null
          notes: string | null
          project_name: string
          project_number: string
          qa_approval_status: string | null
          qa_approved_at: string | null
          qa_approved_by: string | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          scheduled_date: string | null
          source: string | null
          status: string
          updated_at: string | null
          version_count: number | null
        }
        Insert: {
          agent_description?: string | null
          approved_at?: string | null
          approved_by?: string | null
          color: string
          converted_at?: string | null
          converted_to_formula_id?: string | null
          created_at?: string | null
          created_by?: string | null
          current_version_id?: string | null
          customer_id?: string | null
          customer_name: string
          flavor: string
          formula_reference_link?: string | null
          gummies_count?: number | null
          id?: string
          manufacturing_approval_status?: string | null
          manufacturing_approved_at?: string | null
          manufacturing_approved_by?: string | null
          mold_size?: string | null
          notes?: string | null
          project_name: string
          project_number: string
          qa_approval_status?: string | null
          qa_approved_at?: string | null
          qa_approved_by?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          scheduled_date?: string | null
          source?: string | null
          status?: string
          updated_at?: string | null
          version_count?: number | null
        }
        Update: {
          agent_description?: string | null
          approved_at?: string | null
          approved_by?: string | null
          color?: string
          converted_at?: string | null
          converted_to_formula_id?: string | null
          created_at?: string | null
          created_by?: string | null
          current_version_id?: string | null
          customer_id?: string | null
          customer_name?: string
          flavor?: string
          formula_reference_link?: string | null
          gummies_count?: number | null
          id?: string
          manufacturing_approval_status?: string | null
          manufacturing_approved_at?: string | null
          manufacturing_approved_by?: string | null
          mold_size?: string | null
          notes?: string | null
          project_name?: string
          project_number?: string
          qa_approval_status?: string | null
          qa_approved_at?: string | null
          qa_approved_by?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          scheduled_date?: string | null
          source?: string | null
          status?: string
          updated_at?: string | null
          version_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rd_projects_converted_to_formula_id_fkey"
            columns: ["converted_to_formula_id"]
            isOneToOne: false
            referencedRelation: "formulas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rd_projects_current_version_id_fkey"
            columns: ["current_version_id"]
            isOneToOne: false
            referencedRelation: "rd_project_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rd_projects_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rd_projects_manufacturing_approved_by_fkey"
            columns: ["manufacturing_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rd_projects_qa_approved_by_fkey"
            columns: ["qa_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rd_received_samples: {
        Row: {
          color: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          customer_name: string | null
          flavor: string | null
          id: string
          lot_number: string | null
          made_on_date: string | null
          mold_size: string | null
          on_hand: boolean
          product_name: string | null
          quantity_on_hand: number | null
          rd_project_id: string
          rd_version_id: string | null
          received_at: string | null
          received_by: string | null
          received_by_name: string | null
          received_date: string | null
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string | null
          flavor?: string | null
          id?: string
          lot_number?: string | null
          made_on_date?: string | null
          mold_size?: string | null
          on_hand?: boolean
          product_name?: string | null
          quantity_on_hand?: number | null
          rd_project_id: string
          rd_version_id?: string | null
          received_at?: string | null
          received_by?: string | null
          received_by_name?: string | null
          received_date?: string | null
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string | null
          flavor?: string | null
          id?: string
          lot_number?: string | null
          made_on_date?: string | null
          mold_size?: string | null
          on_hand?: boolean
          product_name?: string | null
          quantity_on_hand?: number | null
          rd_project_id?: string
          rd_version_id?: string | null
          received_at?: string | null
          received_by?: string | null
          received_by_name?: string | null
          received_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rd_received_samples_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rd_received_samples_rd_project_id_fkey"
            columns: ["rd_project_id"]
            isOneToOne: false
            referencedRelation: "rd_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rd_received_samples_rd_version_id_fkey"
            columns: ["rd_version_id"]
            isOneToOne: false
            referencedRelation: "rd_project_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      rd_version_actives: {
        Row: {
          active_name: string
          created_at: string | null
          id: string
          mg_per_gummy: number
          sort_order: number
          version_id: string
        }
        Insert: {
          active_name: string
          created_at?: string | null
          id?: string
          mg_per_gummy: number
          sort_order?: number
          version_id: string
        }
        Update: {
          active_name?: string
          created_at?: string | null
          id?: string
          mg_per_gummy?: number
          sort_order?: number
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rd_version_actives_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "rd_project_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      rd_version_inactives: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
          version_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          version_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rd_version_inactives_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "rd_project_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      report_subscriptions: {
        Row: {
          created_at: string | null
          frequency: string
          id: string
          is_active: boolean | null
          report_type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          frequency: string
          id?: string
          is_active?: boolean | null
          report_type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          frequency?: string
          id?: string
          is_active?: boolean | null
          report_type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      safety_stock_recommendations: {
        Row: {
          avg_daily_usage_kg: number | null
          based_on_months_data: number
          confidence_score: number | null
          generated_at: string | null
          id: string
          max_daily_usage_kg: number | null
          raw_material_id: string | null
          recommended_min_kg: number
          recommended_reorder_kg: number
          usage_variability: number | null
        }
        Insert: {
          avg_daily_usage_kg?: number | null
          based_on_months_data: number
          confidence_score?: number | null
          generated_at?: string | null
          id?: string
          max_daily_usage_kg?: number | null
          raw_material_id?: string | null
          recommended_min_kg: number
          recommended_reorder_kg: number
          usage_variability?: number | null
        }
        Update: {
          avg_daily_usage_kg?: number | null
          based_on_months_data?: number
          confidence_score?: number | null
          generated_at?: string | null
          id?: string
          max_daily_usage_kg?: number | null
          raw_material_id?: string | null
          recommended_min_kg?: number
          recommended_reorder_kg?: number
          usage_variability?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "safety_stock_recommendations_raw_material_id_fkey"
            columns: ["raw_material_id"]
            isOneToOne: true
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_change_history: {
        Row: {
          affected_dates: string[]
          affected_item_ids: string[]
          change_type: string
          changed_by: string | null
          created_at: string | null
          description: string
          id: string
          reverted: boolean | null
          reverted_at: string | null
          reverted_by: string | null
          snapshot_after: Json
          snapshot_before: Json
        }
        Insert: {
          affected_dates: string[]
          affected_item_ids: string[]
          change_type: string
          changed_by?: string | null
          created_at?: string | null
          description: string
          id?: string
          reverted?: boolean | null
          reverted_at?: string | null
          reverted_by?: string | null
          snapshot_after: Json
          snapshot_before: Json
        }
        Update: {
          affected_dates?: string[]
          affected_item_ids?: string[]
          change_type?: string
          changed_by?: string | null
          created_at?: string | null
          description?: string
          id?: string
          reverted?: boolean | null
          reverted_at?: string | null
          reverted_by?: string | null
          snapshot_after?: Json
          snapshot_before?: Json
        }
        Relationships: [
          {
            foreignKeyName: "schedule_change_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_change_history_reverted_by_fkey"
            columns: ["reverted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_employees: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          default_team: string | null
          full_name: string
          id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          default_team?: string | null
          full_name: string
          id?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          default_team?: string | null
          full_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      security_alerts: {
        Row: {
          acknowledged: boolean | null
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_type: string
          created_at: string | null
          details: Json
          id: string
          severity: string
        }
        Insert: {
          acknowledged?: boolean | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type: string
          created_at?: string | null
          details?: Json
          id?: string
          severity: string
        }
        Update: {
          acknowledged?: boolean | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type?: string
          created_at?: string | null
          details?: Json
          id?: string
          severity?: string
        }
        Relationships: []
      }
      security_config: {
        Row: {
          config_key: string
          config_value: Json
          created_at: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          config_key: string
          config_value: Json
          created_at?: string | null
          id?: string
          updated_at?: string | null
        }
        Update: {
          config_key?: string
          config_value?: Json
          created_at?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      sensitive_data_access_log: {
        Row: {
          access_type: string
          accessed_at: string | null
          fields_accessed: string[] | null
          id: string
          ip_address: unknown
          record_id: string | null
          record_identifier: string | null
          table_accessed: string
          user_agent: string | null
          user_email: string | null
          user_id: string
        }
        Insert: {
          access_type: string
          accessed_at?: string | null
          fields_accessed?: string[] | null
          id?: string
          ip_address?: unknown
          record_id?: string | null
          record_identifier?: string | null
          table_accessed: string
          user_agent?: string | null
          user_email?: string | null
          user_id: string
        }
        Update: {
          access_type?: string
          accessed_at?: string | null
          fields_accessed?: string[] | null
          id?: string
          ip_address?: unknown
          record_id?: string | null
          record_identifier?: string | null
          table_accessed?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string
        }
        Relationships: []
      }
      shipping_entries: {
        Row: {
          bottle_count: number | null
          bottle_size: string | null
          completed_date: string | null
          created_at: string
          customer_id: string | null
          customer_name: string | null
          id: string
          invoice_id: string | null
          invoiced_at: string | null
          invoiced_by: string | null
          lot_number: string | null
          notes: string | null
          order_header_id: string | null
          order_line_item_id: string | null
          packaging_completion_id: string | null
          product_name: string | null
          ready_to_ship_at: string | null
          ready_to_ship_by: string | null
          schedule_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          bottle_count?: number | null
          bottle_size?: string | null
          completed_date?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          id?: string
          invoice_id?: string | null
          invoiced_at?: string | null
          invoiced_by?: string | null
          lot_number?: string | null
          notes?: string | null
          order_header_id?: string | null
          order_line_item_id?: string | null
          packaging_completion_id?: string | null
          product_name?: string | null
          ready_to_ship_at?: string | null
          ready_to_ship_by?: string | null
          schedule_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          bottle_count?: number | null
          bottle_size?: string | null
          completed_date?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          id?: string
          invoice_id?: string | null
          invoiced_at?: string | null
          invoiced_by?: string | null
          lot_number?: string | null
          notes?: string | null
          order_header_id?: string | null
          order_line_item_id?: string | null
          packaging_completion_id?: string | null
          product_name?: string | null
          ready_to_ship_at?: string | null
          ready_to_ship_by?: string | null
          schedule_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_entries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_entries_invoice_fk"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "customer_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_entries_order_header_id_fkey"
            columns: ["order_header_id"]
            isOneToOne: false
            referencedRelation: "order_headers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_entries_order_line_item_id_fkey"
            columns: ["order_line_item_id"]
            isOneToOne: false
            referencedRelation: "order_line_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_entries_packaging_completion_id_fkey"
            columns: ["packaging_completion_id"]
            isOneToOne: true
            referencedRelation: "packaging_completion_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_entries_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "packaging_schedule"
            referencedColumns: ["id"]
          },
        ]
      }
      supplement_facts_generations: {
        Row: {
          created_at: string
          customer_name: string | null
          docx_storage_path: string | null
          generated_by: string
          id: string
          panel_json: Json
          product_name: string
          rd_project_id: string | null
          rd_version_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_name?: string | null
          docx_storage_path?: string | null
          generated_by: string
          id?: string
          panel_json: Json
          product_name: string
          rd_project_id?: string | null
          rd_version_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_name?: string | null
          docx_storage_path?: string | null
          generated_by?: string
          id?: string
          panel_json?: Json
          product_name?: string
          rd_project_id?: string | null
          rd_version_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplement_facts_generations_rd_project_id_fkey"
            columns: ["rd_project_id"]
            isOneToOne: false
            referencedRelation: "rd_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplement_facts_generations_rd_version_id_fkey"
            columns: ["rd_version_id"]
            isOneToOne: false
            referencedRelation: "rd_project_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_access_audit: {
        Row: {
          access_reason: string | null
          access_type: string
          accessed_at: string | null
          accessed_by: string
          id: string
          ip_address: unknown
          risk_level: string | null
          session_id: string | null
          supplier_id: string | null
          user_agent: string | null
        }
        Insert: {
          access_reason?: string | null
          access_type: string
          accessed_at?: string | null
          accessed_by: string
          id?: string
          ip_address?: unknown
          risk_level?: string | null
          session_id?: string | null
          supplier_id?: string | null
          user_agent?: string | null
        }
        Update: {
          access_reason?: string | null
          access_type?: string
          accessed_at?: string | null
          accessed_by?: string
          id?: string
          ip_address?: unknown
          risk_level?: string | null
          session_id?: string | null
          supplier_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          address: string | null
          contact_info: string | null
          created_at: string
          emails: Json | null
          id: string
          name: string
          notes: string | null
          phone_numbers: Json | null
          updated_at: string
          vetting_link: string | null
        }
        Insert: {
          address?: string | null
          contact_info?: string | null
          created_at?: string
          emails?: Json | null
          id?: string
          name: string
          notes?: string | null
          phone_numbers?: Json | null
          updated_at?: string
          vetting_link?: string | null
        }
        Update: {
          address?: string | null
          contact_info?: string | null
          created_at?: string
          emails?: Json | null
          id?: string
          name?: string
          notes?: string | null
          phone_numbers?: Json | null
          updated_at?: string
          vetting_link?: string | null
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assignee_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_at: string | null
          id: string
          metadata: Json | null
          priority: Database["public"]["Enums"]["task_priority"]
          related_entity_id: string | null
          related_entity_type: string | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          metadata?: Json | null
          priority?: Database["public"]["Enums"]["task_priority"]
          related_entity_id?: string | null
          related_entity_type?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          metadata?: Json | null
          priority?: Database["public"]["Enums"]["task_priority"]
          related_entity_id?: string | null
          related_entity_type?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      trade_secret_access_sessions: {
        Row: {
          expires_at: string
          formula_id: string
          id: string
          ip_address: unknown
          is_active: boolean | null
          session_token: string
          started_at: string | null
          terminated_at: string | null
          terminated_reason: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          expires_at: string
          formula_id: string
          id?: string
          ip_address?: unknown
          is_active?: boolean | null
          session_token: string
          started_at?: string | null
          terminated_at?: string | null
          terminated_reason?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          expires_at?: string
          formula_id?: string
          id?: string
          ip_address?: unknown
          is_active?: boolean | null
          session_token?: string
          started_at?: string | null
          terminated_at?: string | null
          terminated_reason?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      trade_secret_access_sessions_enhanced: {
        Row: {
          access_level: string
          approval_required: boolean | null
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          expires_at: string
          formula_id: string
          id: string
          ip_address: unknown
          is_active: boolean | null
          justification: string
          session_token: string
          started_at: string | null
          terminated_at: string | null
          terminated_reason: string | null
          updated_at: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          access_level?: string
          approval_required?: boolean | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          expires_at: string
          formula_id: string
          id?: string
          ip_address?: unknown
          is_active?: boolean | null
          justification: string
          session_token: string
          started_at?: string | null
          terminated_at?: string | null
          terminated_reason?: string | null
          updated_at?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          access_level?: string
          approval_required?: boolean | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          expires_at?: string
          formula_id?: string
          id?: string
          ip_address?: unknown
          is_active?: boolean | null
          justification?: string
          session_token?: string
          started_at?: string | null
          terminated_at?: string | null
          terminated_reason?: string | null
          updated_at?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_activity_audit: {
        Row: {
          activity_type: string
          created_at: string | null
          details: Json | null
          id: string
          ip_address: unknown
          new_values: Json | null
          old_values: Json | null
          operation: string
          record_id: string | null
          risk_level: string | null
          session_id: string | null
          table_name: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          activity_type: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          operation: string
          record_id?: string | null
          risk_level?: string | null
          session_id?: string | null
          table_name: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          activity_type?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          operation?: string
          record_id?: string | null
          risk_level?: string | null
          session_id?: string | null
          table_name?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          granted_at: string | null
          granted_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_signatures: {
        Row: {
          approver_name: string | null
          created_at: string
          signature_path: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approver_name?: string | null
          created_at?: string
          signature_path: string
          updated_at?: string
          user_id: string
        }
        Update: {
          approver_name?: string | null
          created_at?: string
          signature_path?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_table_views: {
        Row: {
          config: Json
          created_at: string
          id: string
          is_default: boolean
          name: string
          page_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          page_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          page_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_material_usage_trends: {
        Row: {
          avg_per_batch: number | null
          batch_count: number | null
          material_code: string | null
          material_name: string | null
          raw_material_id: string | null
          total_used_kg: number | null
          usage_month: string | null
        }
        Relationships: []
      }
      v_packaging_balances: {
        Row: {
          bottles_per_unit: number | null
          category: string | null
          created_at: string | null
          description: string | null
          item_id: string | null
          item_name: string | null
          location: string | null
          min_level: number | null
          notes: string | null
          on_hand: number | null
          packable_bottles: number | null
          sku: string | null
          uom: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      v_packaging_history: {
        Row: {
          category: string | null
          created_at: string | null
          id: string | null
          item_id: string | null
          item_name: string | null
          location: string | null
          move_date: string | null
          move_type: string | null
          notes: string | null
          po: string | null
          qty: number | null
          vendor: string | null
        }
        Relationships: [
          {
            foreignKeyName: "packaging_movement_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "packaging_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packaging_movement_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_packaging_balances"
            referencedColumns: ["item_id"]
          },
        ]
      }
    }
    Functions: {
      accept_customer_invitation: { Args: { _token: string }; Returns: Json }
      approve_trade_secret_access: {
        Args: {
          _access_type: string
          _formula_id: string
          _justification: string
          _user_id: string
        }
        Returns: Json
      }
      assign_initial_admin: { Args: never; Returns: undefined }
      assign_user_role: {
        Args: {
          target_role: Database["public"]["Enums"]["app_role"]
          target_user_id: string
        }
        Returns: Json
      }
      audit_profile_access: {
        Args: {
          access_reason?: string
          access_type: string
          profile_id: string
          viewer_id: string
        }
        Returns: undefined
      }
      audit_supplier_access: {
        Args: { access_type?: string; supplier_id: string }
        Returns: undefined
      }
      audit_trade_secret_access: {
        Args: never
        Returns: {
          access_date: string
          access_type: string
          formula_code: string
          risk_assessment: string
          user_email: string
        }[]
      }
      auto_populate_production_ingredients: {
        Args: {
          p_batches: number
          p_formula_id: string
          p_schedule_item_id: string
        }
        Returns: Json
      }
      auto_populate_production_ingredients_safe: {
        Args: {
          p_batches: number
          p_force_overwrite?: boolean
          p_formula_id: string
          p_idempotency_key?: string
          p_schedule_item_id: string
        }
        Returns: Json
      }
      calculate_batches_needed: {
        Args: {
          p_bottle_size: number
          p_bottles_ordered: number
          p_formula_id: string
        }
        Returns: Json
      }
      calculate_max_batches: { Args: { p_formula_id: string }; Returns: Json }
      calculate_max_batches_debug: {
        Args: { p_formula_id: string }
        Returns: Json
      }
      can_access_employee_data_business_hours: {
        Args: { _user_id: string }
        Returns: boolean
      }
      can_access_financial_data: {
        Args: { _user_id: string }
        Returns: boolean
      }
      can_access_formulas: { Args: { _user_id: string }; Returns: boolean }
      can_access_profile_business_hours: {
        Args: { _profile_id: string; _viewer_id: string }
        Returns: boolean
      }
      can_access_profile_secure: {
        Args: { _access_type?: string; _profile_id: string; _viewer_id: string }
        Returns: boolean
      }
      can_access_specific_formula: {
        Args: { _formula_id: string; _user_id: string }
        Returns: boolean
      }
      can_access_trade_secret_formula: {
        Args: { _access_type?: string; _formula_id: string; _user_id: string }
        Returns: boolean
      }
      can_access_trade_secret_formula_secure: {
        Args: { _access_type?: string; _formula_id: string; _user_id: string }
        Returns: boolean
      }
      check_packaging_availability: {
        Args: {
          p_batches_needed: number
          p_bottle_size: number
          p_formula_id: string
          p_selected_bottle_id?: string
          p_selected_cap_id?: string
          p_selected_label_id?: string
        }
        Returns: Json
      }
      check_supplier_security_alerts: {
        Args: never
        Returns: {
          alert_count: number
          alert_type: string
          latest_attempt: string
          user_id: string
        }[]
      }
      claim_customer_signup: { Args: { _short_code: string }; Returns: Json }
      cleanup_expired_trade_secret_sessions: { Args: never; Returns: undefined }
      cleanup_expired_trade_secret_sessions_enhanced: {
        Args: never
        Returns: undefined
      }
      complete_schedule: {
        Args: { p_schedule_id: string; p_user_id: string }
        Returns: Json
      }
      convert_rd_to_production: {
        Args: { p_rd_project_id: string }
        Returns: string
      }
      create_raw_material_with_lots: {
        Args: {
          p_code: string
          p_lots?: Json
          p_name: string
          p_supplier?: string
          p_unit_of_measure?: string
        }
        Returns: Json
      }
      create_raw_material_with_lots_v2: {
        Args: {
          p_code: string
          p_idempotency_key?: string
          p_lots?: Json
          p_name: string
          p_supplier?: string
          p_unit_of_measure?: string
        }
        Returns: Json
      }
      create_sensitive_data_alert: {
        Args: { _alert_details: Json }
        Returns: undefined
      }
      decide_po_approval: {
        Args: {
          _decision: string
          _line_formulas?: Json
          _order_id: string
          _rejection_reason?: string
        }
        Returns: undefined
      }
      decrypt_sensitive_field: {
        Args: { encrypted_value: string }
        Returns: string
      }
      deduct_inventory_for_batch: {
        Args: {
          p_batch_count: number
          p_formula_code: string
          p_formula_name: string
          p_schedule_item_id: string
          p_total_produced_qty: number
        }
        Returns: Json
      }
      delete_formula_secure: { Args: { p_formula_id: string }; Returns: Json }
      detect_suspicious_supplier_access: { Args: never; Returns: undefined }
      emergency_assign_admin: { Args: never; Returns: undefined }
      emergency_financial_lockdown: { Args: never; Returns: Json }
      emergency_formula_lockdown: { Args: never; Returns: undefined }
      emergency_lockdown_profiles: { Args: never; Returns: boolean }
      emergency_lockdown_trade_secrets: {
        Args: { _reason: string }
        Returns: boolean
      }
      emergency_terminate_trade_secret_sessions: {
        Args: never
        Returns: undefined
      }
      enable_formula_emergency_lockdown: { Args: never; Returns: undefined }
      encrypt_sensitive_field: {
        Args: { field_value: string }
        Returns: string
      }
      find_raw_material_by_barcode: {
        Args: { _code: string }
        Returns: {
          code: string
          name: string
          open_po_id: string
          open_po_number: string
          open_po_quantity: number
          open_po_uom: string
          raw_material_id: string
          supplier: string
          uom: string
        }[]
      }
      find_raw_material_by_name: {
        Args: { p_recipe_material_name: string }
        Returns: string
      }
      fn_check_materials: {
        Args: {
          p_batches: number
          p_exclude_schedule_item_id?: string
          p_formula_id: string
          p_schedule_date: string
        }
        Returns: Json
      }
      fn_create_schedule_item:
        | {
            Args: {
              p_batches?: number
              p_formula_id?: string
              p_manual_customer_name?: string
              p_manual_formula_name?: string
              p_schedule_date: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_batches: number
              p_formula_id: string
              p_schedule_date: string
            }
            Returns: Json
          }
      fn_formula_requirements: {
        Args: { p_batches: number; p_formula_id: string }
        Returns: {
          ingredient_id: string
          ingredient_name: string
          required_kg: number
        }[]
      }
      fn_move_item_and_recheck: {
        Args: { p_new_date: string; p_schedule_item_id: string }
        Returns: Json
      }
      fn_reserve_materials: {
        Args: { p_schedule_item_id: string }
        Returns: Json
      }
      fn_upsert_schedule: { Args: { p_schedule_date: string }; Returns: string }
      gen_customer_signup_code: { Args: never; Returns: string }
      gen_invite_short_code: { Args: never; Returns: string }
      generate_inquiry_number: { Args: never; Returns: string }
      generate_order_number: { Args: never; Returns: string }
      get_accessible_formulas:
        | {
            Args: never
            Returns: {
              access_count: number
              active_ingredients_json: Json
              average_piece_weight: number
              classification_level: string
              code: string
              created_at: string
              customer_id: string
              default_batch_size_kg: number
              formula_code: string
              id: string
              is_deleted: boolean
              last_accessed_at: string
              name: string
              notes: string
              procedure_text: string
              product_code_line: string
              recipe_json: Json
              requires_approval: boolean
              security_level: string
              status: string
              total_pieces: number
              updated_at: string
              version: string
              yield_uom: string
            }[]
          }
        | {
            Args: { _user_id: string }
            Returns: {
              access_count: number
              active_ingredients_json: Json
              average_piece_weight: number
              classification_level: string
              code: string
              created_at: string
              customer_id: string
              default_batch_size_kg: number
              formula_code: string
              id: string
              is_deleted: boolean
              last_accessed_at: string
              name: string
              notes: string
              procedure_text: string
              product_code_line: string
              recipe_json: Json
              requires_approval: boolean
              security_level: string
              status: string
              total_pieces: number
              updated_at: string
              version: string
              yield_uom: string
            }[]
          }
      get_accessible_suppliers: {
        Args: { _user_id: string }
        Returns: {
          address: string
          contact_info: string
          created_at: string
          emails: Json
          id: string
          name: string
          notes: string
          phone_numbers: Json
          updated_at: string
          vetting_link: string
        }[]
      }
      get_all_user_activity: {
        Args: never
        Returns: {
          activity_type: string
          created_at: string
          details: Json
          id: string
          ip_address: string
          operation: string
          record_id: string
          risk_level: string
          table_name: string
          user_display_name: string
          user_email: string
          user_id: string
        }[]
      }
      get_all_users_admin: {
        Args: never
        Returns: {
          created_at: string
          department: string
          display_name: string
          email: string
          id: string
          job_title: string
          last_sign_in_at: string
          roles: string[]
        }[]
      }
      get_authorized_profile_data: {
        Args: { target_user_id?: string }
        Returns: {
          created_at: string
          display_name_safe: string
          email_safe: string
          id: string
          job_category: string
        }[]
      }
      get_current_user_profile: {
        Args: never
        Returns: {
          created_at: string
          display_name: string
          email_safe: string
          email_visible_to_public: boolean
          id: string
          job_title_safe: string
          privacy_consent_given: boolean
        }[]
      }
      get_current_user_roles: {
        Args: never
        Returns: {
          granted_at: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }[]
      }
      get_customer_by_signup_code: {
        Args: { _short_code: string }
        Returns: Json
      }
      get_employee_basic_info: {
        Args: { _employee_id?: string }
        Returns: {
          data_classification: string
          department: string
          employee_id: string
          hire_date: string
          id: string
          security_clearance: string
        }[]
      }
      get_employee_critical_data: {
        Args: { _employee_id?: string }
        Returns: {
          created_at: string
          employee_id: string
          home_address: string
          id: string
          salary_band: string
          social_security_partial: string
          updated_at: string
        }[]
      }
      get_employee_sensitive_data_secure: {
        Args: { _employee_id?: string }
        Returns: {
          created_at: string
          data_classification: string
          department: string
          email: string
          emergency_contact_name: string
          emergency_contact_phone: string
          employee_id: string
          full_name: string
          hire_date: string
          home_address: string
          id: string
          job_title: string
          manager_id: string
          phone_number: string
          salary_band: string
          security_clearance: string
          social_security_partial: string
          updated_at: string
        }[]
      }
      get_financial_security_status: { Args: never; Returns: Json }
      get_formula_ingredients_with_lots: {
        Args: { p_batches: number; p_formula_id: string }
        Returns: {
          available_lots: Json
          ingredient_code: string
          ingredient_id: string
          ingredient_name: string
          required_quantity_kg: number
        }[]
      }
      get_formula_security_recommendations: { Args: never; Returns: Json }
      get_formula_security_status: { Args: never; Returns: Json }
      get_inventory_lots: {
        Args: never
        Returns: {
          created_at: string
          id: string
          ingredient_id: string
          ingredient_name: string
          qty_on_hand_kg: number
          qty_reserved_kg: number
        }[]
      }
      get_inventory_status_with_thresholds: {
        Args: never
        Returns: {
          alert_enabled: boolean
          current_quantity_kg: number
          material_code: string
          material_name: string
          min_quantity_kg: number
          percentage_of_minimum: number
          raw_material_id: string
          reorder_quantity_kg: number
          status: string
          supplier: string
        }[]
      }
      get_material_alternatives: {
        Args: { p_material_id: string }
        Returns: {
          alternative_id: string
          available_qty: number
          lot_count: number
          lots: Json
          material_code: string
          material_name: string
          supplier: string
          uom: string
        }[]
      }
      get_material_requirements_by_date_range: {
        Args: { p_end_date: string; p_start_date: string }
        Returns: {
          available_kg: number
          current_inventory_kg: number
          formulas_using: Json
          material_code: string
          material_name: string
          net_after_orders_kg: number
          net_shortage_kg: number
          on_order_kg: number
          pending_po_details: Json
          pending_po_numbers: string[]
          raw_material_id: string
          reserved_kg: number
          schedule_dates: string[]
          supplier: string
          total_required_kg: number
          uom: string
        }[]
      }
      get_my_customer_id: { Args: never; Returns: string }
      get_production_capacity: {
        Args: { p_end_date: string; p_start_date: string }
        Returns: {
          available_capacity: number
          schedule_date: string
          schedule_items: Json
          total_batches: number
        }[]
      }
      get_profiles_hr_access: {
        Args: { _profile_id?: string }
        Returns: {
          created_at: string
          data_classification: string
          department: string
          display_name: string
          email: string
          full_name: string
          id: string
          job_title: string
          phone_number: string
          updated_at: string
        }[]
      }
      get_public_profile: { Args: { _profile_id: string }; Returns: Json }
      get_purchase_order_stats_secure: { Args: never; Returns: Json }
      get_purchase_order_stats_with_items_secure: { Args: never; Returns: Json }
      get_purchase_order_with_items: {
        Args: { p_order_id: string }
        Returns: Json
      }
      get_purchase_orders_with_business_hours_access: {
        Args: never
        Returns: {
          actual_delivery_date: string
          created_at: string
          created_by: string
          expected_delivery: string
          id: string
          invoice_total: number
          order_date: string
          payment_terms: string
          po_number: string
          received_at: string
          received_by: string
          status: string
          tracking_number: string
          updated_at: string
          vendor_id: string
          vendor_name: string
        }[]
      }
      get_purchase_orders_with_financial_access: {
        Args: never
        Returns: {
          can_view_financial_data: boolean
          created_at: string
          created_by: string
          expected_delivery: string
          id: string
          ingredient_id: string
          ingredient_name: string
          invoice_total: number
          ordered_date: string
          po_number: string
          quantity: number
          received_by: string
          received_date: string
          status: string
          terms: string
          tracking_number: string
          uom: string
          updated_at: string
          vendor_id: string
          vendor_name: string
        }[]
      }
      get_purchase_orders_with_items_and_financial_access: {
        Args: never
        Returns: {
          can_view_financial_data: boolean
          created_at: string
          created_by: string
          expected_delivery: string
          id: string
          invoice_total: number
          items: Json
          ordered_date: string
          po_number: string
          received_by: string
          received_date: string
          status: string
          terms: string
          tracking_number: string
          updated_at: string
          vendor_id: string
          vendor_name: string
        }[]
      }
      get_raw_material_usage_stats: {
        Args: never
        Returns: {
          code: string
          first_used_date: string
          last_used_date: string
          name: string
          raw_material_id: string
          supplier: string
          total_quantity_used: number
          usage_count: number
        }[]
      }
      get_safe_profile_data: {
        Args: { target_user_id?: string }
        Returns: {
          display_name_safe: string
          id: string
          is_active: boolean
          job_category: string
        }[]
      }
      get_sanitized_profile_data: {
        Args: { _profile_id: string }
        Returns: Json
      }
      get_security_overview: { Args: never; Returns: Json }
      get_security_summary: { Args: never; Returns: Json }
      get_suppliers_masked_for_role: {
        Args: { _user_id: string }
        Returns: {
          address: string
          contact_info: string
          created_at: string
          emails: Json
          has_contact_access: boolean
          id: string
          name: string
          notes: string
          phone_numbers: Json
          updated_at: string
          vetting_link: string
        }[]
      }
      get_team_member_basic_info: {
        Args: { _manager_id?: string }
        Returns: {
          department: string
          display_name: string
          email: string
          id: string
          job_title: string
        }[]
      }
      get_team_member_info: {
        Args: { _manager_id: string }
        Returns: {
          department: string
          display_name: string
          job_title: string
          user_id: string
        }[]
      }
      get_unmatched_recipe_materials: {
        Args: { p_end_date: string; p_start_date: string }
        Returns: {
          formula_code: string
          formula_name: string
          recipe_material_name: string
          suggested_matches: Json
        }[]
      }
      get_upcoming_material_shortages: {
        Args: { p_days_ahead?: number }
        Returns: Json
      }
      get_user_basic_info: {
        Args: { target_user_id?: string }
        Returns: {
          has_public_visibility: boolean
          id: string
          is_current_user: boolean
        }[]
      }
      get_user_by_email_admin: {
        Args: { _email: string }
        Returns: {
          created_at: string
          display_name: string
          email: string
          roles: string[]
          user_id: string
        }[]
      }
      get_user_display_info: {
        Args: { _user_ids: string[] }
        Returns: {
          department: string
          display_name: string
          job_title: string
          user_id: string
        }[]
      }
      get_user_profiles_admin: {
        Args: never
        Returns: {
          created_at: string
          department: string
          display_name: string
          email: string
          email_visible_to_public: boolean
          id: string
          job_title: string
          privacy_consent_given: boolean
        }[]
      }
      get_user_roles_admin: {
        Args: { target_user_id?: string }
        Returns: {
          granted_at: string
          granted_by: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }[]
      }
      grant_formula_access: {
        Args: {
          _access_type: string
          _expires_at?: string
          _formula_id: string
          _justification: string
          _user_id: string
        }
        Returns: boolean
      }
      grant_formula_permission_secure: {
        Args: {
          _expires_at?: string
          _formula_id: string
          _justification: string
          _permission_type: string
          _user_id: string
        }
        Returns: Json
      }
      has_business_hours_access: {
        Args: { _user_id: string }
        Returns: boolean
      }
      has_financial_access: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_business_hours: { Args: never; Returns: boolean }
      is_emergency_lockdown_active: { Args: never; Returns: boolean }
      launch_weekly_status_reminder: { Args: never; Returns: undefined }
      log_employee_data_access: {
        Args: {
          _access_type: string
          _accessed_by: string
          _details?: Json
          _employee_id: string
        }
        Returns: undefined
      }
      log_formula_access: {
        Args: {
          _access_type: string
          _details?: Json
          _formula_id: string
          _user_id: string
        }
        Returns: undefined
      }
      log_formula_access_enhanced: {
        Args: {
          _access_type: string
          _details?: Json
          _formula_id: string
          _user_id: string
        }
        Returns: undefined
      }
      log_profile_access: {
        Args: {
          access_reason?: string
          access_type: string
          profile_id: string
          viewer_id: string
        }
        Returns: undefined
      }
      log_profile_access_enhanced: {
        Args: {
          access_reason?: string
          access_type: string
          data_accessed?: string
          profile_id: string
          viewer_id: string
        }
        Returns: undefined
      }
      log_sensitive_data_access: {
        Args: {
          p_access_type?: string
          p_fields_accessed?: string[]
          p_record_id?: string
          p_record_identifier?: string
          p_table_name: string
        }
        Returns: undefined
      }
      log_supplier_access: {
        Args: {
          _access_type: string
          _details?: Json
          _supplier_id: string
          _user_id: string
        }
        Returns: undefined
      }
      next_invoice_number: { Args: never; Returns: string }
      request_formula_access: {
        Args: {
          _access_type: string
          _formula_id: string
          _justification: string
        }
        Returns: Json
      }
      request_trade_secret_access: {
        Args: {
          _access_level?: string
          _formula_id: string
          _justification: string
        }
        Returns: Json
      }
      restore_normal_profile_access: { Args: never; Returns: boolean }
      save_formula: {
        Args: { p_formula_data: Json; p_formula_id?: string }
        Returns: Json
      }
      save_formula_rpc: { Args: { formula_data: Json }; Returns: Json }
      save_production_ingredient_usage: {
        Args: { p_schedule_item_id: string; p_usage_data: Json }
        Returns: Json
      }
      schedule_production_for_order:
        | {
            Args: {
              p_daily_batch_allocation: Json
              p_order_id: string
              p_start_date: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_daily_batch_allocation: Json
              p_order_id: string
              p_reserve_materials?: boolean
              p_start_date: string
            }
            Returns: Json
          }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      start_trade_secret_session: {
        Args: { _formula_id: string }
        Returns: Json
      }
      submit_po_for_approval: {
        Args: { _order_id: string }
        Returns: undefined
      }
      sync_suppliers_from_inventory: { Args: never; Returns: Json }
      undo_inventory_deduction: {
        Args: { p_completed_batch_id: string }
        Returns: Json
      }
      update_employee_critical_data: {
        Args: {
          _access_reason?: string
          _critical_data: Json
          _employee_id: string
        }
        Returns: Json
      }
      update_employee_data_hr_only: {
        Args: { _employee_data: Json; _employee_id: string }
        Returns: Json
      }
      update_employee_data_with_approval: {
        Args: { _employee_data: Json; _employee_id: string }
        Returns: Json
      }
      update_privacy_consent: {
        Args: { _consent_given: boolean }
        Returns: boolean
      }
      update_profile_privacy: {
        Args: { consent_given?: boolean; visibility_public: boolean }
        Returns: Json
      }
      update_supplier_secure: {
        Args: { _supplier_data: Json; _supplier_id: string; _user_id: string }
        Returns: Json
      }
      update_user_role: {
        Args: {
          _grant?: boolean
          _role: Database["public"]["Enums"]["app_role"]
          _user_email: string
        }
        Returns: Json
      }
      upsert_raw_material_with_lots: {
        Args: { p_material: Json }
        Returns: Json
      }
      validate_formula_access_attempt: {
        Args: { _access_type?: string; _formula_id: string; _user_id: string }
        Returns: boolean
      }
      validate_formula_access_secure: {
        Args: { _access_type: string; _formula_id: string; _user_id: string }
        Returns: boolean
      }
      validate_formula_access_strict: {
        Args: { _access_type?: string; _formula_id: string; _user_id: string }
        Returns: boolean
      }
      validate_formula_security_implementation: { Args: never; Returns: Json }
      validate_profile_access_with_ip: {
        Args: { _profile_id: string }
        Returns: boolean
      }
      validate_trade_secret_access_enhanced: {
        Args: { _formula_id: string; _user_id: string }
        Returns: boolean
      }
      validate_trade_secret_access_secure_v2: {
        Args: { _formula_id: string; _user_id: string }
        Returns: boolean
      }
      validate_trade_secret_access_strict: {
        Args: { _formula_id: string; _user_id: string }
        Returns: boolean
      }
      validate_usage_stats_access: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role:
        | "admin"
        | "rd_manager"
        | "production_manager"
        | "quality_manager"
        | "user"
        | "hr_manager"
        | "customer"
      launch_phase:
        | "Formulation"
        | "Manufacturing"
        | "Regulatory"
        | "Packaging"
        | "Marketing"
        | "Distribution"
      launch_priority: "low" | "medium" | "high"
      launch_project_status:
        | "planning"
        | "active"
        | "on_hold"
        | "completed"
        | "cancelled"
      launch_status: "todo" | "in_progress" | "blocked" | "done" | "review"
      schedule_building: "17_west" | "282_ridgedale"
      schedule_entry_type: "shift" | "leave"
      schedule_leave_type: "furlough" | "pto" | "sick" | "unpaid"
      schedule_team: "manufacturing" | "coating" | "packaging" | "qa"
      task_priority: "low" | "normal" | "high" | "urgent"
      task_status: "open" | "in_progress" | "done" | "cancelled"
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
    Enums: {
      app_role: [
        "admin",
        "rd_manager",
        "production_manager",
        "quality_manager",
        "user",
        "hr_manager",
        "customer",
      ],
      launch_phase: [
        "Formulation",
        "Manufacturing",
        "Regulatory",
        "Packaging",
        "Marketing",
        "Distribution",
      ],
      launch_priority: ["low", "medium", "high"],
      launch_project_status: [
        "planning",
        "active",
        "on_hold",
        "completed",
        "cancelled",
      ],
      launch_status: ["todo", "in_progress", "blocked", "done", "review"],
      schedule_building: ["17_west", "282_ridgedale"],
      schedule_entry_type: ["shift", "leave"],
      schedule_leave_type: ["furlough", "pto", "sick", "unpaid"],
      schedule_team: ["manufacturing", "coating", "packaging", "qa"],
      task_priority: ["low", "normal", "high", "urgent"],
      task_status: ["open", "in_progress", "done", "cancelled"],
    },
  },
} as const
