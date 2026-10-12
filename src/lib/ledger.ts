/** Modes de paiement acceptés (identiques à la contrainte CHECK de ledger_transactions). */
export const PAYMENT_METHODS = ["CASH", "WAVE", "ORANGE_MONEY", "OTHER_MOBILE_MONEY", "BANK", "OTHER"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
