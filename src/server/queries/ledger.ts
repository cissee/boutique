import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Enums, Tables } from "@/lib/supabase/database.types";

export type TransactionItem = Pick<
  Tables<"ledger_transactions">,
  | "id"
  | "type"
  | "amount"
  | "balance_effect"
  | "description"
  | "payment_method"
  | "occurred_at"
  | "reversed_transaction_id"
> & {
  createdByName: string | null;
  /** Vrai si une annulation vise cette transaction. */
  isReversed: boolean;
  /** Renseigné pour les listes multi-clients (tableau de bord, historique). */
  customer: { id: string; name: string } | null;
};

export type TransactionFilters = {
  shopId: string;
  customerId?: string;
  type?: Enums<"transaction_type">;
  /** Bornes incluses, au format "YYYY-MM-DD" (heure de Dakar = UTC). */
  from?: string;
  to?: string;
  limit: number;
  offset?: number;
};

/**
 * Opérations d'une boutique, les plus récentes d'abord, avec filtres facultatifs.
 * Renvoie `hasMore` pour la pagination (une ligne de plus est demandée).
 */
export async function queryTransactions(filters: TransactionFilters): Promise<{
  items: TransactionItem[];
  hasMore: boolean;
}> {
  const supabase = await createClient();
  const offset = filters.offset ?? 0;
  let query = supabase
    .from("ledger_transactions")
    .select(
      "id, type, amount, balance_effect, description, payment_method, occurred_at, reversed_transaction_id, created_by, customer:customers(id, name)",
    )
    .eq("shop_id", filters.shopId)
    .order("occurred_at", { ascending: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + filters.limit); // limit + 1 lignes
  if (filters.customerId) query = query.eq("customer_id", filters.customerId);
  if (filters.type) query = query.eq("type", filters.type);
  if (filters.from) query = query.gte("occurred_at", `${filters.from}T00:00:00.000Z`);
  if (filters.to) query = query.lte("occurred_at", `${filters.to}T23:59:59.999Z`);

  const { data, error } = await query;
  if (error) throw error;

  const rows = data.slice(0, filters.limit);
  const ids = rows.map((tx) => tx.id);
  const [reversedIds, names] = await Promise.all([
    getReversedIds(filters.shopId, ids),
    getMemberNames(rows.map((tx) => tx.created_by)),
  ]);

  return {
    hasMore: data.length > filters.limit,
    items: rows.map(({ created_by, customer, ...tx }) => ({
      ...tx,
      amount: Number(tx.amount),
      balance_effect: Number(tx.balance_effect),
      createdByName: names.get(created_by) ?? null,
      isReversed: reversedIds.has(tx.id),
      customer: filters.customerId ? null : customer,
    })),
  };
}

export async function fetchTransactions(filters: TransactionFilters): Promise<TransactionItem[]> {
  return (await queryTransactions(filters)).items;
}

/** Parmi `ids`, celles qui ont été annulées (requête dédiée : fiable quels que soient les filtres). */
async function getReversedIds(shopId: string, ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ledger_transactions")
    .select("reversed_transaction_id")
    .eq("shop_id", shopId)
    .in("reversed_transaction_id", ids);
  if (error) throw error;
  return new Set(data.map((r) => r.reversed_transaction_id).filter((id): id is string => id !== null));
}

/** Noms des membres de l'équipe (lisibles via la RLS « collègues »). */
async function getMemberNames(userIds: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(userIds)];
  if (!unique.length) return new Map();
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, full_name").in("id", unique);
  return new Map((data ?? []).filter((p) => p.full_name).map((p) => [p.id, p.full_name]));
}
