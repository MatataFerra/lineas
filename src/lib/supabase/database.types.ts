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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      edge_votes: {
        Row: {
          created_at: string
          edge_id: number
          updated_at: string
          user_id: string
          value: number
        }
        Insert: {
          created_at?: string
          edge_id: number
          updated_at?: string
          user_id?: string
          value: number
        }
        Update: {
          created_at?: string
          edge_id?: number
          updated_at?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "edge_votes_edge_id_fkey"
            columns: ["edge_id"]
            isOneToOne: false
            referencedRelation: "kg_edges"
            referencedColumns: ["id"]
          },
        ]
      }
      graph_cache: {
        Row: {
          graphs: Json
          key: string
          lane: string
          updated_at: string
        }
        Insert: {
          graphs: Json
          key: string
          lane: string
          updated_at?: string
        }
        Update: {
          graphs?: Json
          key?: string
          lane?: string
          updated_at?: string
        }
        Relationships: []
      }
      kg_edges: {
        Row: {
          confidence: string
          created_at: string
          down: number
          explanation: string
          id: number
          quote: string | null
          score: number | null
          source: string
          summary: string
          target: string
          type: string
          up: number
          updated_at: string
        }
        Insert: {
          confidence: string
          created_at?: string
          down?: number
          explanation: string
          id?: never
          quote?: string | null
          score?: number | null
          source: string
          summary: string
          target: string
          type: string
          up?: number
          updated_at?: string
        }
        Update: {
          confidence?: string
          created_at?: string
          down?: number
          explanation?: string
          id?: never
          quote?: string | null
          score?: number | null
          source?: string
          summary?: string
          target?: string
          type?: string
          up?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kg_edges_source_fkey"
            columns: ["source"]
            isOneToOne: false
            referencedRelation: "kg_nodes"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "kg_edges_target_fkey"
            columns: ["target"]
            isOneToOne: false
            referencedRelation: "kg_nodes"
            referencedColumns: ["slug"]
          },
        ]
      }
      kg_nodes: {
        Row: {
          created_at: string
          era: Json
          kind: string
          label: string
          original_title: string | null
          slug: string
          subtitle: string | null
        }
        Insert: {
          created_at?: string
          era: Json
          kind: string
          label: string
          original_title?: string | null
          slug: string
          subtitle?: string | null
        }
        Update: {
          created_at?: string
          era?: Json
          kind?: string
          label?: string
          original_title?: string | null
          slug?: string
          subtitle?: string | null
        }
        Relationships: []
      }
      library_items: {
        Row: {
          author: string | null
          book_id: string
          cover_url: string | null
          created_at: string
          status: Database["public"]["Enums"]["library_status"]
          title: string
          user_id: string
          year_label: string | null
        }
        Insert: {
          author?: string | null
          book_id: string
          cover_url?: string | null
          created_at?: string
          status: Database["public"]["Enums"]["library_status"]
          title: string
          user_id?: string
          year_label?: string | null
        }
        Update: {
          author?: string | null
          book_id?: string
          cover_url?: string | null
          created_at?: string
          status?: Database["public"]["Enums"]["library_status"]
          title?: string
          user_id?: string
          year_label?: string | null
        }
        Relationships: []
      }
      portraits: {
        Row: {
          fetched_at: string
          image_url: string | null
          name: string
          slug: string
          source_url: string | null
        }
        Insert: {
          fetched_at?: string
          image_url?: string | null
          name: string
          slug: string
          source_url?: string | null
        }
        Update: {
          fetched_at?: string
          image_url?: string | null
          name?: string
          slug?: string
          source_url?: string | null
        }
        Relationships: []
      }
      rec_signals: {
        Row: {
          book_slug: string
          clues_key: string
          created_at: string
          id: number
          lane: string
          signal: Database["public"]["Enums"]["rec_signal"]
          user_id: string
        }
        Insert: {
          book_slug: string
          clues_key: string
          created_at?: string
          id?: never
          lane: string
          signal: Database["public"]["Enums"]["rec_signal"]
          user_id?: string
        }
        Update: {
          book_slug?: string
          clues_key?: string
          created_at?: string
          id?: never
          lane?: string
          signal?: Database["public"]["Enums"]["rec_signal"]
          user_id?: string
        }
        Relationships: []
      }
      searches: {
        Row: {
          clues: Json
          created_at: string
          graph: Json
          id: string
          schema_version: number
          user_id: string
        }
        Insert: {
          clues: Json
          created_at?: string
          graph: Json
          id?: string
          schema_version?: number
          user_id?: string
        }
        Update: {
          clues?: Json
          created_at?: string
          graph?: Json
          id?: string
          schema_version?: number
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      kg_upsert_edge: { Args: { p_edge: Json }; Returns: number }
      kg_upsert_node: { Args: { p_node: Json }; Returns: undefined }
      record_rec_signal: {
        Args: {
          p_book_slug: string
          p_clues_key: string
          p_edges: Json
          p_lane: string
          p_nodes: Json
          p_signal: Database["public"]["Enums"]["rec_signal"]
        }
        Returns: undefined
      }
      vote_edge: {
        Args: { p_edge: Json; p_source: Json; p_target: Json; p_value: number }
        Returns: {
          down: number
          edge_id: number
          my_vote: number
          up: number
        }[]
      }
    }
    Enums: {
      library_status: "saved" | "read"
      rec_signal: "up" | "down" | "saved" | "read" | "skipped"
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
    Enums: {
      library_status: ["saved", "read"],
      rec_signal: ["up", "down", "saved", "read", "skipped"],
    },
  },
} as const
