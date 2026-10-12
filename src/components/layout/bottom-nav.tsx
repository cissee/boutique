"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { getMessages } from "@/i18n";
import {
  addDebtItem,
  customersItem,
  dashboardItem,
  isActive,
  moreItem,
  moreNavItems,
  repaymentsItem,
  type NavItem,
} from "./nav-items";

const t = getMessages();

/**
 * Navigation mobile : 4 onglets + bouton central « Dette ».
 * L'URL n'est connue qu'à la requête sur les routes dynamiques : la barre est d'abord
 * rendue sans onglet actif (coquille statique), puis complétée.
 */
export function BottomNav() {
  return (
    <Suspense fallback={<BottomNavView pathname="" />}>
      <BottomNavWithPath />
    </Suspense>
  );
}

function BottomNavWithPath() {
  return <BottomNavView pathname={usePathname()} />;
}

function BottomNavView({ pathname }: { pathname: string }) {
  const moreActive =
    isActive(pathname, moreItem.href) || moreNavItems.some((item) => isActive(pathname, item.href));

  return (
    <nav
      aria-label={t.nav.mainLabel}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5 items-end">
        <Tab item={dashboardItem} active={isActive(pathname, dashboardItem.href)} />
        <Tab item={customersItem} active={isActive(pathname, customersItem.href)} />
        <li className="flex justify-center">
          <Link
            href={addDebtItem.href}
            aria-label={t.nav.addDebtLong}
            className="-mt-6 flex h-16 w-16 flex-col items-center justify-center rounded-full bg-brand text-white shadow-lg ring-4 ring-background active:bg-brand-strong"
          >
            <addDebtItem.icon width={28} height={28} strokeWidth={2.5} />
            <span className="text-[11px] font-semibold leading-none">{t.nav.addDebt}</span>
          </Link>
        </li>
        <Tab item={repaymentsItem} active={isActive(pathname, repaymentsItem.href)} />
        <Tab item={moreItem} active={moreActive} />
      </ul>
    </nav>
  );
}

function Tab({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <li>
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={`flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-xs font-medium ${
          active ? "text-brand" : "text-muted"
        }`}
      >
        <Icon strokeWidth={active ? 2.5 : 2} />
        <span className="truncate">{t.nav[item.labelKey]}</span>
      </Link>
    </li>
  );
}
