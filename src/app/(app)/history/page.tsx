import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { TransactionList } from "@/components/transactions/transaction-list";
import { getMessages } from "@/i18n";
import { requireShop } from "@/lib/auth/session";
import { todayISODate } from "@/lib/format/date";
import { isoDate, periodPresets } from "@/lib/periods";
import type { Enums } from "@/lib/supabase/database.types";
import { getCustomer, isUuid } from "@/server/queries/customers";
import { queryTransactions } from "@/server/queries/ledger";

const t = getMessages();

export const metadata: Metadata = { title: t.nav.history };

// Données lues en base à chaque requête : voir le commentaire de (app)/layout.tsx.
export const instant = false;

const PAGE_SIZE = 30;
const TYPES = ["DEBT", "REPAYMENT", "REVERSAL"] as const satisfies readonly Enums<"transaction_type">[];

type Filters = {
  type?: Enums<"transaction_type">;
  from?: string;
  to?: string;
  customer?: string;
  page: number;
};

/** Les paramètres d'URL sont validés : une valeur invalide est simplement ignorée. */
function parseFilters(params: Record<string, string | string[] | undefined>): Filters {
  const one = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : undefined);
  const date = (key: string) => isoDate(params[key]);
  const type = one("type");
  const customer = one("customer");
  const page = Number(one("page"));
  return {
    type: (TYPES as readonly string[]).includes(type ?? "") ? (type as Filters["type"]) : undefined,
    from: date("from"),
    to: date("to"),
    customer: customer && isUuid(customer) ? customer : undefined,
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

function historyHref(filters: Partial<Filters>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "" && !(key === "page" && value === 1)) params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `/history?${qs}` : "/history";
}

export default async function HistoryPage({ searchParams }: PageProps<"/history">) {
  const { shop, role } = await requireShop();
  const filters = parseFilters(await searchParams);
  const today = todayISODate();

  const [{ items, hasMore }, customer] = await Promise.all([
    queryTransactions({
      shopId: shop.id,
      customerId: filters.customer,
      type: filters.type,
      from: filters.from,
      to: filters.to,
      limit: PAGE_SIZE,
      offset: (filters.page - 1) * PAGE_SIZE,
    }),
    filters.customer ? getCustomer(shop.id, filters.customer) : null,
  ]);

  const base = { type: filters.type, customer: filters.customer };
  const presets = periodPresets();
  const periods = [
    { label: t.history.today, ...presets.today },
    { label: t.history.last7, ...presets.last7 },
    { label: t.history.last30, ...presets.last30 },
    { label: t.history.allTime, from: undefined, to: undefined },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t.nav.history} />

      {customer && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-brand-soft px-4 py-3">
          <Link href={`/customers/${customer.id}`} className="truncate font-semibold text-brand-strong">
            {t.history.customerFilter.replace("{name}", customer.name)}
          </Link>
          <Link
            href={historyHref({ ...filters, customer: undefined, page: 1 })}
            aria-label={t.history.reset}
            className="text-xl leading-none font-bold text-brand-strong"
          >
            ×
          </Link>
        </div>
      )}

      <nav aria-label={t.history.period} className="flex flex-wrap gap-2">
        {periods.map((p) => {
          const active = filters.from === p.from && filters.to === p.to;
          return (
            <Link
              key={p.label}
              href={historyHref({ ...base, from: p.from, to: p.to })}
              aria-current={active ? "true" : undefined}
              className={`flex min-h-10 items-center rounded-full border-2 px-4 text-sm font-semibold ${
                active ? "border-brand bg-brand text-white" : "border-border bg-surface"
              }`}
            >
              {p.label}
            </Link>
          );
        })}
      </nav>

      <details className="rounded-2xl border border-border bg-surface" open={Boolean(filters.type)}>
        <summary className="min-h-12 cursor-pointer px-4 py-3 text-base font-semibold">{t.history.filters}</summary>
        <Form action="/history" className="flex flex-col gap-4 px-4 pb-4">
          {filters.customer && <input type="hidden" name="customer" value={filters.customer} />}
          <label className="flex flex-col gap-1.5">
            <span className="text-base font-semibold">{t.history.type}</span>
            <select
              name="type"
              defaultValue={filters.type ?? ""}
              className="min-h-12 rounded-xl border-2 border-border bg-surface px-3 text-lg"
            >
              <option value="">{t.history.allTypes}</option>
              {TYPES.map((type) => (
                <option key={type} value={type}>
                  {t.transactions.type[type]}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-base font-semibold">{t.history.from}</span>
              <input
                type="date"
                name="from"
                max={today}
                defaultValue={filters.from}
                className="min-h-12 rounded-xl border-2 border-border bg-surface px-3 text-base"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-base font-semibold">{t.history.to}</span>
              <input
                type="date"
                name="to"
                max={today}
                defaultValue={filters.to}
                className="min-h-12 rounded-xl border-2 border-border bg-surface px-3 text-base"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Link
              href={historyHref({ customer: filters.customer })}
              className="flex min-h-12 items-center justify-center rounded-xl border-2 border-border font-semibold"
            >
              {t.history.reset}
            </Link>
            <button type="submit" className="min-h-12 rounded-xl bg-brand font-semibold text-white">
              {t.history.apply}
            </button>
          </div>
        </Form>
      </details>

      {items.length ? (
        <TransactionList transactions={items} canReverse={role === "owner"} />
      ) : (
        <p className="rounded-2xl border border-dashed border-border bg-surface p-5 text-muted">{t.history.empty}</p>
      )}

      {(filters.page > 1 || hasMore) && (
        <nav className="flex items-center justify-between gap-3" aria-label={t.history.page.replace("{page}", String(filters.page))}>
          {filters.page > 1 ? (
            <Link href={historyHref({ ...filters, page: filters.page - 1 })} className="min-h-12 rounded-xl border-2 border-border px-4 py-2.5 font-semibold">
              {t.history.previous}
            </Link>
          ) : (
            <span />
          )}
          <span className="text-sm text-muted">{t.history.page.replace("{page}", String(filters.page))}</span>
          {hasMore ? (
            <Link href={historyHref({ ...filters, page: filters.page + 1 })} className="min-h-12 rounded-xl border-2 border-border px-4 py-2.5 font-semibold">
              {t.history.next}
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
