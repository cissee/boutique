import { describe, expect, it } from "vitest";
import { todayISODate } from "@/lib/format/date";
import { debtSchema, repaymentSchema, reversalSchema } from "@/lib/validation/schemas";

const customerId = "6f1c3c2a-1b2c-4d3e-8f90-123456789abc";
const requestId = "0b8e8f2e-3c4d-4e5f-9a0b-abcdef123456";

describe("debtSchema", () => {
  it("convertit la saisie en montant entier et date ISO", () => {
    const today = todayISODate();
    const debt = debtSchema.parse({ customerId, amount: "12 500", description: " riz ", date: today, requestId });
    expect(debt.amount).toBe(12500);
    expect(debt.description).toBe("riz");
    expect(debt.date.slice(0, 10)).toBe(today);
  });

  it("une date passée devient midi (heure de Dakar)", () => {
    const debt = debtSchema.parse({ customerId, amount: "1000", description: "", date: "2025-03-01", requestId });
    expect(debt.date).toBe("2025-03-01T12:00:00.000Z");
    expect(debt.description).toBeNull();
  });

  it.each([
    ["montant vide", { amount: "" }],
    ["montant nul", { amount: "0" }],
    ["montant décimal", { amount: "12,5" }],
    ["date future", { date: "2999-01-01" }],
    ["date invalide", { date: "12/03/2025" }],
    ["client absent", { customerId: "" }],
    ["clé d'idempotence absente", { requestId: "" }],
  ])("refuse : %s", (_label, override) => {
    const input = { customerId, amount: "1000", description: "", date: "2025-03-01", requestId, ...override };
    expect(debtSchema.safeParse(input).success).toBe(false);
  });
});

describe("repaymentSchema", () => {
  const base = { customerId, amount: "5000", paymentMethod: "WAVE", comment: "", date: "2025-03-01", requestId };

  it("accepte un mode de paiement connu, ou aucun", () => {
    expect(repaymentSchema.parse(base).paymentMethod).toBe("WAVE");
    expect(repaymentSchema.parse({ ...base, paymentMethod: "" }).paymentMethod).toBeNull();
  });

  it("refuse un mode de paiement inconnu", () => {
    expect(repaymentSchema.safeParse({ ...base, paymentMethod: "BITCOIN" }).success).toBe(false);
  });
});

describe("reversalSchema", () => {
  it("exige un motif", () => {
    expect(reversalSchema.safeParse({ transactionId: customerId, reason: "  ", requestId }).success).toBe(false);
    expect(reversalSchema.safeParse({ transactionId: customerId, reason: "Erreur", requestId }).success).toBe(true);
  });
});
