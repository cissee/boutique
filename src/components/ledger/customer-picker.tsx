"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { balanceTone, Money } from "@/components/ui/money";
import { getMessages } from "@/i18n";
import { formatPhone } from "@/lib/format/phone";
import { matcher } from "@/lib/search";

const t = getMessages();

export type PickerCustomer = { id: string; name: string; phone: string | null; balance: number };

const MAX_SUGGESTIONS = 8;

/** Sélection d'un client par recherche (nom ou téléphone). Envoie `customerId` dans le formulaire. */
export function CustomerPicker({
  customers,
  value,
  onChange,
  errors,
  emptyMessage = t.customers.empty,
}: {
  customers: PickerCustomer[];
  value: string | null;
  onChange: (id: string | null) => void;
  errors?: string[];
  emptyMessage?: string;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const selected = customers.find((c) => c.id === value) ?? null;

  const suggestions = useMemo(() => {
    const matches = matcher(query);
    return customers.filter(matches).slice(0, MAX_SUGGESTIONS);
  }, [customers, query]);

  return (
    <div className="flex flex-col gap-1.5">
      <input type="hidden" name="customerId" value={selected?.id ?? ""} />
      <label htmlFor={id} className="text-base font-semibold">
        {t.ledger.customer}
      </label>

      {selected ? (
        <div className="flex items-center gap-3 rounded-xl border-2 border-brand bg-brand-soft px-4 py-3">
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-lg font-semibold">{selected.name}</span>
            <span className="text-sm">
              {t.ledger.currentBalance} :{" "}
              <Money amount={selected.balance} tone={balanceTone(selected.balance)} />
            </span>
          </span>
          <button
            id={id}
            type="button"
            onClick={() => {
              onChange(null);
              setQuery("");
            }}
            className="min-h-11 rounded-lg border-2 border-brand bg-surface px-3 text-sm font-semibold text-brand"
          >
            {t.ledger.changeCustomer}
          </button>
        </div>
      ) : customers.length === 0 ? (
        <div className="flex flex-col gap-3 rounded-xl border border-dashed border-border bg-surface p-4">
          <p className="text-base text-muted">{emptyMessage}</p>
          <Link href="/customers/new" className="font-semibold text-brand underline-offset-4 hover:underline">
            {t.ledger.createCustomer}
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <input
            id={id}
            type="search"
            autoComplete="off"
            placeholder={t.customers.searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-invalid={errors?.length ? true : undefined}
            className={`min-h-12 rounded-xl border-2 bg-surface px-4 text-lg outline-none focus:border-brand ${
              errors?.length ? "border-debt" : "border-border"
            }`}
          />
          {suggestions.length ? (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
              {suggestions.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onChange(c.id)}
                    className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left active:bg-background"
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-base font-semibold">{c.name}</span>
                      {c.phone && <span className="text-sm text-muted">{formatPhone(c.phone)}</span>}
                    </span>
                    <Money amount={c.balance} tone={balanceTone(c.balance)} className="text-sm" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">{t.ledger.noCustomerMatch}</p>
          )}
        </div>
      )}

      {errors?.length ? <p className="text-sm font-medium text-debt">{t.ledger.chooseCustomer}</p> : null}
    </div>
  );
}
