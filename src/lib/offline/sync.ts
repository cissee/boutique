import type { OfflineStore } from "./store";
import type { PendingOperation, SyncResult } from "./types";

/** Au-delà, une opération qui échoue sans réponse claire du serveur est mise de côté. */
export const MAX_ATTEMPTS = 20;

export type SyncReport = {
  synced: number;
  rejected: number;
  /** Raison de l'arrêt avant la fin de la file : réseau coupé ou session expirée. */
  stoppedBy?: "network" | "auth";
};

/**
 * Envoie les opérations en attente, une par une, dans l'ordre de saisie
 * (une dette passe avant le remboursement saisi juste après).
 *
 * - succès : l'opération est retirée de la file ;
 * - refus définitif (solde dépassé, client archivé…) : elle reste visible, marquée « refusée » ;
 * - coupure réseau / erreur inattendue : on s'arrête et on réessaiera plus tard ;
 * - session expirée : on s'arrête, l'utilisateur doit se reconnecter.
 *
 * Si l'application s'arrête entre l'envoi et la suppression locale, l'opération est
 * renvoyée au passage suivant avec le même requestId : PostgreSQL renvoie alors la
 * transaction déjà créée, sans doublon.
 */
export async function syncPending(
  store: OfflineStore,
  execute: (op: PendingOperation) => Promise<SyncResult>,
): Promise<SyncReport> {
  const report: SyncReport = { synced: 0, rejected: 0 };
  const queue = (await store.listOperations()).filter((op) => op.status === "pending");

  for (const op of queue) {
    let result: SyncResult;
    try {
      result = await execute(op);
    } catch {
      const attempts = op.attempts + 1;
      if (attempts >= MAX_ATTEMPTS) {
        await store.putOperation({ ...op, attempts, status: "rejected", error: "max_attempts" });
        report.rejected++;
        continue;
      }
      await store.putOperation({ ...op, attempts });
      report.stoppedBy = "network";
      return report;
    }

    if (result.status === "done") {
      await store.deleteOperation(op.requestId);
      report.synced++;
    } else if (result.status === "rejected") {
      await store.putOperation({ ...op, attempts: op.attempts + 1, status: "rejected", error: result.message });
      report.rejected++;
    } else {
      report.stoppedBy = "auth";
      return report;
    }
  }
  return report;
}

/** Effet des opérations en attente sur le solde affiché hors ligne (indication, non garanti). */
export function pendingEffect(ops: PendingOperation[], customerId: string): number {
  return ops
    .filter((op) => op.customerId === customerId && op.status === "pending")
    .reduce((sum, op) => sum + (op.kind === "DEBT" ? op.amount : -op.amount), 0);
}
