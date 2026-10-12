"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { ChevronRightIcon } from "@/components/icons";
import { balanceTone, Money } from "@/components/ui/money";
import { getMessages } from "@/i18n";
import { formatPhone } from "@/lib/format/phone";
import { matcher } from "@/lib/search";
import type { CustomerListItem } from "@/server/queries/customers";

const t = getMessages();

type Filter = "all" | "debtors";

/** Liste des clients avec recherche instantanée (filtrage local, sans aller-retour serveur). */
export function CustomerList({ customers }: { customers: CustomerListItem[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const deferredQuery = useDeferredValue(query);

  const visible = useMemo(() => {
    const matches = matcher(deferredQuery);
    return customers.filter((c) => (filter === "all" || c.balance > 0) && matches(c));
  }, [customers, deferredQuery, filter]);

  if (!customers.length) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border bg-surface p-8 text-center">
        <p className="text-base text-muted">{t.customers.empty}</p>
        <Link
          href="/customers/new"
          className="flex min-h-12 items-center rounded-xl bg-brand px-6 font-semibold text-white"
        >
          {t.customers.emptyCta}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="sticky top-0 z-10 -mx-4 flex flex-col gap-3 bg-background px-4 pt-1 pb-2 md:-mx-8 md:px-8">
        <label className="sr-only" htmlFor="customer-search">
          {t.customers.searchLabel}
        </label>
        <input
          id="customer-search"
          type="search"
          inputMode="search"
          autoComplete="off"
          placeholder={t.customers.searchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="min-h-12 rounded-xl border-2 border-border bg-surface px-4 text-lg outline-none focus:border-brand"
        />
        <div className="flex gap-2" role="group">
          <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
            {t.customers.filterAll}
          </FilterChip>
          <FilterChip active={filter === "debtors"} onClick={() => setFilter("debtors")}>
            {t.customers.filterDebtors}
          </FilterChip>
        </div>
      </div>

      <p className="text-sm text-muted" aria-live="polite">
        {visible.length
          ? t.customers.count.replace("{count}", String(visible.length))
          : t.customers.noResults.replace("{query}", query)}
      </p>

      {visible.length > 0 && (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {visible.map((c) => (
            <li key={c.customer_id}>
              <Link
                href={`/customers/${c.customer_id}`}
                className="flex min-h-16 items-center gap-3 px-4 py-3 active:bg-background"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-base font-semibold">{c.name}</span>
                  {c.phone && <span className="text-sm text-muted">{formatPhone(c.phone)}</span>}
                </span>
                <span className="flex flex-col items-end">
                  {c.balance > 0 ? (
                    <Money amount={c.balance} tone={balanceTone(c.balance)} />
                  ) : (
                    <span className="text-sm font-semibold text-repayment">{t.customers.settled}</span>
                  )}
                </span>
                <ChevronRightIcon className="shrink-0 text-muted" width={20} height={20} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-10 rounded-full border-2 px-4 text-sm font-semibold ${
        active ? "border-brand bg-brand text-white" : "border-border bg-surface text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
