import type { SyncResult } from "./types";

/**
 * Erreurs PostgreSQL définitives pour une opération hors ligne : la renvoyer ne changera
 * rien, l'utilisateur doit la voir. Les autres erreurs sont considérées comme passagères.
 */
const PERMANENT = new Set([
  "amount_exceeds_balance",
  "negative_balance",
  "customer_archived",
  "customer_not_found",
  "invalid_amount",
  "invalid_date",
  "invalid_payment_method",
  "invalid_input",
  "idempotency_conflict",
  "forbidden",
]);

/**
 * Classe une erreur de la fonction PostgreSQL. Renvoie null si l'erreur est passagère
 * (l'appelant doit alors lever une exception pour réessayer plus tard).
 */
export function classifyLedgerError(
  error: { message?: string; code?: string },
  describe: (error: { message?: string; code?: string }) => string,
): SyncResult | null {
  if (error.message === "not_authenticated") return { status: "auth" };
  if (error.message && PERMANENT.has(error.message)) return { status: "rejected", message: describe(error) };
  if (error.code === "42501") return { status: "rejected", message: describe(error) };
  return null;
}
