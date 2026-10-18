import { getMessages } from "@/i18n";
import { formatFCFA, parseAmount } from "@/lib/format/currency";
import { todayISODate } from "@/lib/format/date";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/ledger";
import type { PendingOperation } from "./types";

const t = getMessages();

type KnownCustomer = { id: string; name: string; balance: number };

/**
 * Transforme une saisie des formulaires « Ajouter une dette » / « Remboursement »
 * en opération pour la file hors ligne (même validation que côté serveur, en plus simple :
 * PostgreSQL revérifiera tout à l'envoi). Renvoie un message d'erreur si la saisie est invalide.
 */
export function offlineOperationFromForm(
  kind: PendingOperation["kind"],
  formData: FormData,
  ctx: { shopId: string; customers: KnownCustomer[]; now?: Date },
): { op: PendingOperation } | { error: string } {
  const field = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value.trim() : "";
  };
  const now = ctx.now ?? new Date();

  const customer = ctx.customers.find((c) => c.id === field("customerId"));
  if (!customer) return { error: t.ledger.chooseCustomer };

  const amount = parseAmount(field("amount"));
  if (amount === null) return { error: t.errors.invalidAmount };
  if (kind === "REPAYMENT" && amount > customer.balance) {
    return { error: t.ledger.exceedsBalance.replace("{balance}", formatFCFA(customer.balance)) };
  }

  const today = todayISODate(now);
  const date = field("date") || today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today) return { error: t.errors.invalidDate };
  // Même règle que le serveur : aujourd'hui = heure réelle ; jour passé = midi (Dakar = UTC).
  const occurredAt = date === today ? now.toISOString() : `${date}T12:00:00.000Z`;

  const method = field("paymentMethod");
  const paymentMethod =
    kind === "REPAYMENT" && (PAYMENT_METHODS as readonly string[]).includes(method) ? (method as PaymentMethod) : null;

  const requestId = field("requestId");
  if (!/^[0-9a-f-]{36}$/i.test(requestId)) return { error: t.errors.generic };

  return {
    op: {
      requestId,
      kind,
      shopId: ctx.shopId,
      customerId: customer.id,
      customerName: customer.name,
      amount,
      description: field(kind === "DEBT" ? "description" : "comment").slice(0, 500) || null,
      paymentMethod,
      occurredAt,
      createdAt: now.toISOString(),
      status: "pending",
      attempts: 0,
    },
  };
}

/** Vrai si le navigateur est hors ligne (complète useOffline, qui ne réagit qu'après un échec). */
export function browserOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}
