import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRightIcon, PlusIcon, WalletIcon } from "@/components/icons";
import { TransactionList } from "@/components/transactions/transaction-list";
import { Money } from "@/components/ui/money";
import { getMessages } from "@/i18n";
import { requireShop } from "@/lib/auth/session";
import { getDashboardStats, getTopDebtors } from "@/server/queries/dashboard";
import { fetchTransactions } from "@/server/queries/ledger";

const t = getMessages();

export const metadata: Metadata = { title: t.nav.dashboard };

const RECENT_LIMIT = 8;

export default async function DashboardPage() {
  const { shop } = await requireShop();
  const [stats, topDebtors, recent] = await Promise.all([
    getDashboardStats(shop.id),
    getTopDebtors(shop.id),
    fetchTransactions({ shopId: shop.id, limit: RECENT_LIMIT }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-sm font-medium text-muted">{t.nav.dashboard}</p>
        <h1 className="text-2xl font-bold break-words">{shop.name}</h1>
      </header>

      <Link
        href="/debts/new"
        className="flex min-h-16 items-center justify-center gap-3 rounded-2xl bg-brand px-6 text-xl font-bold text-white shadow-sm active:bg-brand-strong"
      >
        <PlusIcon width={28} height={28} strokeWidth={2.5} />
        {t.nav.addDebtLong}
      </Link>

      <section className="grid grid-cols-2 gap-3">
        <StatCard label={t.dashboard.totalOutstanding} wide>
          <Money amount={stats.totalOutstanding} tone={stats.totalOutstanding > 0 ? "debt" : "neutral"} className="text-3xl font-bold" />
        </StatCard>
        <StatCard
          label={t.dashboard.debtors}
          sub={t.dashboard.debtorsOf.replace("{count}", String(stats.customerCount))}
        >
          <span className="tabular text-3xl font-bold">{stats.debtorCount}</span>
        </StatCard>
        <StatCard
          label={t.dashboard.repaymentsToday}
          sub={t.dashboard.operations.replace("{count}", String(stats.repaymentsTodayCount))}
        >
          <Money amount={stats.repaymentsToday} tone="repayment" className="text-xl font-bold" />
        </StatCard>
        <StatCard
          label={t.dashboard.debtsToday}
          sub={t.dashboard.operations.replace("{count}", String(stats.debtsTodayCount))}
          wide
        >
          <Money amount={stats.debtsToday} className="text-xl font-bold" />
        </StatCard>
      </section>

      <Link
        href="/repayments/new"
        className="flex min-h-14 items-center justify-center gap-2 rounded-xl border-2 border-repayment bg-surface px-6 text-lg font-semibold text-repayment"
      >
        <WalletIcon />
        {t.nav.repayments}
      </Link>

      {stats.customerCount === 0 ? (
        <section className="flex flex-col gap-3 rounded-2xl border border-dashed border-border bg-surface p-5">
          <h2 className="text-lg font-bold">{t.dashboard.welcomeTitle}</h2>
          <p className="text-base text-muted">{t.dashboard.welcomeText}</p>
          <Link href="/customers/new" className="font-semibold text-brand underline-offset-4 hover:underline">
            {t.customers.emptyCta}
          </Link>
        </section>
      ) : (
        <>
          {topDebtors.length > 0 && (
            <section className="flex flex-col gap-3">
              <SectionHeader title={t.dashboard.topDebtors} href="/customers" linkLabel={t.dashboard.seeAllCustomers} />
              <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
                {topDebtors.map((c) => (
                  <li key={c.id}>
                    <Link href={`/customers/${c.id}`} className="flex min-h-14 items-center gap-3 px-4 py-2 active:bg-background">
                      <span className="flex-1 truncate text-base font-semibold">{c.name}</span>
                      <Money amount={c.balance} tone="debt" />
                      <ChevronRightIcon className="shrink-0 text-muted" width={20} height={20} />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="flex flex-col gap-3">
            <SectionHeader title={t.dashboard.recent} href="/history" linkLabel={t.dashboard.seeAll} />
            {recent.length ? (
              <TransactionList transactions={recent} />
            ) : (
              <p className="rounded-2xl border border-dashed border-border bg-surface p-5 text-muted">
                {t.dashboard.noActivity}
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function StatCard({ label, sub, wide, children }: { label: string; sub?: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={`flex flex-col gap-1 rounded-2xl border border-border bg-surface p-4 ${wide ? "col-span-2" : ""}`}>
      <p className="text-sm font-medium text-muted">{label}</p>
      {children}
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
}

function SectionHeader({ title, href, linkLabel }: { title: string; href: string; linkLabel: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="text-lg font-bold">{title}</h2>
      <Link href={href} className="text-sm font-semibold text-brand underline-offset-4 hover:underline">
        {linkLabel}
      </Link>
    </div>
  );
}
