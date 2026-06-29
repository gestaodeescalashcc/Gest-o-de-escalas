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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      absence_reasons: {
        Row: {
          active: boolean
          created_at: string
          default_justified: boolean
          description: string | null
          id: string
          name: string
          shift_code: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          default_justified?: boolean
          description?: string | null
          id?: string
          name: string
          shift_code: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          default_justified?: boolean
          description?: string | null
          id?: string
          name?: string
          shift_code?: string
          updated_at?: string
        }
        Relationships: []
      }
      absences: {
        Row: {
          coverage_professional_id: string | null
          created_at: string
          created_by: string | null
          department_id: string | null
          end_date: string
          has_coverage: boolean
          hours_per_day: number | null
          id: string
          is_justified: boolean
          observation: string | null
          professional_id: string
          reason_id: string
          schedule_id: string | null
          shift_type: string | null
          start_date: string
          updated_at: string
        }
        Insert: {
          coverage_professional_id?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          end_date: string
          has_coverage?: boolean
          hours_per_day?: number | null
          id?: string
          is_justified?: boolean
          observation?: string | null
          professional_id: string
          reason_id: string
          schedule_id?: string | null
          shift_type?: string | null
          start_date: string
          updated_at?: string
        }
        Update: {
          coverage_professional_id?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          end_date?: string
          has_coverage?: boolean
          hours_per_day?: number | null
          id?: string
          is_justified?: boolean
          observation?: string | null
          professional_id?: string
          reason_id?: string
          schedule_id?: string | null
          shift_type?: string | null
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "absences_coverage_professional_id_fkey"
            columns: ["coverage_professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absences_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "system_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absences_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absences_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absences_reason_id_fkey"
            columns: ["reason_id"]
            isOneToOne: false
            referencedRelation: "absence_reasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absences_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "monthly_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          changed_fields: string[] | null
          created_at: string | null
          description: string | null
          id: string
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          professional_id: string | null
          record_id: string
          schedule_id: string | null
          shift_date: string | null
          table_name: string
          user_agent: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changed_fields?: string[] | null
          created_at?: string | null
          description?: string | null
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          professional_id?: string | null
          record_id: string
          schedule_id?: string | null
          shift_date?: string | null
          table_name: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changed_fields?: string[] | null
          created_at?: string | null
          description?: string | null
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          professional_id?: string | null
          record_id?: string
          schedule_id?: string | null
          shift_date?: string | null
          table_name?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "monthly_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          active: boolean | null
          cnpj: string | null
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          active?: boolean | null
          cnpj?: string | null
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          active?: boolean | null
          cnpj?: string | null
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          active: boolean
          created_at: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      establishments: {
        Row: {
          active: boolean
          address_city: string
          address_complement: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_state: string
          address_street: string
          address_zip: string
          cei_caepf_cno: string | null
          created_at: string
          employer_document: string
          employer_document_type: string
          employer_name: string
          id: string
          rep_p_registration: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          address_city: string
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state: string
          address_street: string
          address_zip: string
          cei_caepf_cno?: string | null
          created_at?: string
          employer_document: string
          employer_document_type?: string
          employer_name: string
          id?: string
          rep_p_registration?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          address_city?: string
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string
          address_street?: string
          address_zip?: string
          cei_caepf_cno?: string | null
          created_at?: string
          employer_document?: string
          employer_document_type?: string
          employer_name?: string
          id?: string
          rep_p_registration?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      export_jobs: {
        Row: {
          completed_at: string | null
          end_date: string
          error_message: string | null
          establishment_id: string | null
          export_type: string
          file_hash: string | null
          file_url: string | null
          fiscal_protocol: string | null
          id: string
          is_fiscal_request: boolean
          professional_ids: string[] | null
          progress: number | null
          requested_at: string
          requested_by: string
          signature_file_url: string | null
          start_date: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          end_date: string
          error_message?: string | null
          establishment_id?: string | null
          export_type: string
          file_hash?: string | null
          file_url?: string | null
          fiscal_protocol?: string | null
          id?: string
          is_fiscal_request?: boolean
          professional_ids?: string[] | null
          progress?: number | null
          requested_at?: string
          requested_by: string
          signature_file_url?: string | null
          start_date: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          end_date?: string
          error_message?: string | null
          establishment_id?: string | null
          export_type?: string
          file_hash?: string | null
          file_url?: string | null
          fiscal_protocol?: string | null
          id?: string
          is_fiscal_request?: boolean
          professional_ids?: string[] | null
          progress?: number | null
          requested_at?: string
          requested_by?: string
          signature_file_url?: string | null
          start_date?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "export_jobs_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "export_jobs_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "system_users"
            referencedColumns: ["id"]
          },
        ]
      }
      holidays: {
        Row: {
          active: boolean | null
          created_at: string | null
          date: string
          id: string
          name: string
          recurring: boolean | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          date: string
          id?: string
          name: string
          recurring?: boolean | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          date?: string
          id?: string
          name?: string
          recurring?: boolean | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      hour_bank_compensations: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          compensation_date: string
          compensation_type: string
          created_at: string | null
          description: string | null
          entry_ids: string[] | null
          id: string
          minutes_compensated: number
          professional_id: string
          requested_by: string | null
          status: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          compensation_date: string
          compensation_type: string
          created_at?: string | null
          description?: string | null
          entry_ids?: string[] | null
          id?: string
          minutes_compensated: number
          professional_id: string
          requested_by?: string | null
          status?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          compensation_date?: string
          compensation_type?: string
          created_at?: string | null
          description?: string | null
          entry_ids?: string[] | null
          id?: string
          minutes_compensated?: number
          professional_id?: string
          requested_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "hour_bank_compensations_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "system_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hour_bank_compensations_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hour_bank_compensations_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "system_users"
            referencedColumns: ["id"]
          },
        ]
      }
      hour_bank_config: {
        Row: {
          agreement_type: string
          allow_negative_balance: boolean
          auto_calculate: boolean
          company_id: string | null
          compensation_period_months: number
          created_at: string | null
          daily_overtime_limit_minutes: number
          expiration_warning_days: number
          holiday_multiplier: number
          id: string
          is_active: boolean
          max_negative_balance_minutes: number
          monthly_overtime_limit_minutes: number
          night_shift_end: string
          night_shift_multiplier: number
          night_shift_start: string
          overtime_multiplier: number
          sunday_multiplier: number
          updated_at: string | null
          weekly_overtime_limit_minutes: number
        }
        Insert: {
          agreement_type?: string
          allow_negative_balance?: boolean
          auto_calculate?: boolean
          company_id?: string | null
          compensation_period_months?: number
          created_at?: string | null
          daily_overtime_limit_minutes?: number
          expiration_warning_days?: number
          holiday_multiplier?: number
          id?: string
          is_active?: boolean
          max_negative_balance_minutes?: number
          monthly_overtime_limit_minutes?: number
          night_shift_end?: string
          night_shift_multiplier?: number
          night_shift_start?: string
          overtime_multiplier?: number
          sunday_multiplier?: number
          updated_at?: string | null
          weekly_overtime_limit_minutes?: number
        }
        Update: {
          agreement_type?: string
          allow_negative_balance?: boolean
          auto_calculate?: boolean
          company_id?: string | null
          compensation_period_months?: number
          created_at?: string | null
          daily_overtime_limit_minutes?: number
          expiration_warning_days?: number
          holiday_multiplier?: number
          id?: string
          is_active?: boolean
          max_negative_balance_minutes?: number
          monthly_overtime_limit_minutes?: number
          night_shift_end?: string
          night_shift_multiplier?: number
          night_shift_start?: string
          overtime_multiplier?: number
          sunday_multiplier?: number
          updated_at?: string | null
          weekly_overtime_limit_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "hour_bank_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      hour_bank_entries: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          balance_after: number
          compensated_at: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          entry_date: string
          entry_type: string
          expires_at: string | null
          id: string
          minutes: number
          multiplier_applied: number | null
          original_minutes: number | null
          professional_id: string
          punch_record_id: string | null
          source: string
          status: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          balance_after?: number
          compensated_at?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          entry_date: string
          entry_type: string
          expires_at?: string | null
          id?: string
          minutes: number
          multiplier_applied?: number | null
          original_minutes?: number | null
          professional_id: string
          punch_record_id?: string | null
          source?: string
          status?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          balance_after?: number
          compensated_at?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          entry_date?: string
          entry_type?: string
          expires_at?: string | null
          id?: string
          minutes?: number
          multiplier_applied?: number | null
          original_minutes?: number | null
          professional_id?: string
          punch_record_id?: string | null
          source?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "hour_bank_entries_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "system_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hour_bank_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "system_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hour_bank_entries_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hour_bank_entries_punch_record_id_fkey"
            columns: ["punch_record_id"]
            isOneToOne: false
            referencedRelation: "punch_records"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_category_config: {
        Row: {
          category_id: string
          created_at: string | null
          has_meal_benefit: boolean
          id: string
          notes: string | null
          updated_at: string | null
        }
        Insert: {
          category_id: string
          created_at?: string | null
          has_meal_benefit?: boolean
          id?: string
          notes?: string | null
          updated_at?: string | null
        }
        Update: {
          category_id?: string
          created_at?: string | null
          has_meal_benefit?: boolean
          id?: string
          notes?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meal_category_config_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: true
            referencedRelation: "professional_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_schedules: {
        Row: {
          created_by: string | null
          generated_at: string | null
          has_breakfast: boolean | null
          has_dinner: boolean | null
          has_lunch: boolean | null
          has_supper: boolean | null
          id: string
          professional_id: string
          shift_date: string
          shift_hours: number
          shift_id: string
          shift_type: string
          total_meals: number | null
        }
        Insert: {
          created_by?: string | null
          generated_at?: string | null
          has_breakfast?: boolean | null
          has_dinner?: boolean | null
          has_lunch?: boolean | null
          has_supper?: boolean | null
          id?: string
          professional_id: string
          shift_date: string
          shift_hours?: number
          shift_id: string
          shift_type: string
          total_meals?: number | null
        }
        Update: {
          created_by?: string | null
          generated_at?: string | null
          has_breakfast?: boolean | null
          has_dinner?: boolean | null
          has_lunch?: boolean | null
          has_supper?: boolean | null
          id?: string
          professional_id?: string
          shift_date?: string
          shift_hours?: number
          shift_id?: string
          shift_type?: string
          total_meals?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "meal_schedules_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_schedules_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: true
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_schedules: {
        Row: {
          created_at: string | null
          created_by: string | null
          department_id: string
          id: string
          month: string
          name: string
          published_at: string | null
          published_by: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          department_id: string
          id?: string
          month: string
          name: string
          published_at?: string | null
          published_by?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          department_id?: string
          id?: string
          month?: string
          name?: string
          published_at?: string | null
          published_by?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "monthly_schedules_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      nsr_sequences: {
        Row: {
          current_nsr: number
          establishment_id: string
          last_updated_at: string
        }
        Insert: {
          current_nsr?: number
          establishment_id: string
          last_updated_at?: string
        }
        Update: {
          current_nsr?: number
          establishment_id?: string
          last_updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nsr_sequences_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: true
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_categories: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      professional_category_links: {
        Row: {
          category_id: string
          created_at: string
          is_primary: boolean
          professional_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          is_primary?: boolean
          professional_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          is_primary?: boolean
          professional_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_category_links_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "professional_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_category_links_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_department_links: {
        Row: {
          created_at: string
          department_id: string
          is_primary: boolean
          professional_id: string
        }
        Insert: {
          created_at?: string
          department_id: string
          is_primary?: boolean
          professional_id: string
        }
        Update: {
          created_at?: string
          department_id?: string
          is_primary?: boolean
          professional_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_department_links_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_department_links_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_facial_data: {
        Row: {
          created_at: string | null
          facial_descriptors: Json | null
          facial_image_url: string | null
          id: string
          professional_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          facial_descriptors?: Json | null
          facial_image_url?: string | null
          id?: string
          professional_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          facial_descriptors?: Json | null
          facial_image_url?: string | null
          id?: string
          professional_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "professional_facial_data_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: true
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      professionals: {
        Row: {
          active: boolean | null
          block_separator_after: boolean
          category_id: string | null
          company_id: string | null
          contracted_hours_per_month: number
          coren: string | null
          cpf: string | null
          created_at: string | null
          department_id: string | null
          display_order: number | null
          email: string | null
          establishment_id: string | null
          full_name: string
          hire_date: string | null
          id: string
          leave_reason: string | null
          leave_started_at: string | null
          on_leave: boolean
          phone: string | null
          pis_number: string | null
          registration_number: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          active?: boolean | null
          block_separator_after?: boolean
          category_id?: string | null
          company_id?: string | null
          contracted_hours_per_month?: number
          coren?: string | null
          cpf?: string | null
          created_at?: string | null
          department_id?: string | null
          display_order?: number | null
          email?: string | null
          establishment_id?: string | null
          full_name: string
          hire_date?: string | null
          id?: string
          leave_reason?: string | null
          leave_started_at?: string | null
          on_leave?: boolean
          phone?: string | null
          pis_number?: string | null
          registration_number?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          active?: boolean | null
          block_separator_after?: boolean
          category_id?: string | null
          company_id?: string | null
          contracted_hours_per_month?: number
          coren?: string | null
          cpf?: string | null
          created_at?: string | null
          department_id?: string | null
          display_order?: number | null
          email?: string | null
          establishment_id?: string | null
          full_name?: string
          hire_date?: string | null
          id?: string
          leave_reason?: string | null
          leave_started_at?: string | null
          on_leave?: boolean
          phone?: string | null
          pis_number?: string | null
          registration_number?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "professionals_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "professional_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professionals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professionals_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professionals_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      punch_adjustments: {
        Row: {
          adjusted_datetime: string | null
          adjusted_punch_type: string | null
          adjustment_hash: string
          adjustment_type: string
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          created_at: string
          establishment_id: string
          id: string
          justification: string
          original_punch_id: string | null
          professional_id: string
          rejection_reason: string | null
          requested_at: string
          requested_by: string
          supporting_document_url: string | null
        }
        Insert: {
          adjusted_datetime?: string | null
          adjusted_punch_type?: string | null
          adjustment_hash: string
          adjustment_type: string
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          establishment_id: string
          id?: string
          justification: string
          original_punch_id?: string | null
          professional_id: string
          rejection_reason?: string | null
          requested_at?: string
          requested_by: string
          supporting_document_url?: string | null
        }
        Update: {
          adjusted_datetime?: string | null
          adjusted_punch_type?: string | null
          adjustment_hash?: string
          adjustment_type?: string
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          establishment_id?: string
          id?: string
          justification?: string
          original_punch_id?: string | null
          professional_id?: string
          rejection_reason?: string | null
          requested_at?: string
          requested_by?: string
          supporting_document_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "punch_adjustments_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "system_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "punch_adjustments_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "punch_adjustments_original_punch_id_fkey"
            columns: ["original_punch_id"]
            isOneToOne: false
            referencedRelation: "punch_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "punch_adjustments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "punch_adjustments_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "system_users"
            referencedColumns: ["id"]
          },
        ]
      }
      punch_audit_log: {
        Row: {
          action: string
          action_details: Json | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          ip_address: unknown
          user_agent: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          action_details?: Json | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          ip_address?: unknown
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          action_details?: Json | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          ip_address?: unknown
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      punch_receipts: {
        Row: {
          access_count: number
          accessed_at: string | null
          created_at: string
          id: string
          pdf_hash: string | null
          pdf_url: string | null
          punch_record_id: string
          receipt_content: Json
          signature_type: string | null
          signed_at: string | null
          verification_code: string
          verification_url: string | null
        }
        Insert: {
          access_count?: number
          accessed_at?: string | null
          created_at?: string
          id?: string
          pdf_hash?: string | null
          pdf_url?: string | null
          punch_record_id: string
          receipt_content: Json
          signature_type?: string | null
          signed_at?: string | null
          verification_code: string
          verification_url?: string | null
        }
        Update: {
          access_count?: number
          accessed_at?: string | null
          created_at?: string
          id?: string
          pdf_hash?: string | null
          pdf_url?: string | null
          punch_record_id?: string
          receipt_content?: Json
          signature_type?: string | null
          signed_at?: string | null
          verification_code?: string
          verification_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "punch_receipts_punch_record_id_fkey"
            columns: ["punch_record_id"]
            isOneToOne: false
            referencedRelation: "punch_records"
            referencedColumns: ["id"]
          },
        ]
      }
      punch_records: {
        Row: {
          biometric_confidence: number | null
          biometric_verification_id: string | null
          created_at: string
          device_id: string | null
          device_type: string | null
          establishment_id: string
          geo_accuracy: number | null
          id: string
          ip_address: unknown
          is_online: boolean
          is_outside_schedule: boolean
          latitude: number | null
          liveness_verified: boolean
          longitude: number | null
          nsr: number
          photo_hash: string | null
          photo_url: string | null
          previous_hash: string | null
          previous_record_id: string | null
          professional_id: string
          punch_datetime: string
          punch_type: string
          record_hash: string
          schedule_alert: string | null
          server_datetime: string
          timezone: string
          user_agent: string | null
        }
        Insert: {
          biometric_confidence?: number | null
          biometric_verification_id?: string | null
          created_at?: string
          device_id?: string | null
          device_type?: string | null
          establishment_id: string
          geo_accuracy?: number | null
          id?: string
          ip_address?: unknown
          is_online?: boolean
          is_outside_schedule?: boolean
          latitude?: number | null
          liveness_verified?: boolean
          longitude?: number | null
          nsr: number
          photo_hash?: string | null
          photo_url?: string | null
          previous_hash?: string | null
          previous_record_id?: string | null
          professional_id: string
          punch_datetime: string
          punch_type: string
          record_hash: string
          schedule_alert?: string | null
          server_datetime?: string
          timezone?: string
          user_agent?: string | null
        }
        Update: {
          biometric_confidence?: number | null
          biometric_verification_id?: string | null
          created_at?: string
          device_id?: string | null
          device_type?: string | null
          establishment_id?: string
          geo_accuracy?: number | null
          id?: string
          ip_address?: unknown
          is_online?: boolean
          is_outside_schedule?: boolean
          latitude?: number | null
          liveness_verified?: boolean
          longitude?: number | null
          nsr?: number
          photo_hash?: string | null
          photo_url?: string | null
          previous_hash?: string | null
          previous_record_id?: string | null
          professional_id?: string
          punch_datetime?: string
          punch_type?: string
          record_hash?: string
          schedule_alert?: string | null
          server_datetime?: string
          timezone?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "punch_records_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "punch_records_previous_record_id_fkey"
            columns: ["previous_record_id"]
            isOneToOne: false
            referencedRelation: "punch_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "punch_records_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_professional_links: {
        Row: {
          added_at: string
          added_by: string | null
          professional_id: string
          schedule_id: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          professional_id: string
          schedule_id: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          professional_id?: string
          schedule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_professional_links_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_professional_links_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "monthly_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_history: {
        Row: {
          action_type: string
          created_at: string | null
          details: Json | null
          id: string
          performed_by: string | null
          shift_id: string | null
        }
        Insert: {
          action_type: string
          created_at?: string | null
          details?: Json | null
          id?: string
          performed_by?: string | null
          shift_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          performed_by?: string | null
          shift_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shift_history_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_swaps: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          id: string
          notes: string | null
          offered_shift_id: string | null
          original_shift_id: string | null
          reason: string
          requested_at: string | null
          requesting_professional_id: string | null
          responded_at: string | null
          status: string | null
          target_professional_id: string | null
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          offered_shift_id?: string | null
          original_shift_id?: string | null
          reason: string
          requested_at?: string | null
          requesting_professional_id?: string | null
          responded_at?: string | null
          status?: string | null
          target_professional_id?: string | null
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          offered_shift_id?: string | null
          original_shift_id?: string | null
          reason?: string
          requested_at?: string | null
          requesting_professional_id?: string | null
          responded_at?: string | null
          status?: string | null
          target_professional_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shift_swaps_offered_shift_id_fkey"
            columns: ["offered_shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swaps_original_shift_id_fkey"
            columns: ["original_shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swaps_requesting_professional_id_fkey"
            columns: ["requesting_professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swaps_target_professional_id_fkey"
            columns: ["target_professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          company_id: string | null
          created_at: string | null
          created_by: string | null
          deleted_in_realizada_at: string | null
          department_id: string | null
          end_time: string
          id: string
          notes: string | null
          original_company_id: string | null
          original_end_time: string | null
          original_professional_id: string | null
          original_shift_type: string | null
          original_start_time: string | null
          professional_id: string | null
          published_at: string | null
          schedule_id: string | null
          shift_date: string
          shift_type: string
          start_time: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_in_realizada_at?: string | null
          department_id?: string | null
          end_time: string
          id?: string
          notes?: string | null
          original_company_id?: string | null
          original_end_time?: string | null
          original_professional_id?: string | null
          original_shift_type?: string | null
          original_start_time?: string | null
          professional_id?: string | null
          published_at?: string | null
          schedule_id?: string | null
          shift_date: string
          shift_type: string
          start_time: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_in_realizada_at?: string | null
          department_id?: string | null
          end_time?: string
          id?: string
          notes?: string | null
          original_company_id?: string | null
          original_end_time?: string | null
          original_professional_id?: string | null
          original_shift_type?: string | null
          original_start_time?: string | null
          professional_id?: string | null
          published_at?: string | null
          schedule_id?: string | null
          shift_date?: string
          shift_type?: string
          start_time?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shifts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "monthly_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      system_users: {
        Row: {
          active: boolean | null
          allowed_departments: string[] | null
          created_at: string | null
          created_by: string | null
          email: string
          full_name: string
          id: string
          last_login: string | null
          role_id: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          allowed_departments?: string[] | null
          created_at?: string | null
          created_by?: string | null
          email: string
          full_name: string
          id: string
          last_login?: string | null
          role_id: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          allowed_departments?: string[] | null
          created_at?: string | null
          created_by?: string | null
          email?: string
          full_name?: string
          id?: string
          last_login?: string | null
          role_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_users_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "system_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_users_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "user_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheet_records: {
        Row: {
          check_in_photo_url: string
          check_in_time: string
          check_out_photo_url: string | null
          check_out_time: string | null
          created_at: string | null
          id: string
          meal_break_end: string | null
          meal_break_end_photo_url: string | null
          meal_break_start: string | null
          meal_break_start_photo_url: string | null
          notes: string | null
          professional_id: string
          shift_id: string | null
          status: string
        }
        Insert: {
          check_in_photo_url: string
          check_in_time?: string
          check_out_photo_url?: string | null
          check_out_time?: string | null
          created_at?: string | null
          id?: string
          meal_break_end?: string | null
          meal_break_end_photo_url?: string | null
          meal_break_start?: string | null
          meal_break_start_photo_url?: string | null
          notes?: string | null
          professional_id: string
          shift_id?: string | null
          status?: string
        }
        Update: {
          check_in_photo_url?: string
          check_in_time?: string
          check_out_photo_url?: string | null
          check_out_time?: string | null
          created_at?: string | null
          id?: string
          meal_break_end?: string | null
          meal_break_end_photo_url?: string | null
          meal_break_start?: string | null
          meal_break_start_photo_url?: string | null
          notes?: string | null
          professional_id?: string
          shift_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "timesheet_records_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_records_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          description: string
          id: string
          name: string
          permissions: Json
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description: string
          id?: string
          name: string
          permissions?: Json
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string
          id?: string
          name?: string
          permissions?: Json
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_shift_swap: {
        Args: { p_swap_id: string }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          id: string
          notes: string | null
          offered_shift_id: string | null
          original_shift_id: string | null
          reason: string
          requested_at: string | null
          requesting_professional_id: string | null
          responded_at: string | null
          status: string | null
          target_professional_id: string | null
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "shift_swaps"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      audit_describe: {
        Args: {
          p_changed: string[]
          p_new: Json
          p_old: Json
          p_op: string
          p_table: string
        }
        Returns: string
      }
      audit_prof_name: { Args: { p_id: string }; Returns: string }
      audit_shift_code: { Args: { p_shift_type: string }; Returns: string }
      calculate_punch_hash: {
        Args: {
          p_nsr: number
          p_previous_hash?: string
          p_professional_id: string
          p_punch_datetime: string
          p_punch_type: string
        }
        Returns: string
      }
      create_and_apply_swap: {
        Args: {
          p_offered_shift_id: string
          p_original_shift_id: string
          p_reason: string
          p_requesting_professional_id: string
          p_target_professional_id: string
        }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          id: string
          notes: string | null
          offered_shift_id: string | null
          original_shift_id: string | null
          reason: string
          requested_at: string | null
          requesting_professional_id: string | null
          responded_at: string | null
          status: string | null
          target_professional_id: string | null
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "shift_swaps"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      finalize_schedule_planning: {
        Args: { p_schedule_id: string }
        Returns: Json
      }
      first_last: { Args: { s: string }; Returns: string }
      generate_audit_description: {
        Args: {
          p_changed_fields: string[]
          p_new_data: Json
          p_old_data: Json
          p_operation: string
          p_table_name: string
        }
        Returns: string
      }
      get_changed_fields: {
        Args: { new_data: Json; old_data: Json }
        Returns: string[]
      }
      get_next_nsr: { Args: { p_establishment_id: string }; Returns: number }
      get_punch_records_for_verification: {
        Args: {
          p_end_date?: string
          p_establishment_id?: string
          p_professional_id?: string
          p_start_date?: string
        }
        Returns: {
          is_online: boolean
          nsr: number
          pis_number: string
          professional_name: string
          punch_datetime: string
          punch_type: string
          record_hash: string
        }[]
      }
      link_doctor_account: { Args: { p_full_name: string }; Returns: Json }
      norm_first_last: { Args: { s: string }; Returns: string }
      norm_name: { Args: { s: string }; Returns: string }
      publish_schedule: { Args: { p_schedule_id: string }; Returns: Json }
      reject_shift_swap: {
        Args: { p_reason: string; p_swap_id: string }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          id: string
          notes: string | null
          offered_shift_id: string | null
          original_shift_id: string | null
          reason: string
          requested_at: string | null
          requesting_professional_id: string | null
          responded_at: string | null
          status: string | null
          target_professional_id: string | null
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "shift_swaps"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reopen_schedule_planning: {
        Args: { p_schedule_id: string }
        Returns: Json
      }
      resolve_login_identifier: {
        Args: { p_identifier: string }
        Returns: string
      }
      unaccent: { Args: { "": string }; Returns: string }
      unpublish_schedule: { Args: { p_schedule_id: string }; Returns: Json }
      user_has_permission: {
        Args: { p_action: string; p_module: string }
        Returns: boolean
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
