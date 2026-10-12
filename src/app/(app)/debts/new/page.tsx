import type { Metadata } from "next";
import { DebtForm } from "@/components/ledger/debt-form";
import { PageHeader } from "@/components/layout/page-header";
import { getMessages } from "@/i18n";
import { requireShop } from "@/lib/auth/session";
import { todayISODate } from "@/lib/format/date";
import { listCustomers } from "@/server/queries/customers";

const t = getMessages();

export const metadata: Metadata = { title: t.ledger.debtTitle };

export default async function NewDebtPage({ searchParams }: PageProps<"/debts/new">) {
  const { shop } = await requireShop();
  const [{ customer }, customers] = await Promise.all([searchParams, listCustomers(shop.id)]);

  return (
    <>
      <PageHeader title={t.ledger.debtTitle} />
      <DebtForm
        customers={customers.map((c) => ({ id: c.customer_id, name: c.name, phone: c.phone, balance: c.balance }))}
        initialCustomerId={typeof customer === "string" ? customer : null}
        initialRequestId={crypto.randomUUID()}
        today={todayISODate()}
      />
    </>
  );
}
