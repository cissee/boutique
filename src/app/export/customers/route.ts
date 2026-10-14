import { getActiveShop, getCurrentUser } from "@/lib/auth/session";
import { csvResponse } from "@/lib/csv";
import { todayISODate } from "@/lib/format/date";
import { customersCsv } from "@/server/exports";

/** GET /export/customers — propriétaire uniquement. */
export async function GET() {
  if (!(await getCurrentUser())) return new Response("Non connecté", { status: 401 });
  const active = await getActiveShop();
  if (!active || active.role !== "owner") return new Response("Accès refusé", { status: 403 });

  return csvResponse(await customersCsv(active.shop.id), `clients_${todayISODate()}.csv`);
}
