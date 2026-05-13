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
      advance_allocations: {
        Row: {
          advance_receipt_id: string
          allocated_amount: number
          allocated_at: string
          allocated_by: string | null
          id: string
          invoice_id: string
        }
        Insert: {
          advance_receipt_id: string
          allocated_amount: number
          allocated_at?: string
          allocated_by?: string | null
          id?: string
          invoice_id: string
        }
        Update: {
          advance_receipt_id?: string
          allocated_amount?: number
          allocated_at?: string
          allocated_by?: string | null
          id?: string
          invoice_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "advance_allocations_advance_receipt_id_fkey"
            columns: ["advance_receipt_id"]
            isOneToOne: false
            referencedRelation: "advance_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advance_allocations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      advance_receipts: {
        Row: {
          adjusted_amount: number
          balance_amount: number
          branch_id: string | null
          created_at: string
          created_by: string | null
          dealer_id: string
          gross_amount: number
          id: string
          notes: string | null
          payment_mode: string
          receipt_date: string
          receipt_number: string
          reference_number: string | null
          status: string
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          adjusted_amount?: number
          balance_amount: number
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          dealer_id: string
          gross_amount: number
          id?: string
          notes?: string | null
          payment_mode?: string
          receipt_date?: string
          receipt_number: string
          reference_number?: string | null
          status?: string
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          adjusted_amount?: number
          balance_amount?: number
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          dealer_id?: string
          gross_amount?: number
          id?: string
          notes?: string | null
          payment_mode?: string
          receipt_date?: string
          receipt_number?: string
          reference_number?: string | null
          status?: string
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "advance_receipts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advance_receipts_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
        ]
      }
      api_rate_limits: {
        Row: {
          called_at: string
          endpoint: string
          id: string
          user_id: string
        }
        Insert: {
          called_at?: string
          endpoint: string
          id?: string
          user_id: string
        }
        Update: {
          called_at?: string
          endpoint?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_role: string | null
          actor_user_id: string | null
          created_at: string
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
        }
        Insert: {
          action: string
          actor_role?: string | null
          actor_user_id?: string | null
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
        }
        Update: {
          action?: string
          actor_role?: string | null
          actor_user_id?: string | null
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
      bom_headers: {
        Row: {
          bom_name: string
          branch_id: string | null
          computed_cost: number
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          notes: string | null
          product_id: string
          updated_at: string
          version: number
        }
        Insert: {
          bom_name: string
          branch_id?: string | null
          computed_cost?: number
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          product_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          bom_name?: string
          branch_id?: string | null
          computed_cost?: number
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          product_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "bom_headers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_headers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      bom_items: {
        Row: {
          bom_id: string
          created_at: string
          id: string
          notes: string | null
          packing_rate: number
          purchase_rate: number
          qty: number
          raw_material_id: string
          scheme_1: number
          scheme_2: number
          scheme_3: number
          unit: string | null
        }
        Insert: {
          bom_id: string
          created_at?: string
          id?: string
          notes?: string | null
          packing_rate?: number
          purchase_rate?: number
          qty?: number
          raw_material_id: string
          scheme_1?: number
          scheme_2?: number
          scheme_3?: number
          unit?: string | null
        }
        Update: {
          bom_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          packing_rate?: number
          purchase_rate?: number
          qty?: number
          raw_material_id?: string
          scheme_1?: number
          scheme_2?: number
          scheme_3?: number
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bom_items_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "bom_headers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_items_raw_material_id_fkey"
            columns: ["raw_material_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      branch_transfer_items: {
        Row: {
          amount: number
          branch_transfer_id: string
          created_at: string
          gst_rate: number
          hsn_code: string | null
          id: string
          product_id: string
          qty: number
          rate: number
        }
        Insert: {
          amount?: number
          branch_transfer_id: string
          created_at?: string
          gst_rate?: number
          hsn_code?: string | null
          id?: string
          product_id: string
          qty: number
          rate: number
        }
        Update: {
          amount?: number
          branch_transfer_id?: string
          created_at?: string
          gst_rate?: number
          hsn_code?: string | null
          id?: string
          product_id?: string
          qty?: number
          rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "branch_transfer_items_branch_transfer_id_fkey"
            columns: ["branch_transfer_id"]
            isOneToOne: false
            referencedRelation: "branch_transfers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branch_transfer_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      branch_transfers: {
        Row: {
          cgst_total: number
          created_at: string
          created_by: string | null
          from_branch_id: string
          id: string
          igst_total: number
          notes: string | null
          purchase_invoice_id: string | null
          sale_invoice_id: string | null
          sgst_total: number
          status: string
          subtotal: number
          to_branch_id: string
          total_amount: number
          transfer_date: string
          transfer_number: string
          updated_at: string
        }
        Insert: {
          cgst_total?: number
          created_at?: string
          created_by?: string | null
          from_branch_id: string
          id?: string
          igst_total?: number
          notes?: string | null
          purchase_invoice_id?: string | null
          sale_invoice_id?: string | null
          sgst_total?: number
          status?: string
          subtotal?: number
          to_branch_id: string
          total_amount?: number
          transfer_date?: string
          transfer_number: string
          updated_at?: string
        }
        Update: {
          cgst_total?: number
          created_at?: string
          created_by?: string | null
          from_branch_id?: string
          id?: string
          igst_total?: number
          notes?: string | null
          purchase_invoice_id?: string | null
          sale_invoice_id?: string | null
          sgst_total?: number
          status?: string
          subtotal?: number
          to_branch_id?: string
          total_amount?: number
          transfer_date?: string
          transfer_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branch_transfers_from_branch_id_fkey"
            columns: ["from_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branch_transfers_to_branch_id_fkey"
            columns: ["to_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          bank_account: string | null
          bank_ifsc: string | null
          bank_name: string | null
          branch_code: string
          branch_name: string
          city: string | null
          created_at: string
          email: string | null
          gst_number: string | null
          id: string
          is_active: boolean
          is_default: boolean
          legal_name: string | null
          next_ar_number: number
          next_cn_number: number
          next_contra_number: number
          next_dn_number: number
          next_invoice_number: number
          next_journal_number: number
          next_order_number: number
          next_payment_voucher_number: number
          next_po_number: number
          next_receipt_voucher_number: number
          next_transfer_number: number
          phone: string | null
          pincode: string | null
          state: string | null
          state_code: string | null
          updated_at: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          bank_account?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          branch_code: string
          branch_name: string
          city?: string | null
          created_at?: string
          email?: string | null
          gst_number?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          legal_name?: string | null
          next_ar_number?: number
          next_cn_number?: number
          next_contra_number?: number
          next_dn_number?: number
          next_invoice_number?: number
          next_journal_number?: number
          next_order_number?: number
          next_payment_voucher_number?: number
          next_po_number?: number
          next_receipt_voucher_number?: number
          next_transfer_number?: number
          phone?: string | null
          pincode?: string | null
          state?: string | null
          state_code?: string | null
          updated_at?: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          bank_account?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          branch_code?: string
          branch_name?: string
          city?: string | null
          created_at?: string
          email?: string | null
          gst_number?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          legal_name?: string | null
          next_ar_number?: number
          next_cn_number?: number
          next_contra_number?: number
          next_dn_number?: number
          next_invoice_number?: number
          next_journal_number?: number
          next_order_number?: number
          next_payment_voucher_number?: number
          next_po_number?: number
          next_receipt_voucher_number?: number
          next_transfer_number?: number
          phone?: string | null
          pincode?: string | null
          state?: string | null
          state_code?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          bank_account: string | null
          bank_ifsc: string | null
          bank_name: string | null
          city: string | null
          company_name: string
          created_at: string
          email: string | null
          gst_number: string | null
          id: string
          invoice_series: string | null
          invoice_template: string
          legal_name: string | null
          logo_url: string | null
          next_ar_number: number
          next_cn_number: number
          next_contra_number: number
          next_dn_number: number
          next_invoice_number: number
          next_journal_number: number
          next_order_number: number
          next_payment_voucher_number: number
          next_po_number: number
          next_receipt_voucher_number: number
          next_transfer_number: number
          pan_number: string | null
          phone: string | null
          pincode: string | null
          prorata_90day_pct: number
          prorata_sameday_pct: number
          state: string | null
          state_code: string | null
          updated_at: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          bank_account?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          city?: string | null
          company_name?: string
          created_at?: string
          email?: string | null
          gst_number?: string | null
          id?: string
          invoice_series?: string | null
          invoice_template?: string
          legal_name?: string | null
          logo_url?: string | null
          next_ar_number?: number
          next_cn_number?: number
          next_contra_number?: number
          next_dn_number?: number
          next_invoice_number?: number
          next_journal_number?: number
          next_order_number?: number
          next_payment_voucher_number?: number
          next_po_number?: number
          next_receipt_voucher_number?: number
          next_transfer_number?: number
          pan_number?: string | null
          phone?: string | null
          pincode?: string | null
          prorata_90day_pct?: number
          prorata_sameday_pct?: number
          state?: string | null
          state_code?: string | null
          updated_at?: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          bank_account?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          city?: string | null
          company_name?: string
          created_at?: string
          email?: string | null
          gst_number?: string | null
          id?: string
          invoice_series?: string | null
          invoice_template?: string
          legal_name?: string | null
          logo_url?: string | null
          next_ar_number?: number
          next_cn_number?: number
          next_contra_number?: number
          next_dn_number?: number
          next_invoice_number?: number
          next_journal_number?: number
          next_order_number?: number
          next_payment_voucher_number?: number
          next_po_number?: number
          next_receipt_voucher_number?: number
          next_transfer_number?: number
          pan_number?: string | null
          phone?: string | null
          pincode?: string | null
          prorata_90day_pct?: number
          prorata_sameday_pct?: number
          state?: string | null
          state_code?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      credit_note_items: {
        Row: {
          amount: number
          batch_id: string
          cgst_amount: number
          created_at: string
          credit_note_id: string
          gst_rate: number
          hsn_code: string | null
          id: string
          igst_amount: number
          product_id: string
          qty: number
          rate: number
          sgst_amount: number
          total_amount: number
        }
        Insert: {
          amount: number
          batch_id: string
          cgst_amount?: number
          created_at?: string
          credit_note_id: string
          gst_rate?: number
          hsn_code?: string | null
          id?: string
          igst_amount?: number
          product_id: string
          qty: number
          rate: number
          sgst_amount?: number
          total_amount?: number
        }
        Update: {
          amount?: number
          batch_id?: string
          cgst_amount?: number
          created_at?: string
          credit_note_id?: string
          gst_rate?: number
          hsn_code?: string | null
          id?: string
          igst_amount?: number
          product_id?: string
          qty?: number
          rate?: number
          sgst_amount?: number
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "credit_note_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "product_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_note_items_credit_note_id_fkey"
            columns: ["credit_note_id"]
            isOneToOne: false
            referencedRelation: "credit_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_note_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_notes: {
        Row: {
          branch_id: string | null
          cgst_total: number
          created_at: string
          created_by: string | null
          credit_date: string
          credit_note_number: string
          dealer_id: string
          id: string
          igst_total: number
          invoice_id: string
          reason: string | null
          sgst_total: number
          status: string
          subtotal: number
          total_amount: number
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          branch_id?: string | null
          cgst_total?: number
          created_at?: string
          created_by?: string | null
          credit_date?: string
          credit_note_number: string
          dealer_id: string
          id?: string
          igst_total?: number
          invoice_id: string
          reason?: string | null
          sgst_total?: number
          status?: string
          subtotal?: number
          total_amount?: number
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          branch_id?: string | null
          cgst_total?: number
          created_at?: string
          created_by?: string | null
          credit_date?: string
          credit_note_number?: string
          dealer_id?: string
          id?: string
          igst_total?: number
          invoice_id?: string
          reason?: string | null
          sgst_total?: number
          status?: string
          subtotal?: number
          total_amount?: number
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_notes_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      dealer_visits: {
        Row: {
          checkin_latlng: Json | null
          checkin_time: string
          checkout_latlng: Json | null
          checkout_time: string | null
          created_at: string
          dealer_id: string
          duty_session_id: string | null
          id: string
          notes: string | null
          photo_url: string | null
          user_id: string
        }
        Insert: {
          checkin_latlng?: Json | null
          checkin_time?: string
          checkout_latlng?: Json | null
          checkout_time?: string | null
          created_at?: string
          dealer_id: string
          duty_session_id?: string | null
          id?: string
          notes?: string | null
          photo_url?: string | null
          user_id: string
        }
        Update: {
          checkin_latlng?: Json | null
          checkin_time?: string
          checkout_latlng?: Json | null
          checkout_time?: string | null
          created_at?: string
          dealer_id?: string
          duty_session_id?: string | null
          id?: string
          notes?: string | null
          photo_url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dealer_visits_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dealer_visits_duty_session_id_fkey"
            columns: ["duty_session_id"]
            isOneToOne: false
            referencedRelation: "duty_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      dealers: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          branch_id: string | null
          city: string | null
          contact_person: string | null
          created_at: string
          created_by: string | null
          credit_limit: number | null
          email: string | null
          gst_address: Json | null
          gst_last_verified_at: string | null
          gst_legal_name: string | null
          gst_number: string | null
          gst_registration_date: string | null
          gst_status: string | null
          gst_trade_name: string | null
          gst_verification_ref: string | null
          gst_verification_source: string | null
          id: string
          name: string
          payment_terms_days: number | null
          phone: string | null
          pincode: string | null
          preferred_transporter_id: string | null
          price_level_id: string | null
          shipping_address_line1: string | null
          shipping_address_line2: string | null
          shipping_city: string | null
          shipping_pincode: string | null
          shipping_state: string | null
          state: string | null
          state_code: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          branch_id?: string | null
          city?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          credit_limit?: number | null
          email?: string | null
          gst_address?: Json | null
          gst_last_verified_at?: string | null
          gst_legal_name?: string | null
          gst_number?: string | null
          gst_registration_date?: string | null
          gst_status?: string | null
          gst_trade_name?: string | null
          gst_verification_ref?: string | null
          gst_verification_source?: string | null
          id?: string
          name: string
          payment_terms_days?: number | null
          phone?: string | null
          pincode?: string | null
          preferred_transporter_id?: string | null
          price_level_id?: string | null
          shipping_address_line1?: string | null
          shipping_address_line2?: string | null
          shipping_city?: string | null
          shipping_pincode?: string | null
          shipping_state?: string | null
          state?: string | null
          state_code?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          branch_id?: string | null
          city?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          credit_limit?: number | null
          email?: string | null
          gst_address?: Json | null
          gst_last_verified_at?: string | null
          gst_legal_name?: string | null
          gst_number?: string | null
          gst_registration_date?: string | null
          gst_status?: string | null
          gst_trade_name?: string | null
          gst_verification_ref?: string | null
          gst_verification_source?: string | null
          id?: string
          name?: string
          payment_terms_days?: number | null
          phone?: string | null
          pincode?: string | null
          preferred_transporter_id?: string | null
          price_level_id?: string | null
          shipping_address_line1?: string | null
          shipping_address_line2?: string | null
          shipping_city?: string | null
          shipping_pincode?: string | null
          shipping_state?: string | null
          state?: string | null
          state_code?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dealers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dealers_preferred_transporter_id_fkey"
            columns: ["preferred_transporter_id"]
            isOneToOne: false
            referencedRelation: "transporters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dealers_price_level_id_fkey"
            columns: ["price_level_id"]
            isOneToOne: false
            referencedRelation: "price_levels"
            referencedColumns: ["id"]
          },
        ]
      }
      debit_note_items: {
        Row: {
          amount: number
          batch_id: string
          cgst_amount: number
          created_at: string
          debit_note_id: string
          gst_rate: number
          hsn_code: string | null
          id: string
          igst_amount: number
          product_id: string
          qty: number
          rate: number
          sgst_amount: number
          total_amount: number
        }
        Insert: {
          amount: number
          batch_id: string
          cgst_amount?: number
          created_at?: string
          debit_note_id: string
          gst_rate?: number
          hsn_code?: string | null
          id?: string
          igst_amount?: number
          product_id: string
          qty: number
          rate: number
          sgst_amount?: number
          total_amount?: number
        }
        Update: {
          amount?: number
          batch_id?: string
          cgst_amount?: number
          created_at?: string
          debit_note_id?: string
          gst_rate?: number
          hsn_code?: string | null
          id?: string
          igst_amount?: number
          product_id?: string
          qty?: number
          rate?: number
          sgst_amount?: number
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "debit_note_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "product_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debit_note_items_debit_note_id_fkey"
            columns: ["debit_note_id"]
            isOneToOne: false
            referencedRelation: "debit_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debit_note_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      debit_notes: {
        Row: {
          branch_id: string | null
          cgst_total: number
          created_at: string
          created_by: string | null
          debit_date: string
          debit_note_number: string
          id: string
          igst_total: number
          purchase_invoice_id: string
          reason: string | null
          sgst_total: number
          status: string
          subtotal: number
          supplier_id: string
          total_amount: number
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          branch_id?: string | null
          cgst_total?: number
          created_at?: string
          created_by?: string | null
          debit_date?: string
          debit_note_number: string
          id?: string
          igst_total?: number
          purchase_invoice_id: string
          reason?: string | null
          sgst_total?: number
          status?: string
          subtotal?: number
          supplier_id: string
          total_amount?: number
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          branch_id?: string | null
          cgst_total?: number
          created_at?: string
          created_by?: string | null
          debit_date?: string
          debit_note_number?: string
          id?: string
          igst_total?: number
          purchase_invoice_id?: string
          reason?: string | null
          sgst_total?: number
          status?: string
          subtotal?: number
          supplier_id?: string
          total_amount?: number
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "debit_notes_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debit_notes_purchase_invoice_id_fkey"
            columns: ["purchase_invoice_id"]
            isOneToOne: false
            referencedRelation: "purchase_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debit_notes_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      duty_sessions: {
        Row: {
          created_at: string
          end_location: Json | null
          end_time: string | null
          id: string
          incentive_amount: number
          start_location: Json | null
          start_time: string
          status: string
          total_duration_mins: number
          total_km: number
          tracking_mode: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_location?: Json | null
          end_time?: string | null
          id?: string
          incentive_amount?: number
          start_location?: Json | null
          start_time?: string
          status?: string
          total_duration_mins?: number
          total_km?: number
          tracking_mode?: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_location?: Json | null
          end_time?: string | null
          id?: string
          incentive_amount?: number
          start_location?: Json | null
          start_time?: string
          status?: string
          total_duration_mins?: number
          total_km?: number
          tracking_mode?: string
          user_id?: string
        }
        Relationships: []
      }
      employee_pincodes: {
        Row: {
          created_at: string
          id: string
          pincode: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          pincode: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          pincode?: string
          user_id?: string
        }
        Relationships: []
      }
      employee_profiles: {
        Row: {
          created_at: string
          employee_code: string
          id: string
          is_active: boolean
          name: string
          phone: string | null
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          employee_code: string
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          employee_code?: string
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      employees: {
        Row: {
          bank_account: string | null
          basic_salary: number
          created_at: string
          created_by: string | null
          date_of_joining: string | null
          department: string | null
          designation: string | null
          email: string | null
          id: string
          name: string
          pan: string | null
          phone: string | null
          status: string
          uan: string | null
          updated_at: string
        }
        Insert: {
          bank_account?: string | null
          basic_salary?: number
          created_at?: string
          created_by?: string | null
          date_of_joining?: string | null
          department?: string | null
          designation?: string | null
          email?: string | null
          id?: string
          name: string
          pan?: string | null
          phone?: string | null
          status?: string
          uan?: string | null
          updated_at?: string
        }
        Update: {
          bank_account?: string | null
          basic_salary?: number
          created_at?: string
          created_by?: string | null
          date_of_joining?: string | null
          department?: string | null
          designation?: string | null
          email?: string | null
          id?: string
          name?: string
          pan?: string | null
          phone?: string | null
          status?: string
          uan?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      field_order_items: {
        Row: {
          created_at: string
          expected_rate: number
          field_order_id: string
          id: string
          product_id: string
          qty: number
        }
        Insert: {
          created_at?: string
          expected_rate?: number
          field_order_id: string
          id?: string
          product_id: string
          qty: number
        }
        Update: {
          created_at?: string
          expected_rate?: number
          field_order_id?: string
          id?: string
          product_id?: string
          qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "field_order_items_field_order_id_fkey"
            columns: ["field_order_id"]
            isOneToOne: false
            referencedRelation: "field_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      field_orders: {
        Row: {
          approved_order_id: string | null
          branch_id: string | null
          created_at: string
          created_by_user_id: string
          dealer_id: string
          duty_session_id: string | null
          id: string
          notes: string | null
          requested_delivery_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          approved_order_id?: string | null
          branch_id?: string | null
          created_at?: string
          created_by_user_id: string
          dealer_id: string
          duty_session_id?: string | null
          id?: string
          notes?: string | null
          requested_delivery_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          approved_order_id?: string | null
          branch_id?: string | null
          created_at?: string
          created_by_user_id?: string
          dealer_id?: string
          duty_session_id?: string | null
          id?: string
          notes?: string | null
          requested_delivery_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "field_orders_approved_order_id_fkey"
            columns: ["approved_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_orders_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_orders_duty_session_id_fkey"
            columns: ["duty_session_id"]
            isOneToOne: false
            referencedRelation: "duty_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      field_payments: {
        Row: {
          amount: number
          attachment_url: string | null
          branch_id: string | null
          created_at: string
          created_by_user_id: string
          dealer_id: string
          id: string
          mode: string
          notes: string | null
          payment_date: string
          reference_no: string | null
          status: string
        }
        Insert: {
          amount: number
          attachment_url?: string | null
          branch_id?: string | null
          created_at?: string
          created_by_user_id: string
          dealer_id: string
          id?: string
          mode?: string
          notes?: string | null
          payment_date?: string
          reference_no?: string | null
          status?: string
        }
        Update: {
          amount?: number
          attachment_url?: string | null
          branch_id?: string | null
          created_at?: string
          created_by_user_id?: string
          dealer_id?: string
          id?: string
          mode?: string
          notes?: string | null
          payment_date?: string
          reference_no?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "field_payments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_payments_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_years: {
        Row: {
          closing_notes: string | null
          created_at: string
          end_date: string
          fy_code: string
          id: string
          is_active: boolean
          is_closed: boolean
          start_date: string
          updated_at: string
        }
        Insert: {
          closing_notes?: string | null
          created_at?: string
          end_date: string
          fy_code: string
          id?: string
          is_active?: boolean
          is_closed?: boolean
          start_date: string
          updated_at?: string
        }
        Update: {
          closing_notes?: string | null
          created_at?: string
          end_date?: string
          fy_code?: string
          id?: string
          is_active?: boolean
          is_closed?: boolean
          start_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      gst_verification_logs: {
        Row: {
          created_at: string
          gst_no: string
          id: string
          response_json: Json | null
          status: string
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          gst_no: string
          id?: string
          response_json?: Json | null
          status: string
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          gst_no?: string
          id?: string
          response_json?: Json | null
          status?: string
          verified_by?: string | null
        }
        Relationships: []
      }
      gstr2b_entries: {
        Row: {
          branch_id: string | null
          cess: number
          cgst: number
          created_at: string
          doc_type: string | null
          id: string
          igst: number
          invoice_date: string
          invoice_number: string
          invoice_value: number
          itc_availability: string | null
          match_status: string
          matched_pi_id: string | null
          mismatch_reasons: Json | null
          place_of_supply: string | null
          return_period: string
          reverse_charge: boolean
          sgst: number
          supplier_gstin: string
          supplier_name: string | null
          taxable_value: number
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          branch_id?: string | null
          cess?: number
          cgst?: number
          created_at?: string
          doc_type?: string | null
          id?: string
          igst?: number
          invoice_date: string
          invoice_number: string
          invoice_value?: number
          itc_availability?: string | null
          match_status?: string
          matched_pi_id?: string | null
          mismatch_reasons?: Json | null
          place_of_supply?: string | null
          return_period: string
          reverse_charge?: boolean
          sgst?: number
          supplier_gstin: string
          supplier_name?: string | null
          taxable_value?: number
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          branch_id?: string | null
          cess?: number
          cgst?: number
          created_at?: string
          doc_type?: string | null
          id?: string
          igst?: number
          invoice_date?: string
          invoice_number?: string
          invoice_value?: number
          itc_availability?: string | null
          match_status?: string
          matched_pi_id?: string | null
          mismatch_reasons?: Json | null
          place_of_supply?: string | null
          return_period?: string
          reverse_charge?: boolean
          sgst?: number
          supplier_gstin?: string
          supplier_name?: string | null
          taxable_value?: number
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gstr2b_entries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gstr2b_entries_matched_pi_id_fkey"
            columns: ["matched_pi_id"]
            isOneToOne: false
            referencedRelation: "purchase_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      incentive_rules: {
        Row: {
          created_at: string
          effective_from: string
          id: string
          min_km_threshold: number
          per_km_rate: number
          per_order_bonus: number
        }
        Insert: {
          created_at?: string
          effective_from?: string
          id?: string
          min_km_threshold?: number
          per_km_rate?: number
          per_order_bonus?: number
        }
        Update: {
          created_at?: string
          effective_from?: string
          id?: string
          min_km_threshold?: number
          per_km_rate?: number
          per_order_bonus?: number
        }
        Relationships: []
      }
      inventory_txn: {
        Row: {
          batch_id: string
          branch_id: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          product_id: string
          qty_in: number
          qty_out: number
          rate: number
          ref_id: string | null
          ref_type: string | null
          txn_type: Database["public"]["Enums"]["inventory_txn_type"]
        }
        Insert: {
          batch_id: string
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          product_id: string
          qty_in?: number
          qty_out?: number
          rate?: number
          ref_id?: string | null
          ref_type?: string | null
          txn_type: Database["public"]["Enums"]["inventory_txn_type"]
        }
        Update: {
          batch_id?: string
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          product_id?: string
          qty_in?: number
          qty_out?: number
          rate?: number
          ref_id?: string | null
          ref_type?: string | null
          txn_type?: Database["public"]["Enums"]["inventory_txn_type"]
        }
        Relationships: [
          {
            foreignKeyName: "inventory_txn_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "product_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_txn_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_txn_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          amount: number
          batch_id: string
          cgst_amount: number
          created_at: string
          discount_amount: number
          discount_pct: number
          gst_rate: number
          hsn_code: string | null
          id: string
          igst_amount: number
          invoice_id: string
          product_id: string
          qty: number
          rate: number
          sgst_amount: number
          total_amount: number
        }
        Insert: {
          amount: number
          batch_id: string
          cgst_amount?: number
          created_at?: string
          discount_amount?: number
          discount_pct?: number
          gst_rate?: number
          hsn_code?: string | null
          id?: string
          igst_amount?: number
          invoice_id: string
          product_id: string
          qty: number
          rate: number
          sgst_amount?: number
          total_amount?: number
        }
        Update: {
          amount?: number
          batch_id?: string
          cgst_amount?: number
          created_at?: string
          discount_amount?: number
          discount_pct?: number
          gst_rate?: number
          hsn_code?: string | null
          id?: string
          igst_amount?: number
          invoice_id?: string
          product_id?: string
          qty?: number
          rate?: number
          sgst_amount?: number
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "product_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_paid: number
          branch_id: string | null
          cgst_total: number
          created_at: string
          created_by: string | null
          dealer_id: string
          delivery_to: string | null
          dispatch_from: string | null
          due_date: string | null
          id: string
          igst_total: number
          invoice_date: string
          invoice_number: string
          notes: string | null
          order_id: string | null
          place_of_supply: string | null
          round_off: number
          sgst_total: number
          status: string
          subtotal: number
          total_amount: number
          transport_mode: string | null
          updated_at: string
          vehicle_no: string | null
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          amount_paid?: number
          branch_id?: string | null
          cgst_total?: number
          created_at?: string
          created_by?: string | null
          dealer_id: string
          delivery_to?: string | null
          dispatch_from?: string | null
          due_date?: string | null
          id?: string
          igst_total?: number
          invoice_date?: string
          invoice_number: string
          notes?: string | null
          order_id?: string | null
          place_of_supply?: string | null
          round_off?: number
          sgst_total?: number
          status?: string
          subtotal?: number
          total_amount?: number
          transport_mode?: string | null
          updated_at?: string
          vehicle_no?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          amount_paid?: number
          branch_id?: string | null
          cgst_total?: number
          created_at?: string
          created_by?: string | null
          dealer_id?: string
          delivery_to?: string | null
          dispatch_from?: string | null
          due_date?: string | null
          id?: string
          igst_total?: number
          invoice_date?: string
          invoice_number?: string
          notes?: string | null
          order_id?: string | null
          place_of_supply?: string | null
          round_off?: number
          sgst_total?: number
          status?: string
          subtotal?: number
          total_amount?: number
          transport_mode?: string | null
          updated_at?: string
          vehicle_no?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_accounts: {
        Row: {
          account_type: string
          code: string
          created_at: string
          id: string
          is_active: boolean
          is_system: boolean
          name: string
          parent_type: string
        }
        Insert: {
          account_type?: string
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          name: string
          parent_type?: string
        }
        Update: {
          account_type?: string
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          name?: string
          parent_type?: string
        }
        Relationships: []
      }
      ledger_entries: {
        Row: {
          branch_id: string | null
          created_at: string
          credit: number
          dealer_id: string
          debit: number
          description: string | null
          entry_date: string
          entry_type: string
          id: string
          ref_id: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          credit?: number
          dealer_id: string
          debit?: number
          description?: string | null
          entry_date?: string
          entry_type: string
          id?: string
          ref_id?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          credit?: number
          dealer_id?: string
          debit?: number
          description?: string | null
          entry_date?: string
          entry_type?: string
          id?: string
          ref_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
        ]
      }
      location_points: {
        Row: {
          accuracy: number | null
          duty_session_id: string
          id: string
          lat: number
          lng: number
          recorded_at: string
          source: string | null
          user_id: string
        }
        Insert: {
          accuracy?: number | null
          duty_session_id: string
          id?: string
          lat: number
          lng: number
          recorded_at?: string
          source?: string | null
          user_id: string
        }
        Update: {
          accuracy?: number | null
          duty_session_id?: string
          id?: string
          lat?: number
          lng?: number
          recorded_at?: string
          source?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_points_duty_session_id_fkey"
            columns: ["duty_session_id"]
            isOneToOne: false
            referencedRelation: "duty_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      opening_balances: {
        Row: {
          branch_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          fy_id: string
          id: string
          opening_credit: number
          opening_debit: number
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          entity_id: string
          entity_type?: string
          fy_id: string
          id?: string
          opening_credit?: number
          opening_debit?: number
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          fy_id?: string
          id?: string
          opening_credit?: number
          opening_debit?: number
        }
        Relationships: [
          {
            foreignKeyName: "opening_balances_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opening_balances_fy_id_fkey"
            columns: ["fy_id"]
            isOneToOne: false
            referencedRelation: "financial_years"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          amount: number
          created_at: string
          discount_amount: number
          discount_pct: number
          id: string
          order_id: string
          product_id: string
          qty: number
          rate: number
        }
        Insert: {
          amount: number
          created_at?: string
          discount_amount?: number
          discount_pct?: number
          id?: string
          order_id: string
          product_id: string
          qty: number
          rate: number
        }
        Update: {
          amount?: number
          created_at?: string
          discount_amount?: number
          discount_pct?: number
          id?: string
          order_id?: string
          product_id?: string
          qty?: number
          rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          branch_id: string | null
          created_at: string
          created_by: string | null
          dealer_id: string
          id: string
          notes: string | null
          order_date: string
          order_number: string
          status: Database["public"]["Enums"]["order_status"]
          total_amount: number
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          dealer_id: string
          id?: string
          notes?: string | null
          order_date?: string
          order_number: string
          status?: Database["public"]["Enums"]["order_status"]
          total_amount?: number
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          dealer_id?: string
          id?: string
          notes?: string | null
          order_date?: string
          order_number?: string
          status?: Database["public"]["Enums"]["order_status"]
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_allocations: {
        Row: {
          allocated_amount: number
          created_at: string
          days_elapsed: number | null
          id: string
          invoice_id: string
          payment_id: string
          prorata_discount: number | null
          prorata_rate: number | null
        }
        Insert: {
          allocated_amount: number
          created_at?: string
          days_elapsed?: number | null
          id?: string
          invoice_id: string
          payment_id: string
          prorata_discount?: number | null
          prorata_rate?: number | null
        }
        Update: {
          allocated_amount?: number
          created_at?: string
          days_elapsed?: number | null
          id?: string
          invoice_id?: string
          payment_id?: string
          prorata_discount?: number | null
          prorata_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_allocations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          branch_id: string | null
          created_at: string
          created_by: string | null
          dealer_id: string
          id: string
          net_amount: number
          notes: string | null
          payment_date: string
          payment_mode: string
          reference_number: string | null
          status: string
          tcs_amount: number
          tcs_rate: number
          tds_amount: number
          tds_rate: number
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          amount: number
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          dealer_id: string
          id?: string
          net_amount?: number
          notes?: string | null
          payment_date?: string
          payment_mode?: string
          reference_number?: string | null
          status?: string
          tcs_amount?: number
          tcs_rate?: number
          tds_amount?: number
          tds_rate?: number
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          amount?: number
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          dealer_id?: string
          id?: string
          net_amount?: number
          notes?: string | null
          payment_date?: string
          payment_mode?: string
          reference_number?: string | null
          status?: string
          tcs_amount?: number
          tcs_rate?: number
          tds_amount?: number
          tds_rate?: number
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_runs: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          month: number
          processed_at: string | null
          status: string
          total_deductions: number
          total_gross: number
          total_net: number
          year: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          month: number
          processed_at?: string | null
          status?: string
          total_deductions?: number
          total_gross?: number
          total_net?: number
          year: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          month?: number
          processed_at?: string | null
          status?: string
          total_deductions?: number
          total_gross?: number
          total_net?: number
          year?: number
        }
        Relationships: []
      }
      payslips: {
        Row: {
          basic: number
          created_at: string
          deductions: Json
          earnings: Json
          employee_id: string
          gross: number
          id: string
          net_pay: number
          payment_status: string
          payroll_run_id: string
        }
        Insert: {
          basic?: number
          created_at?: string
          deductions?: Json
          earnings?: Json
          employee_id: string
          gross?: number
          id?: string
          net_pay?: number
          payment_status?: string
          payroll_run_id: string
        }
        Update: {
          basic?: number
          created_at?: string
          deductions?: Json
          earnings?: Json
          employee_id?: string
          gross?: number
          id?: string
          net_pay?: number
          payment_status?: string
          payroll_run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payslips_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslips_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      price_levels: {
        Row: {
          branch_id: string | null
          created_at: string
          description: string | null
          id: string
          is_default: boolean
          name: string
          sort_order: number
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "price_levels_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      product_batches: {
        Row: {
          batch_no: string
          bin_id: string | null
          branch_id: string | null
          created_at: string
          created_by: string | null
          current_qty: number
          exp_date: string | null
          id: string
          mfg_date: string | null
          product_id: string
          purchase_rate: number
          updated_at: string
          warehouse_id: string | null
        }
        Insert: {
          batch_no: string
          bin_id?: string | null
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          current_qty?: number
          exp_date?: string | null
          id?: string
          mfg_date?: string | null
          product_id: string
          purchase_rate?: number
          updated_at?: string
          warehouse_id?: string | null
        }
        Update: {
          batch_no?: string
          bin_id?: string | null
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          current_qty?: number
          exp_date?: string | null
          id?: string
          mfg_date?: string | null
          product_id?: string
          purchase_rate?: number
          updated_at?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_batches_bin_id_fkey"
            columns: ["bin_id"]
            isOneToOne: false
            referencedRelation: "warehouse_bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_batches_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_batches_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      product_price_levels: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          price: number
          price_level_id: string
          product_id: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          price?: number
          price_level_id: string
          product_id: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          id?: string
          price?: number
          price_level_id?: string
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_price_levels_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_price_levels_price_level_id_fkey"
            columns: ["price_level_id"]
            isOneToOne: false
            referencedRelation: "price_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_price_levels_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_pricing_matrix: {
        Row: {
          created_at: string
          created_by: string | null
          ex_gst_price: number
          gst_rate: number
          id: string
          is_locked: boolean
          locked_at: string | null
          locked_by: string | null
          margin_pct: number
          mrp: number
          notes: string | null
          packing_price: number
          product_id: string
          purchase_price: number
          scheme_1: number
          scheme_2: number
          scheme_3: number
          slab_label: string
          slab_max: number | null
          slab_min: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ex_gst_price?: number
          gst_rate?: number
          id?: string
          is_locked?: boolean
          locked_at?: string | null
          locked_by?: string | null
          margin_pct?: number
          mrp?: number
          notes?: string | null
          packing_price?: number
          product_id: string
          purchase_price?: number
          scheme_1?: number
          scheme_2?: number
          scheme_3?: number
          slab_label: string
          slab_max?: number | null
          slab_min?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ex_gst_price?: number
          gst_rate?: number
          id?: string
          is_locked?: boolean
          locked_at?: string | null
          locked_by?: string | null
          margin_pct?: number
          mrp?: number
          notes?: string | null
          packing_price?: number
          product_id?: string
          purchase_price?: number
          scheme_1?: number
          scheme_2?: number
          scheme_3?: number
          slab_label?: string
          slab_max?: number | null
          slab_min?: number
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          branch_id: string | null
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          gst_rate: number
          hsn_code: string | null
          id: string
          is_active: boolean
          min_stock_alert_qty: number | null
          name: string
          purchase_price_default: number | null
          sale_price: number | null
          slug: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          gst_rate?: number
          hsn_code?: string | null
          id?: string
          is_active?: boolean
          min_stock_alert_qty?: number | null
          name: string
          purchase_price_default?: number | null
          sale_price?: number | null
          slug?: string | null
          unit?: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          gst_rate?: number
          hsn_code?: string | null
          id?: string
          is_active?: boolean
          min_stock_alert_qty?: number | null
          name?: string
          purchase_price_default?: number | null
          sale_price?: number | null
          slug?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      purchase_invoice_items: {
        Row: {
          amount: number
          batch_id: string | null
          cgst_amount: number
          created_at: string
          gst_rate: number
          hsn_code: string | null
          id: string
          igst_amount: number
          product_id: string
          purchase_invoice_id: string
          qty: number
          rate: number
          sgst_amount: number
          total_amount: number
        }
        Insert: {
          amount: number
          batch_id?: string | null
          cgst_amount?: number
          created_at?: string
          gst_rate?: number
          hsn_code?: string | null
          id?: string
          igst_amount?: number
          product_id: string
          purchase_invoice_id: string
          qty: number
          rate: number
          sgst_amount?: number
          total_amount?: number
        }
        Update: {
          amount?: number
          batch_id?: string | null
          cgst_amount?: number
          created_at?: string
          gst_rate?: number
          hsn_code?: string | null
          id?: string
          igst_amount?: number
          product_id?: string
          purchase_invoice_id?: string
          qty?: number
          rate?: number
          sgst_amount?: number
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_invoice_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "product_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoice_items_purchase_invoice_id_fkey"
            columns: ["purchase_invoice_id"]
            isOneToOne: false
            referencedRelation: "purchase_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_invoices: {
        Row: {
          amount_paid: number
          branch_id: string | null
          cgst_total: number
          created_at: string
          created_by: string | null
          id: string
          igst_total: number
          notes: string | null
          pi_date: string
          pi_number: string
          purchase_order_id: string | null
          round_off: number
          sgst_total: number
          status: string
          subtotal: number
          supplier_id: string
          total_amount: number
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          amount_paid?: number
          branch_id?: string | null
          cgst_total?: number
          created_at?: string
          created_by?: string | null
          id?: string
          igst_total?: number
          notes?: string | null
          pi_date?: string
          pi_number: string
          purchase_order_id?: string | null
          round_off?: number
          sgst_total?: number
          status?: string
          subtotal?: number
          supplier_id: string
          total_amount?: number
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          amount_paid?: number
          branch_id?: string | null
          cgst_total?: number
          created_at?: string
          created_by?: string | null
          id?: string
          igst_total?: number
          notes?: string | null
          pi_date?: string
          pi_number?: string
          purchase_order_id?: string | null
          round_off?: number
          sgst_total?: number
          status?: string
          subtotal?: number
          supplier_id?: string
          total_amount?: number
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_invoices_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoices_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          amount: number
          created_at: string
          id: string
          product_id: string
          purchase_order_id: string
          qty: number
          rate: number
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          product_id: string
          purchase_order_id: string
          qty: number
          rate: number
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          product_id?: string
          purchase_order_id?: string
          qty?: number
          rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          branch_id: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          po_date: string
          po_number: string
          status: string
          supplier_id: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          po_date?: string
          po_number: string
          status?: string
          supplier_id: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          po_date?: string
          po_number?: string
          status?: string
          supplier_id?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_components: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_percentage: boolean
          name: string
          type: string
          value: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_percentage?: boolean
          name: string
          type?: string
          value?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_percentage?: boolean
          name?: string
          type?: string
          value?: number
        }
        Relationships: []
      }
      stock_transfer_items: {
        Row: {
          batch_id: string
          created_at: string
          from_bin_id: string | null
          id: string
          product_id: string
          qty: number
          to_bin_id: string | null
          transfer_id: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          from_bin_id?: string | null
          id?: string
          product_id: string
          qty: number
          to_bin_id?: string | null
          transfer_id: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          from_bin_id?: string | null
          id?: string
          product_id?: string
          qty?: number
          to_bin_id?: string | null
          transfer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfer_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "product_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_items_from_bin_id_fkey"
            columns: ["from_bin_id"]
            isOneToOne: false
            referencedRelation: "warehouse_bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_items_to_bin_id_fkey"
            columns: ["to_bin_id"]
            isOneToOne: false
            referencedRelation: "warehouse_bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_items_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "stock_transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transfers: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          branch_id: string | null
          created_at: string
          created_by: string | null
          from_warehouse_id: string
          id: string
          notes: string | null
          received_at: string | null
          received_by: string | null
          status: string
          to_warehouse_id: string
          transfer_date: string
          transfer_number: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          from_warehouse_id: string
          id?: string
          notes?: string | null
          received_at?: string | null
          received_by?: string | null
          status?: string
          to_warehouse_id: string
          transfer_date?: string
          transfer_number: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          from_warehouse_id?: string
          id?: string
          notes?: string | null
          received_at?: string | null
          received_by?: string | null
          status?: string
          to_warehouse_id?: string
          transfer_date?: string
          transfer_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_from_warehouse_id_fkey"
            columns: ["from_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_to_warehouse_id_fkey"
            columns: ["to_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_ledger_entries: {
        Row: {
          branch_id: string | null
          created_at: string
          credit: number
          debit: number
          description: string | null
          entry_date: string
          entry_type: string
          id: string
          ref_id: string | null
          supplier_id: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          credit?: number
          debit?: number
          description?: string | null
          entry_date?: string
          entry_type: string
          id?: string
          ref_id?: string | null
          supplier_id: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          credit?: number
          debit?: number
          description?: string | null
          entry_date?: string
          entry_type?: string
          id?: string
          ref_id?: string | null
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_ledger_entries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_ledger_entries_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          branch_id: string | null
          city: string | null
          contact_person: string | null
          created_at: string
          created_by: string | null
          email: string | null
          gst_number: string | null
          id: string
          name: string
          payment_terms_days: number | null
          phone: string | null
          pincode: string | null
          state: string | null
          state_code: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          branch_id?: string | null
          city?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          gst_number?: string | null
          id?: string
          name: string
          payment_terms_days?: number | null
          phone?: string | null
          pincode?: string | null
          state?: string | null
          state_code?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          branch_id?: string | null
          city?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          gst_number?: string | null
          id?: string
          name?: string
          payment_terms_days?: number | null
          phone?: string | null
          pincode?: string | null
          state?: string | null
          state_code?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      transporters: {
        Row: {
          address_line1: string | null
          branch_id: string | null
          city: string | null
          contact_person: string | null
          created_at: string
          email: string | null
          gst_last_verified_at: string | null
          gst_legal_name: string | null
          gst_number: string | null
          gst_status: string | null
          gst_trade_name: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          pincode: string | null
          state: string | null
          state_code: string | null
          status: string
          updated_at: string
          vehicle_types: string | null
        }
        Insert: {
          address_line1?: string | null
          branch_id?: string | null
          city?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          gst_last_verified_at?: string | null
          gst_legal_name?: string | null
          gst_number?: string | null
          gst_status?: string | null
          gst_trade_name?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          pincode?: string | null
          state?: string | null
          state_code?: string | null
          status?: string
          updated_at?: string
          vehicle_types?: string | null
        }
        Update: {
          address_line1?: string | null
          branch_id?: string | null
          city?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          gst_last_verified_at?: string | null
          gst_legal_name?: string | null
          gst_number?: string | null
          gst_status?: string | null
          gst_trade_name?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          pincode?: string | null
          state?: string | null
          state_code?: string | null
          status?: string
          updated_at?: string
          vehicle_types?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transporters_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      user_branches: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_branches_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          assigned_by: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      voucher_lines: {
        Row: {
          account_id: string
          created_at: string
          credit: number
          dealer_id: string | null
          debit: number
          id: string
          narration: string | null
          supplier_id: string | null
          voucher_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          credit?: number
          dealer_id?: string | null
          debit?: number
          id?: string
          narration?: string | null
          supplier_id?: string | null
          voucher_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          credit?: number
          dealer_id?: string | null
          debit?: number
          id?: string
          narration?: string | null
          supplier_id?: string | null
          voucher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voucher_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ledger_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voucher_lines_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voucher_lines_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voucher_lines_voucher_id_fkey"
            columns: ["voucher_id"]
            isOneToOne: false
            referencedRelation: "vouchers"
            referencedColumns: ["id"]
          },
        ]
      }
      vouchers: {
        Row: {
          branch_id: string | null
          created_at: string
          created_by: string | null
          id: string
          narration: string | null
          status: string
          total_amount: number
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
          voucher_date: string
          voucher_number: string
          voucher_type: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          narration?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
          voucher_date?: string
          voucher_number: string
          voucher_type: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          narration?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
          voucher_date?: string
          voucher_number?: string
          voucher_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "vouchers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_bins: {
        Row: {
          bin_code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          warehouse_id: string
        }
        Insert: {
          bin_code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          warehouse_id: string
        }
        Update: {
          bin_code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_bins_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          branch_id: string | null
          city: string | null
          code: string
          created_at: string
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          pincode: string | null
          state: string | null
          updated_at: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          branch_id?: string | null
          city?: string | null
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          pincode?: string | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          branch_id?: string | null
          city?: string | null
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          pincode?: string | null
          state?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      allocate_advance_to_invoice_atomic: {
        Args: {
          p_allocated_by?: string
          p_amount_to_allocate: number
          p_dealer_id: string
          p_invoice_id: string
        }
        Returns: Json
      }
      apply_prorata_credit: { Args: { p_payment_id: string }; Returns: number }
      approve_field_order: {
        Args: { _field_order_id: string; _order_number: string }
        Returns: string
      }
      bulk_update_pricing_matrix: {
        Args: { p_updates: Json; p_user_id: string }
        Returns: Json
      }
      compute_incentive: {
        Args: { _session_id: string; _total_km: number }
        Returns: number
      }
      compute_session_km: { Args: { _session_id: string }; Returns: number }
      create_advance_receipt_atomic: {
        Args: {
          p_amount?: number
          p_created_by?: string
          p_dealer_id: string
          p_notes?: string
          p_payment_mode: string
          p_receipt_date: string
          p_reference_number?: string
        }
        Returns: Json
      }
      create_credit_note_atomic: {
        Args: {
          p_created_by: string
          p_invoice_id: string
          p_items?: Json
          p_reason: string
        }
        Returns: Json
      }
      create_debit_note_atomic: {
        Args: {
          p_created_by: string
          p_items?: Json
          p_purchase_invoice_id: string
          p_reason: string
        }
        Returns: Json
      }
      create_invoice_atomic:
        | {
            Args: {
              p_cgst_total: number
              p_created_by: string
              p_dealer_id: string
              p_delivery_to?: string
              p_dispatch_from?: string
              p_due_date?: string
              p_igst_total: number
              p_invoice_date: string
              p_items?: Json
              p_place_of_supply?: string
              p_sgst_total: number
              p_subtotal: number
              p_total_amount: number
              p_transport_mode?: string
              p_vehicle_no?: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_cgst_total: number
              p_created_by: string
              p_dealer_id: string
              p_delivery_to?: string
              p_dispatch_from?: string
              p_due_date?: string
              p_igst_total: number
              p_invoice_date: string
              p_items?: Json
              p_place_of_supply?: string
              p_round_off?: number
              p_sgst_total: number
              p_subtotal: number
              p_total_amount: number
              p_transport_mode?: string
              p_vehicle_no?: string
            }
            Returns: Json
          }
      create_order_atomic:
        | {
            Args: {
              p_created_by?: string
              p_dealer_id: string
              p_items?: Json
              p_notes?: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_branch_id?: string
              p_created_by?: string
              p_dealer_id: string
              p_items?: Json
              p_notes?: string
            }
            Returns: Json
          }
      create_po_atomic: {
        Args: {
          p_created_by?: string
          p_items?: Json
          p_notes?: string
          p_supplier_id: string
        }
        Returns: Json
      }
      create_purchase_invoice_atomic: {
        Args: {
          p_cgst_total: number
          p_created_by: string
          p_igst_total: number
          p_items?: Json
          p_pi_date: string
          p_pi_number: string
          p_sgst_total: number
          p_subtotal: number
          p_supplier_id: string
          p_total_amount: number
        }
        Returns: Json
      }
      execute_stock_transfer: {
        Args: { p_action: string; p_transfer_id: string; p_user_id: string }
        Returns: undefined
      }
      finalize_duty_session: { Args: { _session_id: string }; Returns: Json }
      get_active_duty_locations: {
        Args: never
        Returns: {
          full_name: string
          last_point: Json
          session_id: string
          start_time: string
          total_km: number
          user_id: string
        }[]
      }
      get_pincode_assignees: {
        Args: { p_pincode: string }
        Returns: {
          full_name: string
          pincode: string
          user_id: string
        }[]
      }
      get_recent_visits: {
        Args: { p_since?: string }
        Returns: {
          checkin: Json
          checkout: Json
          dealer_id: string
          dealer_name: string
          full_name: string
          user_id: string
          visit_id: string
        }[]
      }
      has_any_role: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      record_payment_atomic: {
        Args: {
          p_amount: number
          p_created_by?: string
          p_dealer_id: string
          p_net_amount?: number
          p_notes?: string
          p_payment_date: string
          p_payment_mode: string
          p_reference_number?: string
          p_tcs_amount?: number
          p_tcs_rate?: number
          p_tds_amount?: number
          p_tds_rate?: number
        }
        Returns: Json
      }
      record_supplier_payment_atomic: {
        Args: {
          p_amount: number
          p_mode: string
          p_notes?: string
          p_payment_date: string
          p_reference_no?: string
          p_supplier_id: string
        }
        Returns: Json
      }
      user_has_branch_access: {
        Args: { p_branch_id: string; p_user_id: string }
        Returns: boolean
      }
      void_advance_receipt_atomic: {
        Args: { p_reason: string; p_receipt_id: string; p_voided_by: string }
        Returns: undefined
      }
      void_credit_note_atomic: {
        Args: { p_cn_id: string; p_reason: string; p_voided_by: string }
        Returns: undefined
      }
      void_debit_note_atomic: {
        Args: { p_dn_id: string; p_reason: string; p_voided_by: string }
        Returns: undefined
      }
      void_invoice_atomic: {
        Args: { p_invoice_id: string; p_reason: string; p_voided_by: string }
        Returns: undefined
      }
      void_payment_atomic: {
        Args: { p_payment_id: string; p_reason: string; p_voided_by: string }
        Returns: undefined
      }
      void_purchase_invoice_atomic: {
        Args: { p_pi_id: string; p_reason: string; p_voided_by: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "sales"
        | "warehouse"
        | "accounts"
        | "inventory"
        | "fieldops"
      inventory_txn_type:
        | "PURCHASE"
        | "SALE"
        | "SALE_RETURN"
        | "ADJUSTMENT"
        | "PURCHASE_RETURN"
      order_status:
        | "draft"
        | "confirmed"
        | "dispatched"
        | "delivered"
        | "cancelled"
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
        "sales",
        "warehouse",
        "accounts",
        "inventory",
        "fieldops",
      ],
      inventory_txn_type: [
        "PURCHASE",
        "SALE",
        "SALE_RETURN",
        "ADJUSTMENT",
        "PURCHASE_RETURN",
      ],
      order_status: [
        "draft",
        "confirmed",
        "dispatched",
        "delivered",
        "cancelled",
      ],
    },
  },
} as const
