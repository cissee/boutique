import type { PaymentMethod } from "@/lib/ledger";

/**
 * Opération saisie hors ligne, en attente d'envoi.
 * `requestId` est la clé d'idempotence transmise à PostgreSQL : renvoyer la même
 * opération (après une coupure ou un plantage) ne peut jamais créer de doublon.
 */
export type PendingOperation = {
  requestId: string;
  kind: "DEBT" | "REPAYMENT";
  shopId: string;
  customerId: string;
  customerName: string;
  amount: number;
  /** Description (dette) ou commentaire (remboursement). */
  description: string | null;
  paymentMethod: PaymentMethod | null;
  /** Moment réel de l'opération (saisie hors ligne), ISO. */
  occurredAt: string;
  createdAt: string;
  /** pending : à envoyer ; rejected : refusée par le serveur, à examiner par l'utilisateur. */
  status: "pending" | "rejected";
  error?: string;
  attempts: number;
};

export type SnapshotCustomer = { id: string; name: string; phone: string | null; balance: number };

/** Dernière liste de clients chargée en ligne, consultable hors ligne. */
export type CustomerSnapshot = {
  userId: string;
  shopId: string;
  shopName: string;
  savedAt: string;
  customers: SnapshotCustomer[];
};

/** Résultat de l'envoi d'une opération au serveur. Une coupure réseau se traduit par une exception. */
export type SyncResult =
  | { status: "done" }
  | { status: "rejected"; message: string }
  | { status: "auth" };
