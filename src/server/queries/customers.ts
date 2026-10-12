import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Tables, Views } from "@/lib/supabase/database.types";
import { fetchTransactions } from "./ledger";

/**
 * Lectures des clients. Le shop_id vient toujours de requireShop() (côté serveur) ;
 * la RLS garantit en plus qu'aucune ligne d'une autre boutique ne peut être lue.
 */

export type CustomerListItem = Pick<
  Views<"customer_balances">,
  "customer_id" | "name" | "phone" | "balance" | "last_transaction_at"
>;

/** Limite de la liste chargée d'un coup (recherche instantanée côté client). */
export const CUSTOMER_LIST_LIMIT = 5000;

export async function listCustomers(shopId: string): Promise<CustomerListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customer_balances")
    .select("customer_id, name, phone, balance, last_transaction_at")
    .eq("shop_id", shopId)
    .is("archived_at", null)
    .order("name")
    .limit(CUSTOMER_LIST_LIMIT);
  if (error) throw error;
  return data.map((c) => ({ ...c, balance: Number(c.balance) }));
}

export type CustomerDetail = Tables<"customers"> & { balance: number };

export const getCustomer = cache(async (shopId: string, customerId: string): Promise<CustomerDetail | null> => {
  if (!isUuid(customerId)) return null;
  const supabase = await createClient();
  const [{ data: customer, error }, { data: balance }] = await Promise.all([
    supabase.from("customers").select("*").eq("shop_id", shopId).eq("id", customerId).maybeSingle(),
    supabase.from("customer_balances").select("balance").eq("customer_id", customerId).maybeSingle(),
  ]);
  if (error) throw error;
  if (!customer) return null;
  return { ...customer, balance: Number(balance?.balance ?? 0) };
});

export const CUSTOMER_HISTORY_LIMIT = 100;

export function getCustomerTransactions(shopId: string, customerId: string) {
  return fetchTransactions({ shopId, customerId, limit: CUSTOMER_HISTORY_LIMIT });
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
