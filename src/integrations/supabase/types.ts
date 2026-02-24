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
          next_cn_number: number
          next_dn_number: number
          next_invoice_number: number
          next_order_number: number
          next_po_number: number
          pan_number: string | null
          phone: string | null
          pincode: string | null
          state: string | null
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
          next_cn_number?: number
          next_dn_number?: number
          next_invoice_number?: number
          next_order_number?: number
          next_po_number?: number
          pan_number?: string | null
          phone?: string | null
          pincode?: string | null
          state?: string | null
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
          next_cn_number?: number
          next_dn_number?: number
          next_invoice_number?: number
          next_order_number?: number
          next_po_number?: number
          pan_number?: string | null
          phone?: string | null
          pincode?: string | null
          state?: string | null
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
          city: string | null
          contact_person: string | null
          created_at: string
          created_by: string | null
          credit_limit: number | null
          email: string | null
          gst_number: string | null
          id: string
          name: string
          payment_terms_days: number | null
          phone: string | null
          pincode: string | null
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
          city?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          credit_limit?: number | null
          email?: string | null
          gst_number?: string | null
          id?: string
          name: string
          payment_terms_days?: number | null
          phone?: string | null
          pincode?: string | null
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
          city?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          credit_limit?: number | null
          email?: string | null
          gst_number?: string | null
          id?: string
          name?: string
          payment_terms_days?: number | null
          phone?: string | null
          pincode?: string | null
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
        Relationships: []
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
      ledger_entries: {
        Row: {
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
          created_at: string
          entity_id: string
          entity_type: string
          fy_id: string
          id: string
          opening_credit: number
          opening_debit: number
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type?: string
          fy_id: string
          id?: string
          opening_credit?: number
          opening_debit?: number
        }
        Update: {
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
          id: string
          order_id: string
          product_id: string
          qty: number
          rate: number
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          order_id: string
          product_id: string
          qty: number
          rate: number
        }
        Update: {
          amount?: number
          created_at?: string
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
          id: string
          invoice_id: string
          payment_id: string
        }
        Insert: {
          allocated_amount: number
          created_at?: string
          id?: string
          invoice_id: string
          payment_id: string
        }
        Update: {
          allocated_amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          payment_id?: string
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
      product_batches: {
        Row: {
          batch_no: string
          created_at: string
          created_by: string | null
          current_qty: number
          exp_date: string | null
          id: string
          mfg_date: string | null
          product_id: string
          purchase_rate: number
          updated_at: string
        }
        Insert: {
          batch_no: string
          created_at?: string
          created_by?: string | null
          current_qty?: number
          exp_date?: string | null
          id?: string
          mfg_date?: string | null
          product_id: string
          purchase_rate?: number
          updated_at?: string
        }
        Update: {
          batch_no?: string
          created_at?: string
          created_by?: string | null
          current_qty?: number
          exp_date?: string | null
          id?: string
          mfg_date?: string | null
          product_id?: string
          purchase_rate?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
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
        Relationships: []
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
          cgst_total: number
          created_at: string
          created_by: string | null
          id: string
          igst_total: number
          notes: string | null
          pi_date: string
          pi_number: string
          purchase_order_id: string | null
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
          cgst_total?: number
          created_at?: string
          created_by?: string | null
          id?: string
          igst_total?: number
          notes?: string | null
          pi_date?: string
          pi_number: string
          purchase_order_id?: string | null
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
          cgst_total?: number
          created_at?: string
          created_by?: string | null
          id?: string
          igst_total?: number
          notes?: string | null
          pi_date?: string
          pi_number?: string
          purchase_order_id?: string | null
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
      supplier_ledger_entries: {
        Row: {
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
        Relationships: []
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_field_order: {
        Args: { _field_order_id: string; _order_number: string }
        Returns: string
      }
      compute_incentive: {
        Args: { _session_id: string; _total_km: number }
        Returns: number
      }
      compute_session_km: { Args: { _session_id: string }; Returns: number }
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
      create_invoice_atomic: {
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
      finalize_duty_session: { Args: { _session_id: string }; Returns: Json }
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
      app_role: "admin" | "sales" | "warehouse" | "accounts" | "inventory"
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
      app_role: ["admin", "sales", "warehouse", "accounts", "inventory"],
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
