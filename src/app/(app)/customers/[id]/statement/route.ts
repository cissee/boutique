import type { NextRequest } from "next/server";
import { getActiveShop, getCurrentUser } from "@/lib/auth/session";
import { todayISODate } from "@/lib/format/date";
import { renderStatementPdf } from "@/lib/pdf/statement";
import { isoDate } from "@/lib/periods";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";
import { getCustomer } from "@/server/queries/customers";

/**
 * GET /customers/[id]/statement?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Relevé PDF d'un client de la boutique de l'utilisateur (propriétaire ou vendeur).
 */
export async function GET(request: NextRequest, { params }: RouteContext<"/customers/[id]/statement">) {
  if (!(await getCurrentUser())) return new Response("Non connecté", { status: 401 });
  const active = await getActiveShop();
  if (!active) return new Response("Accès refusé", { status: 403 });

  const { id } = await params;
  const customer = await getCustomer(active.shop.id, id);
  if (!customer) return new Response("Client introuvable", { status: 404 });

  const from = isoDate(request.nextUrl.searchParams.get("from")) ?? null;
  const to = isoDate(request.nextUrl.searchParams.get("to")) ?? null;

  // Tout l'historique du client : nécessaire pour le solde d'ouverture et les annulations hors période.
  const supabase = await createClient();
  const all = await fetchAll((start, end) =>
    supabase
      .from("ledger_transactions")
      .select("id, type, amount, balance_effect, description, occurred_at, reversed_transaction_id")
      .eq("shop_id", active.shop.id)
      .eq("customer_id", customer.id)
      .order("occurred_at", { ascending: true })
      .order("created_at", { ascending: true })
      .range(start, end),
  );

  const reversed = new Set(all.map((tx) => tx.reversed_transaction_id).filter(Boolean));
  const day = (iso: string) => iso.slice(0, 10); // Dakar = UTC
  const before = all.filter((tx) => from !== null && day(tx.occurred_at) < from);
  const inPeriod = all.filter(
    (tx) => (from === null || day(tx.occurred_at) >= from) && (to === null || day(tx.occurred_at) <= to),
  );

  const pdf = await renderStatementPdf({
    shop: active.shop,
    customer: { name: customer.name, phone: customer.phone },
    from,
    to,
    openingBalance: before.reduce((sum, tx) => sum + Number(tx.balance_effect), 0),
    transactions: inPeriod.map((tx) => ({
      id: tx.id,
      type: tx.type,
      amount: Number(tx.amount),
      balanceEffect: Number(tx.balance_effect),
      description: tx.description,
      occurredAt: tx.occurred_at,
      isReversed: reversed.has(tx.id),
    })),
    generatedAt: new Date(),
  });

  const slug =
    customer.name
      .normalize("NFD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .toLowerCase() || "client";

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="releve_${slug}_${todayISODate()}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
