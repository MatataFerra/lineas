/**
 * Tipos de la base. Escritos a mano a partir de supabase/migrations.
 * Cuando el CLI esté vinculado al proyecto, reemplazar por:
 *   pnpm dlx supabase gen types typescript --project-id <id> > src/lib/supabase/database.types.ts
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type LibraryStatus = "saved" | "read";

export interface Database {
  public: {
    Tables: {
      library_items: {
        Row: {
          user_id: string;
          book_id: string;
          status: LibraryStatus;
          title: string;
          author: string | null;
          year_label: string | null;
          created_at: string;
        };
        Insert: {
          user_id?: string;
          book_id: string;
          status: LibraryStatus;
          title: string;
          author?: string | null;
          year_label?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["library_items"]["Insert"]>;
        Relationships: [];
      };
      searches: {
        Row: {
          id: string;
          user_id: string;
          clues: Json;
          graph: Json;
          schema_version: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          clues: Json;
          graph: Json;
          schema_version?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["searches"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { library_status: LibraryStatus };
    CompositeTypes: { [_ in never]: never };
  };
}
