import type { Metadata } from "next";
import { ComingSoon, PageHeader } from "@/components/layout/page-header";
import { getMessages } from "@/i18n";
import { requireShop } from "@/lib/auth/session";

const t = getMessages();

export const metadata: Metadata = { title: t.nav.history };

export default async function HistoryPage() {
  await requireShop();
  return (
    <>
      <PageHeader title={t.nav.history} />
      <ComingSoon step="Historique complet : après l'étape 8." />
    </>
  );
}
