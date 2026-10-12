/**
 * Montants en franc CFA (XOF). Le franc CFA n'a pas de subdivision utilisée :
 * tous les montants sont des entiers, stockés en NUMERIC(14,0) côté PostgreSQL.
 */

/** Plafond applicatif d'une transaction (1 milliard FCFA). */
export const MAX_AMOUNT = 1_000_000_000;

const formatter = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 0,
});

/** 12500 -> "12 500 FCFA" (espaces insécables). */
export function formatFCFA(amount: number | string): string {
  const value = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(value)) return "— FCFA";
  return `${formatter.format(value)} FCFA`;
}

/** Formatage de saisie, sans la devise : "12500" -> "12 500". */
export function formatAmountInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  if (!digits) return "";
  return formatter.format(Number(digits));
}

/**
 * Convertit une saisie utilisateur ("12 500", "12.500", "12500 FCFA") en entier.
 * Retourne null si la saisie n'est pas un montant entier positif valide.
 */
export function parseAmount(raw: string): number | null {
  let cleaned = raw.trim().replace(/f?cfa$|f$/i, "").replace(/[\s  ]/g, "");
  // Le point n'est accepté que comme séparateur de milliers ("12.500"), jamais comme décimale.
  if (cleaned.includes(".")) {
    if (!/^\d{1,3}(\.\d{3})+$/.test(cleaned)) return null;
    cleaned = cleaned.replace(/\./g, "");
  }
  if (!/^\d+$/.test(cleaned)) return null;
  const value = Number(cleaned);
  if (!Number.isSafeInteger(value) || value <= 0 || value > MAX_AMOUNT) return null;
  return value;
}
