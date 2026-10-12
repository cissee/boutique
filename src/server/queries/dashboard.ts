import "server-only";
import { createClient } from "@/lib/supabase/server";

export type DashboardStats = {
  totalOutstanding: number;
  debtorCount: number;
  customerCount: number;
  repaymentsToday: number;
  repaymentsTodayCount: number;
  debtsToday: number;
  debtsTodayCount: number;
};

/** Indicateurs calculés par PostgreSQL (fonction shop_dashboard, soumise à la RLS). */
export async function getDashboardStats(shopId: string): Promise<DashboardStats> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("shop_dashboard", { p_shop_id: shopId }).single();
  if (error) throw error;
  return {
    totalOutstanding: Number(data.total_outstanding),
    debtorCount: Number(data.debtor_count),
    customerCount: Number(data.customer_count),
    repaymentsToday: Number(data.repayments_today),
    repaymentsTodayCount: Number(data.repayments_today_count),
    debtsToday: Number(data.debts_today),
    debtsTodayCount: Number(data.debts_today_count),
  };
}

export type TopDebtor = { id: string; name: string; balance: number };

export async function getTopDebtors(shopId: string, limit = 5): Promise<TopDebtor[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customer_balances")
    .select("customer_id, name, balance")
    .eq("shop_id", shopId)
    .is("archived_at", null)
    .gt("balance", 0)
    .order("balance", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data.map((c) => ({ id: c.customer_id, name: c.name, balance: Number(c.balance) }));
}
