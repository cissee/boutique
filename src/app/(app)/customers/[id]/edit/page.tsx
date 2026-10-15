import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CustomerForm } from "@/components/customers/customer-form";
import { PageHeader } from "@/components/layout/page-header";
import { getMessages } from "@/i18n";
import { requireShop } from "@/lib/auth/session";
import { updateCustomer } from "@/server/actions/customers";
import { getCustomer } from "@/server/queries/customers";

const t = getMessages();

export const metadata: Metadata = { title: t.customers.editTitle };

// Données lues en base à chaque requête : voir le commentaire de (app)/layout.tsx.
export const instant = false;

export default async function EditCustomerPage({ params }: PageProps<"/customers/[id]/edit">) {
  const { id } = await params;
  const { shop } = await requireShop();
  const customer = await getCustomer(shop.id, id);
  if (!customer) notFound();

  return (
    <>
      <PageHeader title={t.customers.editTitle} />
      <CustomerForm action={updateCustomer} customer={customer} submitLabel={t.common.save} />
    </>
  );
}
