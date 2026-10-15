import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRightIcon } from "@/components/icons";
import { PageHeader } from "@/components/layout/page-header";
import { moreNavItems } from "@/components/layout/nav-items";
import { getMessages } from "@/i18n";
import { requireShop } from "@/lib/auth/session";

const t = getMessages();

export const metadata: Metadata = { title: t.nav.more };

// Données lues en base à chaque requête : voir le commentaire de (app)/layout.tsx.
export const instant = false;

export default async function MorePage() {
  await requireShop();
  return (
    <>
      <PageHeader title={t.nav.more} />
      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
        {moreNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link href={item.href} className="flex min-h-14 items-center gap-3 px-4 text-base font-medium">
                <Icon className="text-brand" />
                <span className="flex-1">{t.nav[item.labelKey]}</span>
                <ChevronRightIcon className="text-muted" />
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
