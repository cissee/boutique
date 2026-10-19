/** Modes de paiement acceptés (identiques à la contrainte CHECK de ledger_transactions). */
export const PAYMENT_METHODS = ["CASH", "WAVE", "ORANGE_MONEY", "OTHER_MOBILE_MONEY", "BANK", "OTHER"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Délai pendant lequel l'auteur d'une saisie peut en corriger le montant (identique à PostgreSQL). */
export const SELF_CORRECTION_MINUTES = 30;

/** Le bouton « Modifier » est-il proposé ? (indication d'interface : la base revérifie.) */
export function canCorrect(
  tx: { type: string; created_by: string; created_at: string; isReversed: boolean },
  ctx: { currentUserId: string; isOwner: boolean },
  now: number = Date.now(),
): boolean {
  if (tx.type === "REVERSAL" || tx.isReversed) return false;
  if (ctx.isOwner) return true;
  return tx.created_by === ctx.currentUserId && now - new Date(tx.created_at).getTime() < SELF_CORRECTION_MINUTES * 60_000;
}
