import "server-only";
import { getMessages } from "@/i18n";
import { toCsv } from "@/lib/csv";
import { formatDateTime } from "@/lib/format/date";
import { formatPhone } from "@/lib/format/phone";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";

const t = getMessages();

/** Export de toutes les opérations (ordre chronologique), éventuellement sur une période. */
export async function transactionsCsv(shopId: string, from?: string, to?: string): Promise<string> {
  const supabase = await createClient();

  const rows = await fetchAll((start, end) => {
    let q = supabase
      .from("ledger_transactions")
      .select(
        "id, type, amount, balance_effect, description, payment_method, occurred_at, created_at, created_by, reversed_transaction_id, customer:customers(name, phone)",
      )
      .eq("shop_id", shopId)
      .order("occurred_at", { ascending: true })
      .order("id", { ascending: true })
      .range(start, end);
    if (from) q = q.gte("occurred_at", `${from}T00:00:00.000Z`);
    if (to) q = q.lte("occurred_at", `${to}T23:59:59.999Z`);
    return q;
  });

  const [reversals, profiles] = await Promise.all([
    fetchAll((start, end) =>
      supabase
        .from("ledger_transactions")
        .select("reversed_transaction_id")
        .eq("shop_id", shopId)
        .eq("type", "REVERSAL")
        .order("id")
        .range(start, end),
    ),
    supabase.from("profiles").select("id, full_name"),
  ]);
  const reversed = new Set(reversals.map((r) => r.reversed_transaction_id));
  const names = new Map((profiles.data ?? []).map((p) => [p.id, p.full_name]));

  return toCsv(rows, [
    { header: "Date", value: (r) => formatDateTime(r.occurred_at) },
    { header: "Type", value: (r) => t.transactions.type[r.type] },
    { header: "Client", value: (r) => r.customer?.name },
    { header: "Téléphone", value: (r) => formatPhone(r.customer?.phone) },
    { header: "Montant (FCFA)", value: (r) => Number(r.amount) },
    { header: "Effet sur le solde (FCFA)", value: (r) => Number(r.balance_effect) },
    {
      header: "Mode de paiement",
      value: (r) =>
        r.payment_method
          ? (t.transactions.paymentMethod[r.payment_method as keyof typeof t.transactions.paymentMethod] ??
            r.payment_method)
          : "",
    },
    { header: "Description / motif", value: (r) => r.description },
    { header: "Annulée", value: (r) => (reversed.has(r.id) ? "oui" : "") },
    { header: "Annule l'opération", value: (r) => r.reversed_transaction_id },
    { header: "Saisi par", value: (r) => names.get(r.created_by) },
    { header: "Saisi le", value: (r) => formatDateTime(r.created_at) },
    { header: "Identifiant", value: (r) => r.id },
  ]);
}

/** Export des clients avec leur solde (y compris archivés). */
export async function customersCsv(shopId: string): Promise<string> {
  const supabase = await createClient();
  const [customers, balances] = await Promise.all([
    fetchAll((start, end) =>
      supabase
        .from("customers")
        .select("id, name, phone, notes, created_at, archived_at")
        .eq("shop_id", shopId)
        .order("name")
        .order("id")
        .range(start, end),
    ),
    fetchAll((start, end) =>
      supabase
        .from("customer_balances")
        .select("customer_id, balance, transaction_count, last_transaction_at")
        .eq("shop_id", shopId)
        .order("customer_id")
        .range(start, end),
    ),
  ]);
  const byId = new Map(balances.map((b) => [b.customer_id, b]));

  return toCsv(customers, [
    { header: "Nom", value: (c) => c.name },
    { header: "Téléphone", value: (c) => formatPhone(c.phone) },
    { header: "Solde (FCFA)", value: (c) => Number(byId.get(c.id)?.balance ?? 0) },
    { header: "Nombre d'opérations", value: (c) => Number(byId.get(c.id)?.transaction_count ?? 0) },
    {
      header: "Dernière opération",
      value: (c) => {
        const last = byId.get(c.id)?.last_transaction_at;
        return last ? formatDateTime(last) : "";
      },
    },
    { header: "Notes", value: (c) => c.notes },
    { header: "Créé le", value: (c) => formatDateTime(c.created_at) },
    { header: "Archivé le", value: (c) => (c.archived_at ? formatDateTime(c.archived_at) : "") },
    { header: "Identifiant", value: (c) => c.id },
  ]);
}
