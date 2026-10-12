import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

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

/**
 * Dernières opérations d'une boutique, ou d'un client si `customerId` est fourni.
 * Une annulation est toujours plus récente que l'opération annulée : si l'original est
 * dans la page, son annulation aussi, ce qui permet de calculer `isReversed` localement.
 */
export async function fetchTransactions(opts: {
  shopId: string;
  customerId?: string;
  limit: number;
}): Promise<TransactionItem[]> {
  const supabase = await createClient();
  let query = supabase
    .from("ledger_transactions")
    .select(
      "id, type, amount, balance_effect, description, payment_method, occurred_at, reversed_transaction_id, created_by, customer:customers(id, name)",
    )
    .eq("shop_id", opts.shopId)
    .order("occurred_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(opts.limit);
  if (opts.customerId) query = query.eq("customer_id", opts.customerId);

  const { data, error } = await query;
  if (error) throw error;

  const reversedIds = new Set(data.map((tx) => tx.reversed_transaction_id).filter(Boolean));
  const names = await getMemberNames(data.map((tx) => tx.created_by));

  return data.map(({ created_by, customer, ...tx }) => ({
    ...tx,
    amount: Number(tx.amount),
    balance_effect: Number(tx.balance_effect),
    createdByName: names.get(created_by) ?? null,
    isReversed: reversedIds.has(tx.id),
    customer: opts.customerId ? null : customer,
  }));
}

/** Noms des membres de l'équipe (lisibles via la RLS « collègues »). */
async function getMemberNames(userIds: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(userIds)];
  if (!unique.length) return new Map();
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, full_name").in("id", unique);
  return new Map((data ?? []).filter((p) => p.full_name).map((p) => [p.id, p.full_name]));
}
