/**
 * Synchronisation hors ligne de bout en bout : file d'attente locale -> fonctions
 * PostgreSQL réelles (record_debt / record_repayment) exécutées dans PGlite.
 */
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { classifyLedgerError } from "@/lib/offline/classify";
import { createMemoryStore } from "@/lib/offline/store";
import { syncPending } from "@/lib/offline/sync";
import type { PendingOperation, SyncResult } from "@/lib/offline/types";
import { createTestDb, type TestDb } from "./harness";

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
}, 60_000);

/** Même logique que la Server Action syncOfflineOperation, mais contre PGlite. */
function executorFor(userId: string) {
  return async (op: PendingOperation): Promise<SyncResult> => {
    try {
      if (op.kind === "DEBT") {
        await db.as(userId, "select public.record_debt($1, $2, $3, $4, $5)", [
          op.customerId,
          op.amount,
          op.requestId,
          op.description,
          op.occurredAt,
        ]);
      } else {
        await db.as(userId, "select public.record_repayment($1, $2, $3, $4, $5, $6)", [
          op.customerId,
          op.amount,
          op.requestId,
          op.paymentMethod,
          op.description,
          op.occurredAt,
        ]);
      }
      return { status: "done" };
    } catch (error) {
      const classified = classifyLedgerError(error as { message?: string; code?: string }, (e) => e.message ?? "");
      if (classified) return classified;
      throw error;
    }
  };
}

let minute = 0;
function offlineOp(customerId: string, kind: PendingOperation["kind"], amount: number): PendingOperation {
  const at = new Date(Date.now() - 60 * 60_000 + ++minute * 1000).toISOString();
  return {
    requestId: randomUUID(),
    kind,
    shopId: "",
    customerId,
    customerName: "Client",
    amount,
    description: kind === "DEBT" ? "saisi hors ligne" : null,
    paymentMethod: kind === "REPAYMENT" ? "CASH" : null,
    occurredAt: at,
    createdAt: at,
    status: "pending",
    attempts: 0,
  };
}

async function setup() {
  const owner = await db.createUser("Propriétaire");
  const seller = await db.createUser("Vendeur");
  const shopId = await db.createShop(owner);
  await db.addMember(shopId, seller, "seller");
  const customerId = await db.createCustomer(owner, shopId, "Awa");
  return { owner, seller, shopId, customerId };
}

describe("synchronisation hors ligne -> PostgreSQL", () => {
  it("dette puis remboursement saisis hors ligne : appliqués dans l'ordre, date de saisie conservée", async () => {
    const { seller, customerId } = await setup();
    const store = createMemoryStore();
    const debt = offlineOp(customerId, "DEBT", 5000);
    const repayment = offlineOp(customerId, "REPAYMENT", 2000);
    await store.putOperation(repayment);
    await store.putOperation(debt);

    const report = await syncPending(store, executorFor(seller));

    expect(report).toEqual({ synced: 2, rejected: 0 });
    expect(await db.balance(seller, customerId)).toBe(3000);
    const [row] = await db.admin<{ occurred_at: Date }>(
      "select occurred_at from public.ledger_transactions where client_request_id = $1",
      [debt.requestId],
    );
    expect(new Date(row.occurred_at).toISOString()).toBe(debt.occurredAt);
  });

  it("renvoi après plantage (même requestId) : aucune écriture en double", async () => {
    const { seller, customerId } = await setup();
    const store = createMemoryStore();
    const debt = offlineOp(customerId, "DEBT", 1500);
    await store.putOperation(debt);

    // 1er envoi réussi côté serveur, mais la suppression locale n'a pas eu lieu.
    await executorFor(seller)(debt);
    // Passage normal suivant : l'opération est renvoyée.
    const report = await syncPending(store, executorFor(seller));

    expect(report.synced).toBe(1);
    const rows = await db.admin("select id from public.ledger_transactions where client_request_id = $1", [debt.requestId]);
    expect(rows).toHaveLength(1);
    expect(await db.balance(seller, customerId)).toBe(1500);
  });

  it("conflit : un collègue a déjà encaissé, le remboursement hors ligne est refusé et reste visible", async () => {
    const { owner, seller, customerId } = await setup();
    await db.debt(owner, customerId, 3000);
    const store = createMemoryStore();
    // Hors ligne, le vendeur encaisse 3 000 ; pendant ce temps le propriétaire encaisse aussi 3 000.
    await store.putOperation(offlineOp(customerId, "REPAYMENT", 3000));
    await db.repay(owner, customerId, 3000);

    const report = await syncPending(store, executorFor(seller));

    expect(report).toEqual({ synced: 0, rejected: 1 });
    const [left] = await store.listOperations();
    expect(left).toMatchObject({ status: "rejected", error: "amount_exceeds_balance" });
    expect(await db.balance(owner, customerId)).toBe(0);
  });

  it("client archivé entre-temps : dette refusée", async () => {
    const { owner, seller, customerId } = await setup();
    const store = createMemoryStore();
    await store.putOperation(offlineOp(customerId, "DEBT", 800));
    await db.as(owner, "update public.customers set archived_at = now() where id = $1", [customerId]);

    const report = await syncPending(store, executorFor(seller));

    expect(report.rejected).toBe(1);
    expect((await store.listOperations())[0].error).toBe("customer_archived");
  });

  it("vendeur retiré de la boutique : l'opération est refusée, rien n'est écrit", async () => {
    const { owner, seller, shopId, customerId } = await setup();
    const store = createMemoryStore();
    await store.putOperation(offlineOp(customerId, "DEBT", 800));
    await db.as(owner, "delete from public.shop_members where shop_id = $1 and user_id = $2", [shopId, seller]);

    const report = await syncPending(store, executorFor(seller));

    expect(report.rejected).toBe(1);
    expect((await store.listOperations())[0].error).toBe("customer_not_found");
    expect(await db.ledgerSum(customerId)).toBe(0);
  });
});
