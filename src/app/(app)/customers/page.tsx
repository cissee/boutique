import type { Metadata } from "next";
import Link from "next/link";
import { CustomerList } from "@/components/customers/customer-list";
import { PlusIcon } from "@/components/icons";
import { PageHeader } from "@/components/layout/page-header";
import { SnapshotSaver } from "@/components/pwa/snapshot-saver";
import { toSnapshotCustomers } from "@/lib/offline/snapshot";
import { getMessages } from "@/i18n";
import { requireShop } from "@/lib/auth/session";
import { listCustomers } from "@/server/queries/customers";

const t = getMessages();

export const metadata: Metadata = { title: t.nav.customers };

export default async function CustomersPage() {
  const { shop, user } = await requireShop();
  const customers = await listCustomers(shop.id);

  return (
    <>
      <PageHeader
        title={t.nav.customers}
        action={
          <Link
            href="/customers/new"
            className="flex min-h-12 items-center gap-2 rounded-xl bg-brand px-4 text-base font-semibold text-white active:bg-brand-strong"
          >
            <PlusIcon width={20} height={20} />
            {t.customers.newButton}
          </Link>
        }
      />
      <CustomerList customers={customers} />
      <SnapshotSaver
        userId={user.id}
        shopId={shop.id}
        shopName={shop.name}
        customers={toSnapshotCustomers(customers)}
      />
    </>
  );
}
