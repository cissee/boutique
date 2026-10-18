import { getMessages } from "@/i18n";
import { APP_TIME_ZONE } from "@/lib/format/date";
import type { PaymentMethod } from "@/lib/ledger";

/**
 * Reçu de remboursement envoyé par le boutiquier depuis son téléphone (WhatsApp ou SMS).
 * Le texte évite les espaces insécables : un SMS reste ainsi en un seul message (GSM 7 bits).
 */

const t = getMessages();

export type ReceiptInput = {
  shopName: string;
  amount: number;
  paymentMethod: string | null;
  occurredAt: string | Date;
  /** Solde restant après ce remboursement. */
  remaining: number;
};

const shortDate = new Intl.DateTimeFormat("fr-FR", {
  timeZone: APP_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/** 12500 -> "12 500" (espace simple). */
export function plainAmount(value: number): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function repaymentReceipt(input: ReceiptInput): string {
  const method = input.paymentMethod
    ? ` (${t.transactions.paymentMethod[input.paymentMethod as PaymentMethod] ?? input.paymentMethod})`
    : "";
  const first = t.receipt.received
    .replace("{shop}", input.shopName.trim())
    .replace("{amount}", plainAmount(input.amount))
    .replace("{date}", shortDate.format(new Date(input.occurredAt)))
    .replace("{method}", method);
  const second =
    input.remaining > 0 ? t.receipt.remaining.replace("{amount}", plainAmount(input.remaining)) : t.receipt.settled;
  return `${first} ${second}`;
}

/** Lien WhatsApp pré-rempli ; sans numéro, WhatsApp demande de choisir le contact. */
export function whatsappLink(phone: string | null, text: string): string {
  const digits = phone?.replace(/\D/g, "") ?? "";
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

/** Lien SMS pré-rempli (application SMS du téléphone). */
export function smsLink(phone: string | null, text: string): string {
  return `sms:${phone ?? ""}?body=${encodeURIComponent(text)}`;
}

/**
 * Solde juste après chaque opération d'un client, à partir de son solde actuel.
 * `transactions` : du plus récent au plus ancien, sans trou depuis le plus ancien fourni.
 */
export function balancesAfter(
  transactions: { id: string; balance_effect: number }[],
  currentBalance: number,
): Map<string, number> {
  const result = new Map<string, number>();
  let running = currentBalance;
  for (const tx of transactions) {
    result.set(tx.id, running);
    running -= tx.balance_effect;
  }
  return result;
}
