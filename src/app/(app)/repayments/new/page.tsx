import type { Metadata } from "next";
import { RepaymentForm } from "@/components/ledger/repayment-form";
import { PageHeader } from "@/components/layout/page-header";
import { getMessages } from "@/i18n";
import { requireShop } from "@/lib/auth/session";
import { todayISODate } from "@/lib/format/date";
import { listCustomers } from "@/server/queries/customers";

const t = getMessages();

export const metadata: Metadata = { title: t.ledger.repaymentTitle };

// Données lues en base à chaque requête : voir le commentaire de (app)/layout.tsx.
export const instant = false;

export default async function NewRepaymentPage({ searchParams }: PageProps<"/repayments/new">) {
  const { shop } = await requireShop();
  const [{ customer }, customers] = await Promise.all([searchParams, listCustomers(shop.id)]);
  const debtors = customers
    .filter((c) => c.balance > 0)
    .map((c) => ({ id: c.customer_id, name: c.name, phone: c.phone, balance: c.balance }));

  return (
    <>
      <PageHeader title={t.ledger.repaymentTitle} />
      <RepaymentForm
        customers={debtors}
        initialCustomerId={typeof customer === "string" ? customer : null}
        initialRequestId={crypto.randomUUID()}
        today={todayISODate()}
      />
    </>
  );
}
