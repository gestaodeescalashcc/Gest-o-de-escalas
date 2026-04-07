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
      audit_logs: {
        Row: {
          id: string
          table_name: string
          record_id: string
          action: string
          old_data: Json | null
          new_data: Json | null
          changed_fields: string[] | null
          user_id: string | null
          user_email: string | null
          ip_address: string | null
          user_agent: string | null
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          table_name: string
          record_id: string
          action: string
          old_data?: Json | null
          new_data?: Json | null
          changed_fields?: string[] | null
          user_id?: string | null
          user_email?: string | null
          ip_address?: string | null
          user_agent?: string | null
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          table_name?: string
          record_id?: string
          action?: string
          old_data?: Json | null
          new_data?: Json | null
          changed_fields?: string[] | null
          user_id?: string | null
          user_email?: string | null
          ip_address?: string | null
          user_agent?: string | null
          description?: string | null
          created_at?: string
        }
      }
      companies: {
        Row: {
          id: string
          name: string
          cnpj: string | null
          active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          cnpj?: string | null
          active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          cnpj?: string | null
          active?: boolean
          created_at?: string
        }
      }
      departments: {
        Row: {
          id: string
          name: string
          description: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string
          created_at?: string
        }
      }
      holidays: {
        Row: {
          id: string
          type: string
          name: string
          date: string
          recurring: boolean
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          type?: string
          name: string
          date: string
          recurring?: boolean
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          type?: string
          name?: string
          date?: string
          recurring?: boolean
          active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      meal_category_config: {
        Row: {
          id: string
          category_id: string
          has_meal_benefit: boolean
          notes: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          category_id: string
          has_meal_benefit?: boolean
          notes?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          category_id?: string
          has_meal_benefit?: boolean
          notes?: string
          created_at?: string
          updated_at?: string
        }
      }
      meal_schedules: {
        Row: {
          id: string
          shift_id: string
          professional_id: string
          shift_date: string
          shift_type: string
          shift_hours: number
          has_breakfast: boolean
          has_lunch: boolean
          has_dinner: boolean
          has_supper: boolean
          total_meals: number
          created_by: string | null
          generated_at: string
        }
        Insert: {
          id?: string
          shift_id: string
          professional_id: string
          shift_date: string
          shift_type: string
          shift_hours?: number
          has_breakfast?: boolean
          has_lunch?: boolean
          has_dinner?: boolean
          has_supper?: boolean
          total_meals?: number
          created_by?: string | null
          generated_at?: string
        }
        Update: {
          id?: string
          shift_id?: string
          professional_id?: string
          shift_date?: string
          shift_type?: string
          shift_hours?: number
          has_breakfast?: boolean
          has_lunch?: boolean
          has_dinner?: boolean
          has_supper?: boolean
          total_meals?: number
          created_by?: string | null
          generated_at?: string
        }
      }
      monthly_schedules: {
        Row: {
          id: string
          department_id: string
          month: string
          name: string
          status: string
          published_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          department_id: string
          month: string
          name: string
          status?: string
          published_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          department_id?: string
          month?: string
          name?: string
          status?: string
          published_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      professional_categories: {
        Row: {
          id: string
          name: string
          color: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          color?: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          color?: string
          created_at?: string
        }
      }
      professional_facial_data: {
        Row: {
          id: string
          professional_id: string
          facial_image_url: string | null
          facial_descriptors: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          professional_id: string
          facial_image_url?: string | null
          facial_descriptors?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          professional_id?: string
          facial_image_url?: string | null
          facial_descriptors?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      professionals: {
        Row: {
          id: string
          user_id: string | null
          full_name: string
          category_id: string
          department_id: string
          company_id: string | null
          registration_number: string | null
          phone: string | null
          email: string | null
          contracted_hours_per_month: number
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          full_name: string
          category_id: string
          department_id: string
          company_id?: string | null
          registration_number?: string | null
          phone?: string | null
          email?: string | null
          contracted_hours_per_month?: number
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          full_name?: string
          category_id?: string
          department_id?: string
          company_id?: string | null
          registration_number?: string | null
          phone?: string | null
          email?: string | null
          contracted_hours_per_month?: number
          active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      shifts: {
        Row: {
          id: string
          professional_id: string
          department_id: string
          shift_date: string
          start_time: string
          end_time: string
          shift_type: string
          status: string
          notes: string
          schedule_id: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          professional_id: string
          department_id: string
          shift_date: string
          start_time: string
          end_time: string
          shift_type: string
          status?: string
          notes?: string
          schedule_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          professional_id?: string
          department_id?: string
          shift_date?: string
          start_time?: string
          end_time?: string
          shift_type?: string
          status?: string
          notes?: string
          schedule_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      shift_history: {
        Row: {
          id: string
          shift_id: string
          action_type: string
          performed_by: string | null
          details: Json
          created_at: string
        }
        Insert: {
          id?: string
          shift_id: string
          action_type: string
          performed_by?: string | null
          details?: Json
          created_at?: string
        }
        Update: {
          id?: string
          shift_id?: string
          action_type?: string
          performed_by?: string | null
          details?: Json
          created_at?: string
        }
      }
      shift_swaps: {
        Row: {
          id: string
          original_shift_id: string
          requesting_professional_id: string
          target_professional_id: string
          offered_shift_id: string | null
          reason: string
          status: string
          requested_at: string
          responded_at: string | null
          approved_by: string | null
          approved_at: string | null
          notes: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          original_shift_id: string
          requesting_professional_id: string
          target_professional_id: string
          offered_shift_id?: string | null
          reason: string
          status?: string
          requested_at?: string
          responded_at?: string | null
          approved_by?: string | null
          approved_at?: string | null
          notes?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          original_shift_id?: string
          requesting_professional_id?: string
          target_professional_id?: string
          offered_shift_id?: string | null
          reason?: string
          status?: string
          requested_at?: string
          responded_at?: string | null
          approved_by?: string | null
          approved_at?: string | null
          notes?: string
          created_at?: string
          updated_at?: string
        }
      }
      system_users: {
        Row: {
          id: string
          email: string
          full_name: string
          role_id: string
          allowed_departments: string[] | null
          active: boolean
          last_login: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name: string
          role_id: string
          allowed_departments?: string[] | null
          active?: boolean
          last_login?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          role_id?: string
          allowed_departments?: string[] | null
          active?: boolean
          last_login?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      timesheet_records: {
        Row: {
          id: string
          professional_id: string
          shift_id: string | null
          check_in_time: string
          check_out_time: string | null
          check_in_photo_url: string
          check_out_photo_url: string | null
          meal_break_start: string | null
          meal_break_end: string | null
          meal_break_start_photo_url: string | null
          meal_break_end_photo_url: string | null
          status: string
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          professional_id: string
          shift_id?: string | null
          check_in_time?: string
          check_out_time?: string | null
          check_in_photo_url: string
          check_out_photo_url?: string | null
          meal_break_start?: string | null
          meal_break_end?: string | null
          meal_break_start_photo_url?: string | null
          meal_break_end_photo_url?: string | null
          status?: string
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          professional_id?: string
          shift_id?: string | null
          check_in_time?: string
          check_out_time?: string | null
          check_in_photo_url?: string
          check_out_photo_url?: string | null
          meal_break_start?: string | null
          meal_break_end?: string | null
          meal_break_start_photo_url?: string | null
          meal_break_end_photo_url?: string | null
          status?: string
          notes?: string | null
          created_at?: string
        }
      }
      user_roles: {
        Row: {
          id: string
          name: string
          description: string
          permissions: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description: string
          permissions?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string
          permissions?: Json
          created_at?: string
          updated_at?: string
        }
      }
      hour_bank_config: {
        Row: {
          id: string
          company_id: string | null
          agreement_type: 'individual' | 'coletivo' | 'mensal'
          compensation_period_months: 1 | 6 | 12
          daily_overtime_limit_minutes: number
          weekly_overtime_limit_minutes: number
          monthly_overtime_limit_minutes: number
          overtime_multiplier: number
          sunday_multiplier: number
          holiday_multiplier: number
          night_shift_multiplier: number
          night_shift_start: string
          night_shift_end: string
          allow_negative_balance: boolean
          max_negative_balance_minutes: number
          auto_calculate: boolean
          expiration_warning_days: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id?: string | null
          agreement_type?: 'individual' | 'coletivo' | 'mensal'
          compensation_period_months?: 1 | 6 | 12
          daily_overtime_limit_minutes?: number
          weekly_overtime_limit_minutes?: number
          monthly_overtime_limit_minutes?: number
          overtime_multiplier?: number
          sunday_multiplier?: number
          holiday_multiplier?: number
          night_shift_multiplier?: number
          night_shift_start?: string
          night_shift_end?: string
          allow_negative_balance?: boolean
          max_negative_balance_minutes?: number
          auto_calculate?: boolean
          expiration_warning_days?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string | null
          agreement_type?: 'individual' | 'coletivo' | 'mensal'
          compensation_period_months?: 1 | 6 | 12
          daily_overtime_limit_minutes?: number
          weekly_overtime_limit_minutes?: number
          monthly_overtime_limit_minutes?: number
          overtime_multiplier?: number
          sunday_multiplier?: number
          holiday_multiplier?: number
          night_shift_multiplier?: number
          night_shift_start?: string
          night_shift_end?: string
          allow_negative_balance?: boolean
          max_negative_balance_minutes?: number
          auto_calculate?: boolean
          expiration_warning_days?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      hour_bank_entries: {
        Row: {
          id: string
          professional_id: string
          entry_date: string
          entry_type: 'credit' | 'debit' | 'compensation' | 'expiration' | 'adjustment'
          minutes: number
          balance_after: number
          source: 'automatic' | 'manual' | 'compensation' | 'system'
          punch_record_id: string | null
          description: string | null
          multiplier_applied: number
          original_minutes: number | null
          expires_at: string | null
          compensated_at: string | null
          created_by: string | null
          approved_by: string | null
          approved_at: string | null
          status: 'pending' | 'approved' | 'rejected' | 'expired' | 'compensated'
          created_at: string
        }
        Insert: {
          id?: string
          professional_id: string
          entry_date: string
          entry_type: 'credit' | 'debit' | 'compensation' | 'expiration' | 'adjustment'
          minutes: number
          balance_after?: number
          source?: 'automatic' | 'manual' | 'compensation' | 'system'
          punch_record_id?: string | null
          description?: string | null
          multiplier_applied?: number
          original_minutes?: number | null
          expires_at?: string | null
          compensated_at?: string | null
          created_by?: string | null
          approved_by?: string | null
          approved_at?: string | null
          status?: 'pending' | 'approved' | 'rejected' | 'expired' | 'compensated'
          created_at?: string
        }
        Update: {
          id?: string
          professional_id?: string
          entry_date?: string
          entry_type?: 'credit' | 'debit' | 'compensation' | 'expiration' | 'adjustment'
          minutes?: number
          balance_after?: number
          source?: 'automatic' | 'manual' | 'compensation' | 'system'
          punch_record_id?: string | null
          description?: string | null
          multiplier_applied?: number
          original_minutes?: number | null
          expires_at?: string | null
          compensated_at?: string | null
          created_by?: string | null
          approved_by?: string | null
          approved_at?: string | null
          status?: 'pending' | 'approved' | 'rejected' | 'expired' | 'compensated'
          created_at?: string
        }
      }
      hour_bank_compensations: {
        Row: {
          id: string
          professional_id: string
          compensation_date: string
          minutes_compensated: number
          compensation_type: 'folga' | 'saida_antecipada' | 'entrada_tardia' | 'dia_parcial'
          description: string | null
          entry_ids: string[]
          requested_by: string | null
          approved_by: string | null
          approved_at: string | null
          status: 'pending' | 'approved' | 'rejected' | 'cancelled'
          created_at: string
        }
        Insert: {
          id?: string
          professional_id: string
          compensation_date: string
          minutes_compensated: number
          compensation_type: 'folga' | 'saida_antecipada' | 'entrada_tardia' | 'dia_parcial'
          description?: string | null
          entry_ids?: string[]
          requested_by?: string | null
          approved_by?: string | null
          approved_at?: string | null
          status?: 'pending' | 'approved' | 'rejected' | 'cancelled'
          created_at?: string
        }
        Update: {
          id?: string
          professional_id?: string
          compensation_date?: string
          minutes_compensated?: number
          compensation_type?: 'folga' | 'saida_antecipada' | 'entrada_tardia' | 'dia_parcial'
          description?: string | null
          entry_ids?: string[]
          requested_by?: string | null
          approved_by?: string | null
          approved_at?: string | null
          status?: 'pending' | 'approved' | 'rejected' | 'cancelled'
          created_at?: string
        }
      }
    }
  }
}
