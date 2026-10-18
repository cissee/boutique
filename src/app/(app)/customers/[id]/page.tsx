import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArchiveCustomerButton } from "@/components/customers/archive-customer-button";
import { StatementActions } from "@/components/customers/statement-actions";
import { PlusIcon, WalletIcon } from "@/components/icons";
import { TransactionList } from "@/components/transactions/transaction-list";
import { balanceTone, Money } from "@/components/ui/money";
import { getMessages } from "@/i18n";
import { requireShop } from "@/lib/auth/session";
import { formatPhone } from "@/lib/format/phone";
import { CUSTOMER_HISTORY_LIMIT, getCustomer, getCustomerTransactions } from "@/server/queries/customers";

const t = getMessages();

// Données lues en base à chaque requête : voir le commentaire de (app)/layout.tsx.
export const instant = false;

export async function generateMetadata({ params }: PageProps<"/customers/[id]">): Promise<Metadata> {
  const { id } = await params;
  const { shop } = await requireShop();
  const customer = await getCustomer(shop.id, id);
  return { title: customer?.name ?? t.nav.customers };
}

export default async function CustomerPage({ params }: PageProps<"/customers/[id]">) {
  const { id } = await params;
  const { shop, role } = await requireShop();
  const customer = await getCustomer(shop.id, id);
  if (!customer) notFound();

  const transactions = await getCustomerTransactions(shop.id, customer.id);
  const archived = customer.archived_at !== null;
  const settled = customer.balance === 0;
  const pill = "flex min-h-12 items-center rounded-xl border-2 border-border px-4";

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold break-words">{customer.name}</h1>
          {archived && (
            <span className="rounded-full bg-border px-3 py-1 text-sm font-semibold">{t.customers.archivedBadge}</span>
          )}
        </div>
        {customer.phone && <p className="text-base text-muted">{formatPhone(customer.phone)}</p>}
      </header>

      <section className="flex flex-col gap-1 rounded-2xl border border-border bg-surface p-5">
        <p className="text-sm font-medium text-muted">{t.customers.balance}</p>
        <Money amount={customer.balance} tone={balanceTone(customer.balance)} className="text-4xl font-bold" />
        {settled && <p className="text-sm font-semibold text-repayment">{t.customers.settled}</p>}
      </section>

      {!archived && (
        <div className="grid grid-cols-2 gap-3">
          <Link
            href={`/debts/new?customer=${customer.id}`}
            className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-brand px-3 text-base font-semibold text-white active:bg-brand-strong"
          >
            <PlusIcon width={20} height={20} />
            {t.customers.addDebt}
          </Link>
          {settled ? (
            <span className="flex min-h-14 items-center justify-center gap-2 rounded-xl border-2 border-border px-3 text-base font-semibold text-muted">
              <WalletIcon width={20} height={20} />
              {t.customers.addRepayment}
            </span>
          ) : (
            <Link
              href={`/repayments/new?customer=${customer.id}`}
              className="flex min-h-14 items-center justify-center gap-2 rounded-xl border-2 border-repayment px-3 text-base font-semibold text-repayment"
            >
              <WalletIcon width={20} height={20} />
              {t.customers.addRepayment}
            </Link>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3 text-base font-semibold">
        {customer.phone && (
          <>
            <a href={`tel:${customer.phone}`} className={pill}>
              {t.customers.call}
            </a>
            <a
              href={`https://wa.me/${customer.phone.replace(/^\+/, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className={pill}
            >
              {t.customers.whatsapp}
            </a>
          </>
        )}
        <Link href={`/customers/${customer.id}/edit`} className={pill}>
          {t.customers.edit}
        </Link>
        <StatementActions customerId={customer.id} shopName={shop.name} className={pill} />
      </div>

      {customer.notes && (
        <section className="rounded-2xl bg-surface p-4 text-base break-words whitespace-pre-line">
          <h2 className="mb-1 text-sm font-semibold text-muted">{t.customers.notes}</h2>
          {customer.notes}
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">{t.customers.historyTitle}</h2>
        {transactions.length ? (
          <>
            <TransactionList
              transactions={transactions}
              canReverse={role === "owner"}
              receipts={{ shopName: shop.name, phone: customer.phone, currentBalance: customer.balance }}
            />
            {transactions.length === CUSTOMER_HISTORY_LIMIT && (
              <p className="text-sm text-muted">
                {t.customers.historyLimited.replace("{count}", String(CUSTOMER_HISTORY_LIMIT))}{" "}
                <Link href={`/history?customer=${customer.id}`} className="font-semibold text-brand underline-offset-4 hover:underline">
                  {t.dashboard.seeAll}
                </Link>
              </p>
            )}
          </>
        ) : (
          <p className="rounded-2xl border border-dashed border-border bg-surface p-5 text-muted">
            {t.customers.noTransactions}
          </p>
        )}
      </section>

      {role === "owner" && !archived && (
        <section className="flex flex-col gap-2 border-t border-border pt-6">
          {settled ? (
            <ArchiveCustomerButton customerId={customer.id} />
          ) : (
            <p className="text-sm text-muted">{t.customers.archiveNeedsZero}</p>
          )}
        </section>
      )}
    </div>
  );
}
