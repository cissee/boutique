import { getMessages } from "@/i18n";

const t = getMessages();

/** Codes renvoyés par les fonctions PostgreSQL (champ `message`) -> texte affiché. */
const dbErrors: Record<string, string> = {
  not_authenticated: t.errors.sessionExpired,
  forbidden: t.errors.forbidden,
  customer_not_found: t.errors.customerNotFound,
  transaction_not_found: t.errors.transactionNotFound,
  customer_archived: t.errors.customerArchived,
  customer_has_balance: t.errors.customerHasBalance,
  invalid_amount: t.errors.invalidAmount,
  invalid_date: t.errors.invalidDate,
  invalid_payment_method: t.errors.invalidPaymentMethod,
  amount_exceeds_balance: t.errors.amountExceedsBalance,
  already_reversed: t.errors.alreadyReversed,
  cannot_reverse_reversal: t.errors.cannotReverseReversal,
  reversal_would_make_negative_balance: t.errors.reversalNegative,
  negative_balance: t.errors.amountExceedsBalance,
  idempotency_conflict: t.errors.duplicate,
};

/** Codes d'erreur Supabase Auth -> texte affiché. */
const authErrors: Record<string, string> = {
  invalid_credentials: t.errors.invalidCredentials,
  email_not_confirmed: t.errors.emailNotConfirmed,
  over_request_rate_limit: t.errors.rateLimited,
  over_email_send_rate_limit: t.errors.rateLimited,
  weak_password: t.errors.weakPassword,
  same_password: t.errors.samePassword,
  session_not_found: t.errors.sessionExpired,
  session_expired: t.errors.sessionExpired,
};

type ErrorLike = { message?: string; code?: string | number } | null | undefined;

/** Message utilisateur pour une erreur PostgREST / RPC. Les détails techniques restent dans les logs. */
export function dbErrorMessage(error: ErrorLike): string {
  if (!error) return t.errors.generic;
  if (error.message && dbErrors[error.message]) return dbErrors[error.message];
  if (error.code === "42501") return t.errors.forbidden;
  if (error.message?.toLowerCase().includes("fetch")) return t.errors.network;
  console.error("[db]", error);
  return t.errors.generic;
}

export function authErrorMessage(error: ErrorLike): string {
  if (!error) return t.errors.generic;
  if (typeof error.code === "string" && authErrors[error.code]) return authErrors[error.code];
  if (error.message?.toLowerCase().includes("fetch")) return t.errors.network;
  console.error("[auth]", error);
  return t.errors.generic;
}
