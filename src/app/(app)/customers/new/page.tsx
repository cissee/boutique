import type { Metadata } from "next";
import { CustomerForm } from "@/components/customers/customer-form";
import { PageHeader } from "@/components/layout/page-header";
import { getMessages } from "@/i18n";
import { requireShop } from "@/lib/auth/session";
import { createCustomer } from "@/server/actions/customers";

const t = getMessages();

export const metadata: Metadata = { title: t.customers.newTitle };

// Données lues en base à chaque requête : voir le commentaire de (app)/layout.tsx.
export const instant = false;

export default async function NewCustomerPage() {
  await requireShop();
  return (
    <>
      <PageHeader title={t.customers.newTitle} />
      <CustomerForm action={createCustomer} submitLabel={t.common.save} />
    </>
  );
}
