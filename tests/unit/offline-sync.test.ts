import { describe, expect, it, vi } from "vitest";
import { createMemoryStore } from "@/lib/offline/store";
import { MAX_ATTEMPTS, pendingEffect, syncPending } from "@/lib/offline/sync";
import type { PendingOperation, SyncResult } from "@/lib/offline/types";

let seq = 0;
function op(overrides: Partial<PendingOperation> = {}): PendingOperation {
  seq++;
  return {
    requestId: `req-${seq}`,
    kind: "DEBT",
    shopId: "shop",
    customerId: "c1",
    customerName: "Awa",
    amount: 1000,
    description: null,
    paymentMethod: null,
    occurredAt: new Date(2026, 9, 1, 0, seq).toISOString(),
    createdAt: new Date(2026, 9, 1, 0, seq).toISOString(),
    status: "pending",
    attempts: 0,
    ...overrides,
  };
}

const ok = async (): Promise<SyncResult> => ({ status: "done" });

describe("syncPending", () => {
  it("envoie dans l'ordre de saisie et vide la file", async () => {
    const store = createMemoryStore();
    const a = op();
    const b = op({ kind: "REPAYMENT" });
    // Insérées dans le désordre : l'ordre de saisie (createdAt) doit primer.
    await store.putOperation(b);
    await store.putOperation(a);
    const sent: string[] = [];

    const report = await syncPending(store, async (o) => {
      sent.push(o.requestId);
      return { status: "done" };
    });

    expect(sent).toEqual([a.requestId, b.requestId]);
    expect(report).toEqual({ synced: 2, rejected: 0 });
    expect(await store.listOperations()).toEqual([]);
  });

  it("coupure réseau : s'arrête, garde l'opération et la suivante, compte la tentative", async () => {
    const store = createMemoryStore();
    const a = op();
    const b = op();
    await store.putOperation(a);
    await store.putOperation(b);
    const execute = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));

    const report = await syncPending(store, execute);

    expect(report.stoppedBy).toBe("network");
    expect(execute).toHaveBeenCalledTimes(1);
    const left = await store.listOperations();
    expect(left.map((o) => [o.requestId, o.status, o.attempts])).toEqual([
      [a.requestId, "pending", 1],
      [b.requestId, "pending", 0],
    ]);
  });

  it("refus définitif : l'opération reste visible avec le motif, la file continue", async () => {
    const store = createMemoryStore();
    const refused = op({ kind: "REPAYMENT" });
    const next = op();
    await store.putOperation(refused);
    await store.putOperation(next);

    const report = await syncPending(store, async (o) =>
      o.requestId === refused.requestId ? { status: "rejected", message: "Solde dépassé" } : { status: "done" },
    );

    expect(report).toEqual({ synced: 1, rejected: 1 });
    const left = await store.listOperations();
    expect(left).toHaveLength(1);
    expect(left[0]).toMatchObject({ requestId: refused.requestId, status: "rejected", error: "Solde dépassé" });
  });

  it("les opérations refusées ne sont pas renvoyées", async () => {
    const store = createMemoryStore();
    await store.putOperation(op({ status: "rejected", error: "x" }));
    const execute = vi.fn(ok);
    await syncPending(store, execute);
    expect(execute).not.toHaveBeenCalled();
  });

  it("session expirée : arrêt sans rien perdre", async () => {
    const store = createMemoryStore();
    await store.putOperation(op());
    const report = await syncPending(store, async () => ({ status: "auth" }));
    expect(report.stoppedBy).toBe("auth");
    expect((await store.listOperations())[0].status).toBe("pending");
  });

  it(`après ${MAX_ATTEMPTS} échecs inexpliqués, l'opération est mise de côté`, async () => {
    const store = createMemoryStore();
    await store.putOperation(op({ attempts: MAX_ATTEMPTS - 1 }));
    await syncPending(store, async () => {
      throw new Error("500");
    });
    expect((await store.listOperations())[0]).toMatchObject({ status: "rejected", error: "max_attempts" });
  });

  it("plantage entre l'envoi et la suppression locale : renvoi avec le même requestId", async () => {
    const store = createMemoryStore();
    const a = op();
    await store.putOperation(a);
    const sentIds: string[] = [];
    // Premier passage : le serveur enregistre, puis la suppression locale échoue (onglet fermé…).
    const failingStore = { ...store, deleteOperation: vi.fn().mockRejectedValue(new Error("fermé")) };
    await expect(
      syncPending(failingStore, async (o) => {
        sentIds.push(o.requestId);
        return { status: "done" };
      }),
    ).rejects.toThrow();
    // Passage suivant : même requestId renvoyé (le serveur le reconnaît, cf. tests/db).
    await syncPending(store, async (o) => {
      sentIds.push(o.requestId);
      return { status: "done" };
    });
    expect(sentIds).toEqual([a.requestId, a.requestId]);
    expect(await store.listOperations()).toEqual([]);
  });
});

describe("pendingEffect", () => {
  it("additionne dettes et remboursements en attente du client", () => {
    const ops = [
      op({ amount: 1000 }),
      op({ kind: "REPAYMENT", amount: 300 }),
      op({ customerId: "autre", amount: 5000 }),
      op({ amount: 700, status: "rejected" }),
    ];
    expect(pendingEffect(ops, "c1")).toBe(700);
  });
});
