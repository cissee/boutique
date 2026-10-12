"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { getMessages } from "@/i18n";
import { addDebtItem, isActive, sideNavItems } from "./nav-items";

const t = getMessages();

/**
 * Navigation pour tablettes et ordinateurs.
 * L'URL n'est connue qu'à la requête sur les routes dynamiques : la barre est d'abord
 * rendue sans onglet actif (coquille statique), puis complétée.
 */
export function SideNav() {
  return (
    <Suspense fallback={<SideNavView pathname="" />}>
      <SideNavWithPath />
    </Suspense>
  );
}

function SideNavWithPath() {
  return <SideNavView pathname={usePathname()} />;
}

function SideNavView({ pathname }: { pathname: string }) {
  return (
    <nav
      aria-label={t.nav.mainLabel}
      className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-6 border-r border-border bg-surface p-4 md:flex"
    >
      <Link href="/dashboard" className="px-3 pt-2 text-xl font-bold text-brand">
        {t.app.name}
      </Link>

      <Link
        href={addDebtItem.href}
        className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-base font-semibold text-white hover:bg-brand-strong"
      >
        <addDebtItem.icon />
        {t.nav.addDebtLong}
      </Link>

      <ul className="flex flex-col gap-1">
        {sideNavItems.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-base font-medium ${
                  active ? "bg-brand-soft text-brand-strong" : "text-foreground hover:bg-background"
                }`}
              >
                <Icon />
                {t.nav[item.labelKey]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
