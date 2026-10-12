import Link from "next/link";
import { ReverseTransactionForm } from "@/components/ledger/reverse-transaction-form";
import { Money } from "@/components/ui/money";
import { getMessages } from "@/i18n";
import { formatDateTime } from "@/lib/format/date";
import type { TransactionItem } from "@/server/queries/ledger";

const t = getMessages();

/** Signe = effet sur le solde (une annulation inverse l'opération d'origine). */
function display(tx: TransactionItem): { sign: "+" | "−"; tone: "debt" | "repayment" | "neutral" } {
  const sign = tx.balance_effect > 0 ? "+" : "−";
  if (tx.type === "REVERSAL") return { sign, tone: "neutral" };
  return { sign, tone: tx.balance_effect > 0 ? "debt" : "repayment" };
}

/** `canReverse` : affiche le bouton d'annulation (propriétaire uniquement, revérifié côté serveur). */
export function TransactionList({
  transactions,
  canReverse = false,
}: {
  transactions: TransactionItem[];
  canReverse?: boolean;
}) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
      {transactions.map((tx) => {
        const { sign, tone } = display(tx);
        return (
          <li key={tx.id} className={`flex items-start gap-3 px-4 py-3 ${tx.isReversed ? "opacity-60" : ""}`}>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex flex-wrap items-center gap-2">
                <span className={`text-base font-semibold ${tx.isReversed ? "line-through" : ""}`}>
                  {t.transactions.type[tx.type]}
                </span>
                {tx.isReversed && (
                  <span className="rounded-full bg-background px-2 py-0.5 text-xs font-semibold text-muted">
                    {t.transactions.reversed}
                  </span>
                )}
                {tx.payment_method && (
                  <span className="text-sm text-muted">
                    · {t.transactions.paymentMethod[tx.payment_method as keyof typeof t.transactions.paymentMethod] ?? tx.payment_method}
                  </span>
                )}
              </span>
              {tx.customer && (
                <Link href={`/customers/${tx.customer.id}`} className="truncate text-base font-medium text-brand">
                  {tx.customer.name}
                </Link>
              )}
              {tx.description && <span className="text-sm break-words">{tx.description}</span>}
              <span className="text-xs text-muted">
                {formatDateTime(tx.occurred_at)}
                {tx.createdByName && ` · ${t.customers.by.replace("{name}", tx.createdByName)}`}
              </span>
              {canReverse && tx.type !== "REVERSAL" && !tx.isReversed && (
                <ReverseTransactionForm transactionId={tx.id} requestId={crypto.randomUUID()} />
              )}
            </span>
            <Money amount={tx.amount} tone={tone} sign={sign} className={tx.isReversed ? "line-through" : ""} />
          </li>
        );
      })}
    </ul>
  );
}
