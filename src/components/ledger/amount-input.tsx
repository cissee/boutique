"use client";

import { useId, type ReactNode } from "react";
import { formatAmountInput } from "@/lib/format/currency";

/** Montant en FCFA : pavé numérique, séparateurs de milliers pendant la saisie. */
export function AmountInput({
  label,
  value,
  onChange,
  errors,
  children,
}: {
  label: string;
  value: string;
  onChange: (formatted: string) => void;
  errors?: string[];
  /** Raccourcis affichés sous le champ (ex. « Tout rembourser »). */
  children?: ReactNode;
}) {
  const id = useId();
  const hasError = Boolean(errors?.length);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-base font-semibold">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name="amount"
          inputMode="numeric"
          autoComplete="off"
          enterKeyHint="done"
          placeholder="0"
          value={value}
          onChange={(e) => onChange(formatAmountInput(e.target.value))}
          aria-invalid={hasError || undefined}
          className={`tabular min-h-16 w-full rounded-xl border-2 bg-surface py-2 pr-20 pl-4 text-3xl font-bold outline-none focus:border-brand ${
            hasError ? "border-debt" : "border-border"
          }`}
        />
        <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-lg font-semibold text-muted">
          FCFA
        </span>
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
      {hasError && <p className="text-sm font-medium text-debt">{errors![0]}</p>}
    </div>
  );
}

export function AmountChip({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tabular min-h-10 rounded-full border-2 border-border bg-surface px-4 text-sm font-semibold active:border-brand"
    >
      {children}
    </button>
  );
}
