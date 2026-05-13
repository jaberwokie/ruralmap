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
      facilities: {
        Row: {
          access_notes: string | null
          access_type: string | null
          city: string | null
          classification: string | null
          county: string | null
          created_at: string
          data_confidence: string | null
          id: string
          inpatient: Json | null
          lat: number | null
          lng: number | null
          mappable: boolean
          name: string
          notes: string | null
          operational: Json | null
          phone: string | null
          psychiatric: Json | null
          review_status: string
          service: string | null
          state: string | null
          street_address: string | null
          tier: string | null
          type: string
          updated_at: string
          verification_status: string
          volume: number | null
          website: string | null
          zip: string | null
        }
        Insert: {
          access_notes?: string | null
          access_type?: string | null
          city?: string | null
          classification?: string | null
          county?: string | null
          created_at?: string
          data_confidence?: string | null
          id: string
          inpatient?: Json | null
          lat?: number | null
          lng?: number | null
          mappable?: boolean
          name: string
          notes?: string | null
          operational?: Json | null
          phone?: string | null
          psychiatric?: Json | null
          review_status?: string
          service?: string | null
          state?: string | null
          street_address?: string | null
          tier?: string | null
          type: string
          updated_at?: string
          verification_status?: string
          volume?: number | null
          website?: string | null
          zip?: string | null
        }
        Update: {
          access_notes?: string | null
          access_type?: string | null
          city?: string | null
          classification?: string | null
          county?: string | null
          created_at?: string
          data_confidence?: string | null
          id?: string
          inpatient?: Json | null
          lat?: number | null
          lng?: number | null
          mappable?: boolean
          name?: string
          notes?: string | null
          operational?: Json | null
          phone?: string | null
          psychiatric?: Json | null
          review_status?: string
          service?: string | null
          state?: string | null
          street_address?: string | null
          tier?: string | null
          type?: string
          updated_at?: string
          verification_status?: string
          volume?: number | null
          website?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      mapping_audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          details: Json
          id: string
          import_batch_id: string | null
          pipeline: string
          target_row_id: string | null
          target_table: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          import_batch_id?: string | null
          pipeline: string
          target_row_id?: string | null
          target_table?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          import_batch_id?: string | null
          pipeline?: string
          target_row_id?: string | null
          target_table?: string | null
        }
        Relationships: []
      }
      pending_admin_emails: {
        Row: {
          created_at: string
          email: string
        }
        Insert: {
          created_at?: string
          email: string
        }
        Update: {
          created_at?: string
          email?: string
        }
        Relationships: []
      }
      rural_services: {
        Row: {
          access_notes: string | null
          bh_category_mapped: string | null
          bh_entity_type: string | null
          bh_service_type: string | null
          category: string
          city: string | null
          county: string | null
          created_at: string
          id: string
          lat: number | null
          lng: number | null
          mappable: boolean
          name: string
          notes: string | null
          operational: Json | null
          operational_service_class: string | null
          phone: string | null
          review_status: string
          service_tags: string | null
          state: string | null
          street_address: string | null
          updated_at: string
          verification_status: string
          website: string | null
          zip: string | null
        }
        Insert: {
          access_notes?: string | null
          bh_category_mapped?: string | null
          bh_entity_type?: string | null
          bh_service_type?: string | null
          category: string
          city?: string | null
          county?: string | null
          created_at?: string
          id: string
          lat?: number | null
          lng?: number | null
          mappable?: boolean
          name: string
          notes?: string | null
          operational?: Json | null
          operational_service_class?: string | null
          phone?: string | null
          review_status?: string
          service_tags?: string | null
          state?: string | null
          street_address?: string | null
          updated_at?: string
          verification_status?: string
          website?: string | null
          zip?: string | null
        }
        Update: {
          access_notes?: string | null
          bh_category_mapped?: string | null
          bh_entity_type?: string | null
          bh_service_type?: string | null
          category?: string
          city?: string | null
          county?: string | null
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          mappable?: boolean
          name?: string
          notes?: string | null
          operational?: Json | null
          operational_service_class?: string | null
          phone?: string | null
          review_status?: string
          service_tags?: string | null
          state?: string | null
          street_address?: string | null
          updated_at?: string
          verification_status?: string
          website?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      staging_bh: {
        Row: {
          accepts_new_patients: boolean | null
          access_notes: string | null
          active_status: boolean
          age_groups_served: string | null
          appointment_required: boolean | null
          bh_entity_type: string | null
          bh_service_type: string | null
          category_mapped: string | null
          category_raw: string | null
          city: string | null
          county: string | null
          created_at: string
          crisis_capable: boolean | null
          description: string | null
          detox_capable: boolean | null
          facility_type: string | null
          fax: string | null
          hours_of_operation: string | null
          id: string
          import_batch_id: string | null
          languages_supported: string | null
          last_reviewed_at: string | null
          latitude: number | null
          license_type: string | null
          longitude: number | null
          mat_capable: boolean | null
          medicaid_participation_status: string | null
          name: string
          npi: string | null
          organization_name: string | null
          outpatient_capable: boolean | null
          payer_notes: string | null
          phone: string | null
          populations_served: string | null
          referral_required: boolean | null
          residential_capable: boolean | null
          review_status: string
          service_tags: string | null
          source_file_name: string | null
          source_row_number: number | null
          specialties: string | null
          state: string | null
          street_address: string | null
          telehealth_available: boolean | null
          updated_at: string
          validation_messages: Json
          validation_severity: string | null
          verification_confidence: string | null
          verification_date: string | null
          verification_source: string | null
          verification_status: string
          walk_in_allowed: boolean | null
          website: string | null
          zip: string | null
        }
        Insert: {
          accepts_new_patients?: boolean | null
          access_notes?: string | null
          active_status?: boolean
          age_groups_served?: string | null
          appointment_required?: boolean | null
          bh_entity_type?: string | null
          bh_service_type?: string | null
          category_mapped?: string | null
          category_raw?: string | null
          city?: string | null
          county?: string | null
          created_at?: string
          crisis_capable?: boolean | null
          description?: string | null
          detox_capable?: boolean | null
          facility_type?: string | null
          fax?: string | null
          hours_of_operation?: string | null
          id?: string
          import_batch_id?: string | null
          languages_supported?: string | null
          last_reviewed_at?: string | null
          latitude?: number | null
          license_type?: string | null
          longitude?: number | null
          mat_capable?: boolean | null
          medicaid_participation_status?: string | null
          name: string
          npi?: string | null
          organization_name?: string | null
          outpatient_capable?: boolean | null
          payer_notes?: string | null
          phone?: string | null
          populations_served?: string | null
          referral_required?: boolean | null
          residential_capable?: boolean | null
          review_status?: string
          service_tags?: string | null
          source_file_name?: string | null
          source_row_number?: number | null
          specialties?: string | null
          state?: string | null
          street_address?: string | null
          telehealth_available?: boolean | null
          updated_at?: string
          validation_messages?: Json
          validation_severity?: string | null
          verification_confidence?: string | null
          verification_date?: string | null
          verification_source?: string | null
          verification_status?: string
          walk_in_allowed?: boolean | null
          website?: string | null
          zip?: string | null
        }
        Update: {
          accepts_new_patients?: boolean | null
          access_notes?: string | null
          active_status?: boolean
          age_groups_served?: string | null
          appointment_required?: boolean | null
          bh_entity_type?: string | null
          bh_service_type?: string | null
          category_mapped?: string | null
          category_raw?: string | null
          city?: string | null
          county?: string | null
          created_at?: string
          crisis_capable?: boolean | null
          description?: string | null
          detox_capable?: boolean | null
          facility_type?: string | null
          fax?: string | null
          hours_of_operation?: string | null
          id?: string
          import_batch_id?: string | null
          languages_supported?: string | null
          last_reviewed_at?: string | null
          latitude?: number | null
          license_type?: string | null
          longitude?: number | null
          mat_capable?: boolean | null
          medicaid_participation_status?: string | null
          name?: string
          npi?: string | null
          organization_name?: string | null
          outpatient_capable?: boolean | null
          payer_notes?: string | null
          phone?: string | null
          populations_served?: string | null
          referral_required?: boolean | null
          residential_capable?: boolean | null
          review_status?: string
          service_tags?: string | null
          source_file_name?: string | null
          source_row_number?: number | null
          specialties?: string | null
          state?: string | null
          street_address?: string | null
          telehealth_available?: boolean | null
          updated_at?: string
          validation_messages?: Json
          validation_severity?: string | null
          verification_confidence?: string | null
          verification_date?: string | null
          verification_source?: string | null
          verification_status?: string
          walk_in_allowed?: boolean | null
          website?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      staging_providers: {
        Row: {
          access_notes: string | null
          active_status: boolean
          city: string | null
          county: string | null
          created_at: string
          id: string
          import_batch_id: string | null
          latitude: number | null
          longitude: number | null
          name: string
          notes: string | null
          npi: string | null
          organization_name: string | null
          phone: string | null
          provider_name: string | null
          review_status: string
          source_file_name: string | null
          source_row_number: number | null
          state: string | null
          street_address: string | null
          type: string | null
          updated_at: string
          validation_messages: Json
          validation_severity: string | null
          website: string | null
          zip: string | null
        }
        Insert: {
          access_notes?: string | null
          active_status?: boolean
          city?: string | null
          county?: string | null
          created_at?: string
          id?: string
          import_batch_id?: string | null
          latitude?: number | null
          longitude?: number | null
          name: string
          notes?: string | null
          npi?: string | null
          organization_name?: string | null
          phone?: string | null
          provider_name?: string | null
          review_status?: string
          source_file_name?: string | null
          source_row_number?: number | null
          state?: string | null
          street_address?: string | null
          type?: string | null
          updated_at?: string
          validation_messages?: Json
          validation_severity?: string | null
          website?: string | null
          zip?: string | null
        }
        Update: {
          access_notes?: string | null
          active_status?: boolean
          city?: string | null
          county?: string | null
          created_at?: string
          id?: string
          import_batch_id?: string | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          notes?: string | null
          npi?: string | null
          organization_name?: string | null
          phone?: string | null
          provider_name?: string | null
          review_status?: string
          source_file_name?: string | null
          source_row_number?: number | null
          state?: string | null
          street_address?: string | null
          type?: string | null
          updated_at?: string
          validation_messages?: Json
          validation_severity?: string | null
          website?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      staging_services: {
        Row: {
          access_notes: string | null
          active_status: boolean
          appointment_required: boolean | null
          category_mapped: string | null
          category_raw: string | null
          city: string | null
          county: string | null
          created_at: string
          description: string | null
          eligibility_notes: string | null
          email: string | null
          hours_of_operation: string | null
          id: string
          import_batch_id: string | null
          languages_supported: string | null
          last_reviewed_at: string | null
          latitude: number | null
          longitude: number | null
          mappable: boolean
          match_conflict: boolean
          medicaid_relevance: string | null
          name: string
          organization_name: string | null
          phone: string | null
          referral_required: boolean | null
          resource_class: string
          review_status: string
          service_category: string | null
          service_subcategory: string | null
          service_tags: string | null
          source_file_name: string | null
          source_row_number: number | null
          state: string | null
          street_address: string | null
          target_population: string | null
          transportation_notes: string | null
          updated_at: string
          validation_messages: Json
          validation_severity: string | null
          verification_confidence: string | null
          verification_date: string | null
          verification_source: string | null
          verification_status: string
          walk_in_allowed: boolean | null
          website: string | null
          zip: string | null
        }
        Insert: {
          access_notes?: string | null
          active_status?: boolean
          appointment_required?: boolean | null
          category_mapped?: string | null
          category_raw?: string | null
          city?: string | null
          county?: string | null
          created_at?: string
          description?: string | null
          eligibility_notes?: string | null
          email?: string | null
          hours_of_operation?: string | null
          id?: string
          import_batch_id?: string | null
          languages_supported?: string | null
          last_reviewed_at?: string | null
          latitude?: number | null
          longitude?: number | null
          mappable?: boolean
          match_conflict?: boolean
          medicaid_relevance?: string | null
          name: string
          organization_name?: string | null
          phone?: string | null
          referral_required?: boolean | null
          resource_class?: string
          review_status?: string
          service_category?: string | null
          service_subcategory?: string | null
          service_tags?: string | null
          source_file_name?: string | null
          source_row_number?: number | null
          state?: string | null
          street_address?: string | null
          target_population?: string | null
          transportation_notes?: string | null
          updated_at?: string
          validation_messages?: Json
          validation_severity?: string | null
          verification_confidence?: string | null
          verification_date?: string | null
          verification_source?: string | null
          verification_status?: string
          walk_in_allowed?: boolean | null
          website?: string | null
          zip?: string | null
        }
        Update: {
          access_notes?: string | null
          active_status?: boolean
          appointment_required?: boolean | null
          category_mapped?: string | null
          category_raw?: string | null
          city?: string | null
          county?: string | null
          created_at?: string
          description?: string | null
          eligibility_notes?: string | null
          email?: string | null
          hours_of_operation?: string | null
          id?: string
          import_batch_id?: string | null
          languages_supported?: string | null
          last_reviewed_at?: string | null
          latitude?: number | null
          longitude?: number | null
          mappable?: boolean
          match_conflict?: boolean
          medicaid_relevance?: string | null
          name?: string
          organization_name?: string | null
          phone?: string | null
          referral_required?: boolean | null
          resource_class?: string
          review_status?: string
          service_category?: string | null
          service_subcategory?: string | null
          service_tags?: string | null
          source_file_name?: string | null
          source_row_number?: number | null
          state?: string | null
          street_address?: string | null
          target_population?: string | null
          transportation_notes?: string | null
          updated_at?: string
          validation_messages?: Json
          validation_severity?: string | null
          verification_confidence?: string | null
          verification_date?: string | null
          verification_source?: string | null
          verification_status?: string
          walk_in_allowed?: boolean | null
          website?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      verified_bh: {
        Row: {
          accepts_new_patients: boolean | null
          access_notes: string | null
          active_status: boolean
          age_groups_served: string | null
          appointment_required: boolean | null
          bh_entity_type: string | null
          bh_service_type: string | null
          category_mapped: string | null
          category_raw: string | null
          city: string | null
          county: string | null
          created_at: string
          crisis_capable: boolean | null
          description: string | null
          detox_capable: boolean | null
          facility_type: string | null
          fax: string | null
          hours_of_operation: string | null
          id: string
          import_batch_id: string | null
          languages_supported: string | null
          last_reviewed_at: string | null
          latitude: number | null
          license_type: string | null
          longitude: number | null
          mat_capable: boolean | null
          medicaid_participation_status: string | null
          name: string
          npi: string | null
          organization_name: string | null
          outpatient_capable: boolean | null
          payer_notes: string | null
          phone: string | null
          populations_served: string | null
          promoted_at: string
          promoted_by: string | null
          referral_required: boolean | null
          residential_capable: boolean | null
          service_tags: string | null
          source_file_name: string | null
          source_row_number: number | null
          specialties: string | null
          staging_id: string | null
          state: string | null
          street_address: string | null
          telehealth_available: boolean | null
          updated_at: string
          verification_confidence: string | null
          verification_date: string | null
          verification_source: string | null
          verification_status: string
          walk_in_allowed: boolean | null
          website: string | null
          zip: string | null
        }
        Insert: {
          accepts_new_patients?: boolean | null
          access_notes?: string | null
          active_status?: boolean
          age_groups_served?: string | null
          appointment_required?: boolean | null
          bh_entity_type?: string | null
          bh_service_type?: string | null
          category_mapped?: string | null
          category_raw?: string | null
          city?: string | null
          county?: string | null
          created_at?: string
          crisis_capable?: boolean | null
          description?: string | null
          detox_capable?: boolean | null
          facility_type?: string | null
          fax?: string | null
          hours_of_operation?: string | null
          id?: string
          import_batch_id?: string | null
          languages_supported?: string | null
          last_reviewed_at?: string | null
          latitude?: number | null
          license_type?: string | null
          longitude?: number | null
          mat_capable?: boolean | null
          medicaid_participation_status?: string | null
          name: string
          npi?: string | null
          organization_name?: string | null
          outpatient_capable?: boolean | null
          payer_notes?: string | null
          phone?: string | null
          populations_served?: string | null
          promoted_at?: string
          promoted_by?: string | null
          referral_required?: boolean | null
          residential_capable?: boolean | null
          service_tags?: string | null
          source_file_name?: string | null
          source_row_number?: number | null
          specialties?: string | null
          staging_id?: string | null
          state?: string | null
          street_address?: string | null
          telehealth_available?: boolean | null
          updated_at?: string
          verification_confidence?: string | null
          verification_date?: string | null
          verification_source?: string | null
          verification_status?: string
          walk_in_allowed?: boolean | null
          website?: string | null
          zip?: string | null
        }
        Update: {
          accepts_new_patients?: boolean | null
          access_notes?: string | null
          active_status?: boolean
          age_groups_served?: string | null
          appointment_required?: boolean | null
          bh_entity_type?: string | null
          bh_service_type?: string | null
          category_mapped?: string | null
          category_raw?: string | null
          city?: string | null
          county?: string | null
          created_at?: string
          crisis_capable?: boolean | null
          description?: string | null
          detox_capable?: boolean | null
          facility_type?: string | null
          fax?: string | null
          hours_of_operation?: string | null
          id?: string
          import_batch_id?: string | null
          languages_supported?: string | null
          last_reviewed_at?: string | null
          latitude?: number | null
          license_type?: string | null
          longitude?: number | null
          mat_capable?: boolean | null
          medicaid_participation_status?: string | null
          name?: string
          npi?: string | null
          organization_name?: string | null
          outpatient_capable?: boolean | null
          payer_notes?: string | null
          phone?: string | null
          populations_served?: string | null
          promoted_at?: string
          promoted_by?: string | null
          referral_required?: boolean | null
          residential_capable?: boolean | null
          service_tags?: string | null
          source_file_name?: string | null
          source_row_number?: number | null
          specialties?: string | null
          staging_id?: string | null
          state?: string | null
          street_address?: string | null
          telehealth_available?: boolean | null
          updated_at?: string
          verification_confidence?: string | null
          verification_date?: string | null
          verification_source?: string | null
          verification_status?: string
          walk_in_allowed?: boolean | null
          website?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      verified_services: {
        Row: {
          access_notes: string | null
          active_status: boolean
          appointment_required: boolean | null
          category_mapped: string | null
          category_raw: string | null
          city: string | null
          county: string | null
          created_at: string
          description: string | null
          eligibility_notes: string | null
          email: string | null
          hours_of_operation: string | null
          id: string
          import_batch_id: string | null
          languages_supported: string | null
          last_reviewed_at: string | null
          latitude: number | null
          longitude: number | null
          mappable: boolean
          medicaid_relevance: string | null
          name: string
          organization_name: string | null
          phone: string | null
          promoted_at: string
          promoted_by: string | null
          referral_required: boolean | null
          resource_class: string
          service_category: string | null
          service_subcategory: string | null
          service_tags: string | null
          source_file_name: string | null
          source_row_number: number | null
          staging_id: string | null
          state: string | null
          street_address: string | null
          target_population: string | null
          transportation_notes: string | null
          updated_at: string
          verification_confidence: string | null
          verification_date: string | null
          verification_source: string | null
          verification_status: string
          walk_in_allowed: boolean | null
          website: string | null
          zip: string | null
        }
        Insert: {
          access_notes?: string | null
          active_status?: boolean
          appointment_required?: boolean | null
          category_mapped?: string | null
          category_raw?: string | null
          city?: string | null
          county?: string | null
          created_at?: string
          description?: string | null
          eligibility_notes?: string | null
          email?: string | null
          hours_of_operation?: string | null
          id?: string
          import_batch_id?: string | null
          languages_supported?: string | null
          last_reviewed_at?: string | null
          latitude?: number | null
          longitude?: number | null
          mappable?: boolean
          medicaid_relevance?: string | null
          name: string
          organization_name?: string | null
          phone?: string | null
          promoted_at?: string
          promoted_by?: string | null
          referral_required?: boolean | null
          resource_class?: string
          service_category?: string | null
          service_subcategory?: string | null
          service_tags?: string | null
          source_file_name?: string | null
          source_row_number?: number | null
          staging_id?: string | null
          state?: string | null
          street_address?: string | null
          target_population?: string | null
          transportation_notes?: string | null
          updated_at?: string
          verification_confidence?: string | null
          verification_date?: string | null
          verification_source?: string | null
          verification_status?: string
          walk_in_allowed?: boolean | null
          website?: string | null
          zip?: string | null
        }
        Update: {
          access_notes?: string | null
          active_status?: boolean
          appointment_required?: boolean | null
          category_mapped?: string | null
          category_raw?: string | null
          city?: string | null
          county?: string | null
          created_at?: string
          description?: string | null
          eligibility_notes?: string | null
          email?: string | null
          hours_of_operation?: string | null
          id?: string
          import_batch_id?: string | null
          languages_supported?: string | null
          last_reviewed_at?: string | null
          latitude?: number | null
          longitude?: number | null
          mappable?: boolean
          medicaid_relevance?: string | null
          name?: string
          organization_name?: string | null
          phone?: string | null
          promoted_at?: string
          promoted_by?: string | null
          referral_required?: boolean | null
          resource_class?: string
          service_category?: string | null
          service_subcategory?: string | null
          service_tags?: string | null
          source_file_name?: string | null
          source_row_number?: number | null
          staging_id?: string | null
          state?: string | null
          street_address?: string | null
          target_population?: string | null
          transportation_notes?: string | null
          updated_at?: string
          verification_confidence?: string | null
          verification_date?: string | null
          verification_source?: string | null
          verification_status?: string
          walk_in_allowed?: boolean | null
          website?: string | null
          zip?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      active_admin_count: { Args: never; Returns: number }
      admin_list_users: {
        Args: never
        Returns: {
          created_at: string
          email: string
          is_active: boolean
          role: Database["public"]["Enums"]["app_role"]
          role_updated_at: string
          user_id: string
        }[]
      }
      admin_set_user_active: {
        Args: { _is_active: boolean; _user_id: string }
        Returns: undefined
      }
      admin_set_user_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "viewer" | "staff" | "admin"
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
      app_role: ["viewer", "staff", "admin"],
    },
  },
} as const
