import { describe, expect, it } from "vitest";
import { offlineOperationFromForm } from "@/lib/offline/form";

const customers = [{ id: "c1", name: "Awa", balance: 3000 }];
const requestId = "0b8e8f2e-3c4d-4e5f-9a0b-abcdef123456";
const now = new Date("2026-10-18T09:15:00.000Z");

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe("offlineOperationFromForm", () => {
  it("dette du jour : heure réelle, même requestId que le formulaire", () => {
    const result = offlineOperationFromForm(
      "DEBT",
      form({ customerId: "c1", amount: "1 500", description: " riz ", date: "2026-10-18", requestId }),
      { shopId: "s1", customers, now },
    );
    expect(result).toEqual({
      op: expect.objectContaining({
        requestId,
        kind: "DEBT",
        shopId: "s1",
        customerName: "Awa",
        amount: 1500,
        description: "riz",
        paymentMethod: null,
        occurredAt: "2026-10-18T09:15:00.000Z",
        status: "pending",
        attempts: 0,
      }),
    });
  });

  it("jour passé : midi ; remboursement avec mode et commentaire", () => {
    const result = offlineOperationFromForm(
      "REPAYMENT",
      form({ customerId: "c1", amount: "2000", paymentMethod: "WAVE", comment: "acompte", date: "2026-10-10", requestId }),
      { shopId: "s1", customers, now },
    );
    expect("op" in result && result.op).toMatchObject({
      occurredAt: "2026-10-10T12:00:00.000Z",
      paymentMethod: "WAVE",
      description: "acompte",
    });
  });

  it.each([
    ["client inconnu", "DEBT", { customerId: "x", amount: "100" }],
    ["montant invalide", "DEBT", { customerId: "c1", amount: "0" }],
    ["date future", "DEBT", { customerId: "c1", amount: "100", date: "2026-10-19" }],
    ["remboursement > solde connu", "REPAYMENT", { customerId: "c1", amount: "3001" }],
    ["clé d'idempotence absente", "DEBT", { customerId: "c1", amount: "100", requestId: "" }],
  ] as const)("refuse : %s", (_label, kind, fields) => {
    const result = offlineOperationFromForm(kind, form({ requestId, date: "2026-10-18", ...fields }), {
      shopId: "s1",
      customers,
      now,
    });
    expect(result).toHaveProperty("error");
  });
});
