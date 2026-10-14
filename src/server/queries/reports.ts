import "server-only";
import { createClient } from "@/lib/supabase/server";

export type PeriodReport = {
  debtsTotal: number;
  debtsCount: number;
  repaymentsTotal: number;
  repaymentsCount: number;
  repaymentsByMethod: Record<string, number>;
  reversalsCount: number;
  newCustomers: number;
  outstandingEnd: number;
};

/** Rapport calculé par PostgreSQL (fonction shop_report, soumise à la RLS). */
export async function getPeriodReport(shopId: string, from: string, to: string): Promise<PeriodReport> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("shop_report", { p_shop_id: shopId, p_from: from, p_to: to }).single();
  if (error) throw error;

  const byMethod: Record<string, number> = {};
  if (data.repayments_by_method && typeof data.repayments_by_method === "object" && !Array.isArray(data.repayments_by_method)) {
    for (const [method, total] of Object.entries(data.repayments_by_method)) byMethod[method] = Number(total);
  }

  return {
    debtsTotal: Number(data.debts_total),
    debtsCount: Number(data.debts_count),
    repaymentsTotal: Number(data.repayments_total),
    repaymentsCount: Number(data.repayments_count),
    repaymentsByMethod: byMethod,
    reversalsCount: Number(data.reversals_count),
    newCustomers: Number(data.new_customers),
    outstandingEnd: Number(data.outstanding_end),
  };
}
