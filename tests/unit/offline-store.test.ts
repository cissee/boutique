import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import { createIndexedDbStore } from "@/lib/offline/store";
import type { PendingOperation } from "@/lib/offline/types";

function op(requestId: string, createdAt: string): PendingOperation {
  return {
    requestId,
    kind: "DEBT",
    shopId: "shop",
    customerId: "c1",
    customerName: "Awa",
    amount: 1000,
    description: "riz",
    paymentMethod: null,
    occurredAt: createdAt,
    createdAt,
    status: "pending",
    attempts: 0,
  };
}

describe("createIndexedDbStore", () => {
  it("conserve les opérations, triées par ordre de saisie, entre deux ouvertures", async () => {
    const factory = new IDBFactory();
    const first = createIndexedDbStore(factory);
    await first.putOperation(op("b", "2026-10-15T10:00:01.000Z"));
    await first.putOperation(op("a", "2026-10-15T10:00:00.000Z"));

    // Nouvelle instance sur la même base : simule la réouverture de l'application.
    const reopened = createIndexedDbStore(factory);
    expect((await reopened.listOperations()).map((o) => o.requestId)).toEqual(["a", "b"]);

    await reopened.putOperation({ ...op("a", "2026-10-15T10:00:00.000Z"), status: "rejected", error: "x" });
    await reopened.deleteOperation("b");
    expect(await reopened.listOperations()).toMatchObject([{ requestId: "a", status: "rejected" }]);
  });

  it("instantané des clients et effacement complet", async () => {
    const store = createIndexedDbStore(new IDBFactory());
    expect(await store.getSnapshot()).toBeNull();
    const snapshot = {
      userId: "u",
      shopId: "s",
      shopName: "Chez Modou",
      savedAt: "2026-10-15T10:00:00.000Z",
      customers: [{ id: "c1", name: "Awa", phone: null, balance: 1500 }],
    };
    await store.saveSnapshot(snapshot);
    await store.putOperation(op("a", "2026-10-15T10:00:00.000Z"));
    expect(await store.getSnapshot()).toEqual(snapshot);

    await store.clearAll();
    expect(await store.getSnapshot()).toBeNull();
    expect(await store.listOperations()).toEqual([]);
  });
});
