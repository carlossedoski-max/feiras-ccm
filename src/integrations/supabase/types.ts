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
  public: {
    Tables: {
      equipment_catalog: {
        Row: {
          brand: string
          category: string
          ccm_code: string
          created_at: string
          created_by: string | null
          dimension_status: string
          gross_weight: number | null
          height_mm: number | null
          id: string
          last_checked_at: string | null
          length_mm: number | null
          model: string
          name: string
          net_weight: number | null
          normalized_code: string
          notes: string
          official_url: string | null
          photo_url: string | null
          situation: string
          source: string
          specifications: Json
          updated_at: string
          width_mm: number | null
        }
        Insert: {
          brand?: string
          category?: string
          ccm_code: string
          created_at?: string
          created_by?: string | null
          dimension_status?: string
          gross_weight?: number | null
          height_mm?: number | null
          id?: string
          last_checked_at?: string | null
          length_mm?: number | null
          model?: string
          name?: string
          net_weight?: number | null
          normalized_code: string
          notes?: string
          official_url?: string | null
          photo_url?: string | null
          situation?: string
          source?: string
          specifications?: Json
          updated_at?: string
          width_mm?: number | null
        }
        Update: {
          brand?: string
          category?: string
          ccm_code?: string
          created_at?: string
          created_by?: string | null
          dimension_status?: string
          gross_weight?: number | null
          height_mm?: number | null
          id?: string
          last_checked_at?: string | null
          length_mm?: number | null
          model?: string
          name?: string
          net_weight?: number | null
          normalized_code?: string
          notes?: string
          official_url?: string | null
          photo_url?: string | null
          situation?: string
          source?: string
          specifications?: Json
          updated_at?: string
          width_mm?: number | null
        }
        Relationships: []
      }
      equipment_import_batches: {
        Row: {
          created_at: string
          created_by: string | null
          details: Json
          duplicate_count: number
          filename: string
          id: string
          invalid_count: number
          plan_id: string
          status: string
          updated_at: string
          valid_count: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          details?: Json
          duplicate_count?: number
          filename: string
          id?: string
          invalid_count?: number
          plan_id: string
          status?: string
          updated_at?: string
          valid_count?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          details?: Json
          duplicate_count?: number
          filename?: string
          id?: string
          invalid_count?: number
          plan_id?: string
          status?: string
          updated_at?: string
          valid_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "equipment_import_batches_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "fair_equipment_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      fair_equipment_items: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          deleted_by_name: string | null
          deleted_with_plan: boolean
          display_mode: string
          equipment_id: string
          id: string
          included: boolean
          is_launch: boolean
          location: string
          manual_area: number | null
          notes: string
          plan_id: string
          position_x: number | null
          position_y: number | null
          priority: string
          quantity: number
          rotation: number
          situation: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_by_name?: string | null
          deleted_with_plan?: boolean
          display_mode?: string
          equipment_id: string
          id?: string
          included?: boolean
          is_launch?: boolean
          location?: string
          manual_area?: number | null
          notes?: string
          plan_id: string
          position_x?: number | null
          position_y?: number | null
          priority?: string
          quantity?: number
          rotation?: number
          situation?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_by_name?: string | null
          deleted_with_plan?: boolean
          display_mode?: string
          equipment_id?: string
          id?: string
          included?: boolean
          is_launch?: boolean
          location?: string
          manual_area?: number | null
          notes?: string
          plan_id?: string
          position_x?: number | null
          position_y?: number | null
          priority?: string
          quantity?: number
          rotation?: number
          situation?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fair_equipment_items_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fair_equipment_items_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "fair_equipment_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      fair_equipment_plans: {
        Row: {
          circulation_percent: number
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          deleted_by_name: string | null
          edition_year: number
          external_reserved: number
          fair_id: string
          id: string
          internal_reserved: number
          notes: string
          reference_plan_id: string | null
          reference_snapshot: Json | null
          stand_area: number
          stand_depth: number
          stand_width: number
          terrain_depth: number
          terrain_width: number
          total_area: number
          updated_at: string
        }
        Insert: {
          circulation_percent?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_by_name?: string | null
          edition_year: number
          external_reserved?: number
          fair_id: string
          id?: string
          internal_reserved?: number
          notes?: string
          reference_plan_id?: string | null
          reference_snapshot?: Json | null
          stand_area?: number
          stand_depth?: number
          stand_width?: number
          terrain_depth?: number
          terrain_width?: number
          total_area?: number
          updated_at?: string
        }
        Update: {
          circulation_percent?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_by_name?: string | null
          edition_year?: number
          external_reserved?: number
          fair_id?: string
          id?: string
          internal_reserved?: number
          notes?: string
          reference_plan_id?: string | null
          reference_snapshot?: Json | null
          stand_area?: number
          stand_depth?: number
          stand_width?: number
          terrain_depth?: number
          terrain_width?: number
          total_area?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fair_equipment_plans_fair_id_fkey"
            columns: ["fair_id"]
            isOneToOne: false
            referencedRelation: "fairs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fair_equipment_plans_reference_plan_id_fkey"
            columns: ["reference_plan_id"]
            isOneToOne: false
            referencedRelation: "fair_equipment_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      fairs: {
        Row: {
          area_size: string | null
          checklist: Json
          city: string
          commercial: string | null
          costs: Json
          created_at: string
          created_by: string | null
          credentials: Json
          documents: Json
          end_date: string | null
          id: string
          legacy_id: string | null
          manual_analysis: Json | null
          materials: Json
          name: string
          notes: string | null
          products: Json
          readiness: Json
          readiness_confirmed_at: string | null
          readiness_confirmed_by: string | null
          readiness_notes: string | null
          readiness_status: string
          report: Json
          responsible: string | null
          space_value: number | null
          start_date: string | null
          state: string
          status: string
          suppliers: Json
          updated_at: string
          venue: string | null
          year: number
        }
        Insert: {
          area_size?: string | null
          checklist?: Json
          city?: string
          commercial?: string | null
          costs?: Json
          created_at?: string
          created_by?: string | null
          credentials?: Json
          documents?: Json
          end_date?: string | null
          id?: string
          legacy_id?: string | null
          manual_analysis?: Json | null
          materials?: Json
          name?: string
          notes?: string | null
          products?: Json
          readiness?: Json
          readiness_confirmed_at?: string | null
          readiness_confirmed_by?: string | null
          readiness_notes?: string | null
          readiness_status?: string
          report?: Json
          responsible?: string | null
          space_value?: number | null
          start_date?: string | null
          state?: string
          status?: string
          suppliers?: Json
          updated_at?: string
          venue?: string | null
          year?: number
        }
        Update: {
          area_size?: string | null
          checklist?: Json
          city?: string
          commercial?: string | null
          costs?: Json
          created_at?: string
          created_by?: string | null
          credentials?: Json
          documents?: Json
          end_date?: string | null
          id?: string
          legacy_id?: string | null
          manual_analysis?: Json | null
          materials?: Json
          name?: string
          notes?: string | null
          products?: Json
          readiness?: Json
          readiness_confirmed_at?: string | null
          readiness_confirmed_by?: string | null
          readiness_notes?: string | null
          readiness_status?: string
          report?: Json
          responsible?: string | null
          space_value?: number | null
          start_date?: string | null
          state?: string
          status?: string
          suppliers?: Json
          updated_at?: string
          venue?: string | null
          year?: number
        }
        Relationships: []
      }
      image_projects: {
        Row: {
          analysis: Json | null
          briefing: string | null
          budget_tier: string | null
          checklist: Json | null
          city: string | null
          comparison: Json | null
          complexity: string | null
          complexity_reason: string | null
          created_at: string
          created_by: string | null
          estimated_value: number | null
          fair_type: string | null
          history: Json
          id: string
          images: Json
          main_brand: string | null
          name: string
          notes: string | null
          objective: string | null
          quote_status: string | null
          quote_summary: string | null
          reference_year: string | null
          related_fair: string | null
          required_items: Json
          responsible: string | null
          state: string | null
          status: string
          supplier_id: string | null
          supplier_notes: string | null
          supplier_sent_at: string | null
          target_budget: string | null
          updated_at: string
        }
        Insert: {
          analysis?: Json | null
          briefing?: string | null
          budget_tier?: string | null
          checklist?: Json | null
          city?: string | null
          comparison?: Json | null
          complexity?: string | null
          complexity_reason?: string | null
          created_at?: string
          created_by?: string | null
          estimated_value?: number | null
          fair_type?: string | null
          history?: Json
          id?: string
          images?: Json
          main_brand?: string | null
          name: string
          notes?: string | null
          objective?: string | null
          quote_status?: string | null
          quote_summary?: string | null
          reference_year?: string | null
          related_fair?: string | null
          required_items?: Json
          responsible?: string | null
          state?: string | null
          status?: string
          supplier_id?: string | null
          supplier_notes?: string | null
          supplier_sent_at?: string | null
          target_budget?: string | null
          updated_at?: string
        }
        Update: {
          analysis?: Json | null
          briefing?: string | null
          budget_tier?: string | null
          checklist?: Json | null
          city?: string | null
          comparison?: Json | null
          complexity?: string | null
          complexity_reason?: string | null
          created_at?: string
          created_by?: string | null
          estimated_value?: number | null
          fair_type?: string | null
          history?: Json
          id?: string
          images?: Json
          main_brand?: string | null
          name?: string
          notes?: string | null
          objective?: string | null
          quote_status?: string | null
          quote_summary?: string | null
          reference_year?: string | null
          related_fair?: string | null
          required_items?: Json
          responsible?: string | null
          state?: string | null
          status?: string
          supplier_id?: string | null
          supplier_notes?: string | null
          supplier_sent_at?: string | null
          target_budget?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "image_projects_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      project_renders: {
        Row: {
          ai_items: Json
          ambience: string | null
          briefing: string | null
          budget_tier: string | null
          city: string | null
          created_at: string
          created_by: string | null
          defined_items: Json
          fair_type: string | null
          id: string
          image_path: string
          image_type: string
          label: string
          main_brand: string | null
          mode: string | null
          notes: string | null
          origin: string
          period: string | null
          project_id: string
          prompt: string | null
          required_items: Json
          responsible: string | null
          state: string | null
          status: string
          style: string | null
          target_budget: string | null
          version: number
          visual_summary: string | null
        }
        Insert: {
          ai_items?: Json
          ambience?: string | null
          briefing?: string | null
          budget_tier?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          defined_items?: Json
          fair_type?: string | null
          id?: string
          image_path: string
          image_type?: string
          label?: string
          main_brand?: string | null
          mode?: string | null
          notes?: string | null
          origin?: string
          period?: string | null
          project_id: string
          prompt?: string | null
          required_items?: Json
          responsible?: string | null
          state?: string | null
          status?: string
          style?: string | null
          target_budget?: string | null
          version?: number
          visual_summary?: string | null
        }
        Update: {
          ai_items?: Json
          ambience?: string | null
          briefing?: string | null
          budget_tier?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          defined_items?: Json
          fair_type?: string | null
          id?: string
          image_path?: string
          image_type?: string
          label?: string
          main_brand?: string | null
          mode?: string | null
          notes?: string | null
          origin?: string
          period?: string | null
          project_id?: string
          prompt?: string | null
          required_items?: Json
          responsible?: string | null
          state?: string | null
          status?: string
          style?: string | null
          target_budget?: string | null
          version?: number
          visual_summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_renders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "image_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_contacts: {
        Row: {
          channel: string
          contact_date: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          next_action: string | null
          responsible: string | null
          supplier_id: string
        }
        Insert: {
          channel?: string
          contact_date?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          next_action?: string | null
          responsible?: string | null
          supplier_id: string
        }
        Update: {
          channel?: string
          contact_date?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          next_action?: string | null
          responsible?: string | null
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_contacts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          approved: string
          attachment_name: string | null
          attachment_path: string | null
          attachment_type: string | null
          attachment_uploaded_at: string | null
          city: string | null
          contact_name: string | null
          created_at: string
          created_by: string | null
          email: string | null
          favorite: boolean
          how_we_met: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          related_event: string | null
          service_type: string
          state: string | null
          status: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          approved?: string
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_type?: string | null
          attachment_uploaded_at?: string | null
          city?: string | null
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          favorite?: boolean
          how_we_met?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          related_event?: string | null
          service_type?: string
          state?: string | null
          status?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          approved?: string
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_type?: string | null
          attachment_uploaded_at?: string | null
          city?: string | null
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          favorite?: boolean
          how_we_met?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          related_event?: string | null
          service_type?: string
          state?: string | null
          status?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      copy_equipment_edition: {
        Args: { p_snapshot: Json; p_source: string; p_target: string }
        Returns: number
      }
      import_equipment_list: {
        Args: {
          p_duplicates: number
          p_filename: string
          p_invalid: number
          p_merge?: boolean
          p_plan_id: string
          p_rows: Json
        }
        Returns: number
      }
      manage_equipment_plan: {
        Args: { p_action: string; p_confirmation?: string; p_plan_id: string }
        Returns: undefined
      }
      trash_equipment_items: {
        Args: { p_ids: string[]; p_plan_id: string }
        Returns: number
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
