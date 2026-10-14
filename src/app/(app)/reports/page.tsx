import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Money } from "@/components/ui/money";
import { getMessages } from "@/i18n";
import { requireShop } from "@/lib/auth/session";
import { formatDate, todayISODate } from "@/lib/format/date";
import { isoDate, periodPresets, type PeriodKey } from "@/lib/periods";
import { getPeriodReport } from "@/server/queries/reports";

const t = getMessages();

export const metadata: Metadata = { title: t.nav.reports };

const PRESET_LABELS: Record<PeriodKey, string> = {
  today: t.reports.today,
  last7: t.reports.last7,
  month: t.reports.month,
  last30: t.reports.last30,
};

export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  const { shop, role } = await requireShop();
  const params = await searchParams;
  const presets = periodPresets();
  const today = todayISODate();

  // Période : paramètres d'URL valides, sinon « ce mois ».
  let from = isoDate(params.from) ?? presets.month.from;
  let to = isoDate(params.to) ?? presets.month.to;
  if (to > today) to = today;
  if (from > to) from = to;

  const report = await getPeriodReport(shop.id, from, to);
  const net = report.debtsTotal - report.repaymentsTotal;
  const query = `from=${from}&to=${to}`;
  const isOwner = role === "owner";
  const methods = Object.entries(report.repaymentsByMethod).sort((a, b) => b[1] - a[1]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t.nav.reports} />

      <nav aria-label={t.reports.period} className="flex flex-wrap gap-2">
        {(Object.keys(PRESET_LABELS) as PeriodKey[]).map((key) => {
          const active = presets[key].from === from && presets[key].to === to;
          return (
            <Link
              key={key}
              href={`/reports?from=${presets[key].from}&to=${presets[key].to}`}
              aria-current={active ? "true" : undefined}
              className={`flex min-h-10 items-center rounded-full border-2 px-4 text-sm font-semibold ${
                active ? "border-brand bg-brand text-white" : "border-border bg-surface"
              }`}
            >
              {PRESET_LABELS[key]}
            </Link>
          );
        })}
      </nav>

      <details className="rounded-2xl border border-border bg-surface">
        <summary className="min-h-12 cursor-pointer px-4 py-3 text-base font-semibold">{t.reports.custom}</summary>
        <Form action="/reports" className="flex flex-col gap-4 px-4 pb-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-base font-semibold">{t.history.from}</span>
              <input type="date" name="from" max={today} defaultValue={from} className="min-h-12 rounded-xl border-2 border-border bg-surface px-3 text-base" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-base font-semibold">{t.history.to}</span>
              <input type="date" name="to" max={today} defaultValue={to} className="min-h-12 rounded-xl border-2 border-border bg-surface px-3 text-base" />
            </label>
          </div>
          <button type="submit" className="min-h-12 rounded-xl bg-brand font-semibold text-white">
            {t.reports.show}
          </button>
        </Form>
      </details>

      <p className="text-base font-semibold">
        {t.reports.range.replace("{from}", formatDate(from)).replace("{to}", formatDate(to))}
      </p>

      <section className="grid grid-cols-2 gap-3">
        <Card label={t.reports.debts} sub={t.reports.operations.replace("{count}", String(report.debtsCount))}>
          <Money amount={report.debtsTotal} tone="debt" className="text-xl font-bold" />
        </Card>
        <Card label={t.reports.repayments} sub={t.reports.operations.replace("{count}", String(report.repaymentsCount))}>
          <Money amount={report.repaymentsTotal} tone="repayment" className="text-xl font-bold" />
        </Card>
        <Card label={t.reports.netChange} sub={net > 0 ? t.reports.netUp : net < 0 ? t.reports.netDown : undefined} wide>
          <Money
            amount={Math.abs(net)}
            sign={net > 0 ? "+" : net < 0 ? "−" : undefined}
            tone={net > 0 ? "debt" : net < 0 ? "repayment" : "neutral"}
            className="text-2xl font-bold"
          />
        </Card>
        <Card label={t.reports.outstandingEnd} wide>
          <Money amount={report.outstandingEnd} tone={report.outstandingEnd > 0 ? "debt" : "neutral"} className="text-2xl font-bold" />
        </Card>
        <Card label={t.reports.newCustomers}>
          <span className="tabular text-2xl font-bold">{report.newCustomers}</span>
        </Card>
        <Card label={t.reports.reversals}>
          <span className="tabular text-2xl font-bold">{report.reversalsCount}</span>
        </Card>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">{t.reports.byMethod}</h2>
        {methods.length ? (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {methods.map(([method, total]) => (
              <li key={method} className="flex min-h-12 items-center justify-between gap-3 px-4 py-2">
                <span className="text-base">
                  {method === "NONE"
                    ? t.reports.methodNone
                    : (t.transactions.paymentMethod[method as keyof typeof t.transactions.paymentMethod] ?? method)}
                </span>
                <Money amount={total} tone="repayment" />
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl border border-dashed border-border bg-surface p-4 text-muted">{t.reports.noRepayments}</p>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-lg font-bold">{t.reports.exportTitle}</h2>
        {isOwner ? (
          <>
            <p className="text-sm text-muted">{t.reports.exportIntro}</p>
            <ExportLink href={`/export/transactions?${query}`}>{t.reports.exportPeriod}</ExportLink>
            <ExportLink href="/export/transactions">{t.reports.exportAll}</ExportLink>
            <ExportLink href="/export/customers">{t.reports.exportCustomers}</ExportLink>
          </>
        ) : (
          <p className="text-sm text-muted">{t.reports.exportOwnerOnly}</p>
        )}
        <p className="text-sm text-muted">{t.reports.statementHint}</p>
      </section>
    </div>
  );
}

function Card({ label, sub, wide, children }: { label: string; sub?: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={`flex flex-col gap-1 rounded-2xl border border-border bg-surface p-4 ${wide ? "col-span-2" : ""}`}>
      <p className="text-sm font-medium text-muted">{label}</p>
      {children}
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
}

function ExportLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      download
      className="flex min-h-12 items-center justify-between gap-3 rounded-xl border-2 border-border px-4 font-semibold"
    >
      {children}
      <span aria-hidden="true" className="text-muted">
        CSV ↓
      </span>
    </a>
  );
}
