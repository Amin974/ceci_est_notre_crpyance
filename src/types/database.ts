export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      folders: {
        Row: {
          id: string;
          name: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      files: {
        Row: {
          id: string;
          folder_id: string;
          title: string;
          youtube_url: string | null;
          arabic_text: string | null;
          french_translation: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          folder_id: string;
          title: string;
          youtube_url?: string | null;
          arabic_text?: string | null;
          french_translation?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          folder_id?: string;
          title?: string;
          youtube_url?: string | null;
          arabic_text?: string | null;
          french_translation?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "files_folder_id_fkey";
            columns: ["folder_id"];
            isOneToOne: false;
            referencedRelation: "folders";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      search_translation_files: {
        Args: {
          search_text: string;
        };
        Returns: {
          id: string;
          folder_id: string;
          folder_name: string;
          title: string;
          youtube_url: string | null;
          arabic_text: string | null;
          french_translation: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Folder = Database["public"]["Tables"]["folders"]["Row"];
export type TranslationFile = Database["public"]["Tables"]["files"]["Row"] & {
  folders?: Pick<Folder, "id" | "name"> | null;
  folder_name?: string;
};
