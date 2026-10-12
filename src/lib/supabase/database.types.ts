/**
 * Types de la base, au format de `supabase gen types typescript`.
 * Écrits à la main d'après supabase/migrations ; à régénérer avec `npm run db:types`
 * (nécessite `npx supabase login`) après chaque nouvelle migration.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type LedgerRow = {
  id: string;
  shop_id: string;
  customer_id: string;
  type: Database["public"]["Enums"]["transaction_type"];
  amount: number;
  balance_effect: number;
  description: string | null;
  payment_method: string | null;
  occurred_at: string;
  created_by: string;
  created_at: string;
  reversed_transaction_id: string | null;
  client_request_id: string;
};

type ShopRow = {
  id: string;
  name: string;
  owner_id: string;
  phone: string | null;
  address: string | null;
  currency: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "13";
  };
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          phone: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: {
          full_name?: string;
          phone?: string | null;
        };
        Relationships: [];
      };
      shops: {
        Row: ShopRow;
        Insert: never;
        Update: {
          name?: string;
          phone?: string | null;
          address?: string | null;
        };
        Relationships: [];
      };
      shop_members: {
        Row: {
          id: string;
          shop_id: string;
          user_id: string;
          role: Database["public"]["Enums"]["shop_role"];
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "shop_members_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      customers: {
        Row: {
          id: string;
          shop_id: string;
          name: string;
          phone: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          archived_at: string | null;
        };
        Insert: {
          shop_id: string;
          name: string;
          phone?: string | null;
          notes?: string | null;
        };
        Update: {
          name?: string;
          phone?: string | null;
          notes?: string | null;
          archived_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "customers_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      ledger_transactions: {
        Row: LedgerRow;
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "ledger_transactions_customer_id_shop_id_fkey";
            columns: ["customer_id", "shop_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id", "shop_id"];
          },
          {
            foreignKeyName: "ledger_transactions_reversed_transaction_id_fkey";
            columns: ["reversed_transaction_id"];
            isOneToOne: true;
            referencedRelation: "ledger_transactions";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_log: {
        Row: {
          id: number;
          shop_id: string | null;
          actor_id: string | null;
          action: string;
          record_id: string | null;
          old_data: Json | null;
          new_data: Json | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: {
      customer_balances: {
        Row: {
          customer_id: string;
          shop_id: string;
          name: string;
          phone: string | null;
          archived_at: string | null;
          balance: number;
          transaction_count: number;
          last_transaction_at: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      create_shop: {
        Args: { p_name: string; p_phone?: string | null; p_address?: string | null };
        Returns: ShopRow;
      };
      record_debt: {
        Args: {
          p_customer_id: string;
          p_amount: number;
          p_client_request_id: string;
          p_description?: string | null;
          p_occurred_at?: string;
        };
        Returns: LedgerRow;
      };
      record_repayment: {
        Args: {
          p_customer_id: string;
          p_amount: number;
          p_client_request_id: string;
          p_payment_method?: string | null;
          p_comment?: string | null;
          p_occurred_at?: string;
        };
        Returns: LedgerRow;
      };
      shop_dashboard: {
        Args: { p_shop_id: string };
        Returns: {
          total_outstanding: number;
          debtor_count: number;
          customer_count: number;
          repayments_today: number;
          repayments_today_count: number;
          debts_today: number;
          debts_today_count: number;
        }[];
      };
      reverse_transaction: {
        Args: { p_transaction_id: string; p_reason: string; p_client_request_id: string };
        Returns: LedgerRow;
      };
    };
    Enums: {
      shop_role: "owner" | "seller";
      transaction_type: "DEBT" | "REPAYMENT" | "REVERSAL";
    };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type Views<T extends keyof Database["public"]["Views"]> = Database["public"]["Views"][T]["Row"];
export type Enums<T extends keyof Database["public"]["Enums"]> = Database["public"]["Enums"][T];
