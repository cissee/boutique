import type { NextRequest } from "next/server";
import { getActiveShop, getCurrentUser } from "@/lib/auth/session";
import { csvResponse } from "@/lib/csv";
import { todayISODate } from "@/lib/format/date";
import { isoDate } from "@/lib/periods";
import { transactionsCsv } from "@/server/exports";

/** GET /export/transactions?from=YYYY-MM-DD&to=YYYY-MM-DD — propriétaire uniquement. */
export async function GET(request: NextRequest) {
  if (!(await getCurrentUser())) return new Response("Non connecté", { status: 401 });
  const active = await getActiveShop();
  if (!active || active.role !== "owner") return new Response("Accès refusé", { status: 403 });

  const from = isoDate(request.nextUrl.searchParams.get("from"));
  const to = isoDate(request.nextUrl.searchParams.get("to"));
  const csv = await transactionsCsv(active.shop.id, from, to);
  const suffix = from || to ? `${from ?? "debut"}_${to ?? todayISODate()}` : todayISODate();
  return csvResponse(csv, `operations_${suffix}.csv`);
}
