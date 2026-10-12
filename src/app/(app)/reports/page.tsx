import type { Metadata } from "next";
import { ComingSoon, PageHeader } from "@/components/layout/page-header";
import { getMessages } from "@/i18n";
import { requireShop } from "@/lib/auth/session";

const t = getMessages();

export const metadata: Metadata = { title: t.nav.reports };

export default async function ReportsPage() {
  await requireShop();
  return (
    <>
      <PageHeader title={t.nav.reports} />
      <ComingSoon step="Rapports, PDF et export : après l'étape 8." />
    </>
  );
}
