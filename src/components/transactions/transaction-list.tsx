import Link from "next/link";
import { CorrectTransactionForm } from "@/components/ledger/correct-transaction-form";
import { ReceiptButtons } from "@/components/ledger/receipt-buttons";
import { ReverseTransactionForm } from "@/components/ledger/reverse-transaction-form";
import { Money } from "@/components/ui/money";
import { getMessages } from "@/i18n";
import { formatDateTime } from "@/lib/format/date";
import { canCorrect } from "@/lib/ledger";
import { balancesAfter, repaymentReceipt } from "@/lib/receipt";
import type { TransactionItem } from "@/server/queries/ledger";

const t = getMessages();

/** Signe = effet sur le solde (une annulation inverse l'opération d'origine). */
function display(tx: TransactionItem): { sign: "+" | "−"; tone: "debt" | "repayment" | "neutral" } {
  const sign = tx.balance_effect > 0 ? "+" : "−";
  if (tx.type === "REVERSAL") return { sign, tone: "neutral" };
  return { sign, tone: tx.balance_effect > 0 ? "debt" : "repayment" };
}

/** Contexte pour proposer un reçu sur chaque remboursement (liste d'un seul client). */
export type ReceiptContext = { shopName: string; phone: string | null; currentBalance: number };

/**
 * `canReverse` : affiche le bouton d'annulation (propriétaire uniquement, revérifié côté serveur).
 * `receipts` : liste des opérations d'UN client, des plus récentes aux plus anciennes et complète
 * depuis la plus ancienne affichée ; le solde après chaque opération est alors recalculé exactement.
 * `corrections` : affiche « Modifier » (propriétaire, ou auteur pendant 30 minutes).
 */
export function TransactionList({
  transactions,
  canReverse = false,
  receipts,
  corrections,
}: {
  transactions: TransactionItem[];
  canReverse?: boolean;
  receipts?: ReceiptContext;
  corrections?: { currentUserId: string; isOwner: boolean };
}) {
  const balanceAfter = receipts ? balancesAfter(transactions, receipts.currentBalance) : new Map<string, number>();

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
      {transactions.map((tx) => {
        const { sign, tone } = display(tx);
        return (
          <li key={tx.id} className={`flex items-start gap-3 px-4 py-3 ${tx.isReversed ? "opacity-60" : ""}`}>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex flex-wrap items-center gap-2">
                <span className={`text-base font-semibold ${tx.isReversed ? "line-through" : ""}`}>
                  {tx.isCorrectionEntry ? t.ledger.correctionEntry : t.transactions.type[tx.type]}
                </span>
                {tx.isReversed && (
                  <span className="rounded-full bg-background px-2 py-0.5 text-xs font-semibold text-muted">
                    {tx.isCorrected ? t.ledger.correctedBadge : t.transactions.reversed}
                  </span>
                )}
                {tx.replaces_transaction_id && (
                  <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand-strong">
                    {t.ledger.replacementBadge}
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
              {receipts && tx.type === "REPAYMENT" && !tx.isReversed && (
                <div className="mt-1">
                  <ReceiptButtons
                    compact
                    phone={receipts.phone}
                    text={repaymentReceipt({
                      shopName: receipts.shopName,
                      amount: tx.amount,
                      paymentMethod: tx.payment_method,
                      occurredAt: tx.occurred_at,
                      remaining: balanceAfter.get(tx.id) ?? 0,
                    })}
                  />
                </div>
              )}
              {corrections && canCorrect(tx, corrections) && (
                <CorrectTransactionForm transactionId={tx.id} currentAmount={tx.amount} requestId={crypto.randomUUID()} />
              )}
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
