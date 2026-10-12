/**
 * Tests de concurrence contre un VRAI projet Supabase (plusieurs connexions simultanées,
 * ce que PGlite ne peut pas simuler). Lancement : `npm run test:integration`.
 *
 * Nécessite dans .env.test.local un compte confirmé :
 *   TEST_USER_EMAIL=...
 *   TEST_USER_PASSWORD=...
 *
 * Les opérations sont faites dans une boutique dédiée « Boutique de test automatique »
 * (créée au premier lancement). Le registre étant en ajout seul, les clients de test
 * sont soldés puis archivés à la fin.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SupabaseApi } from "./supabase-api";

const TEST_SHOP_NAME = "Boutique de test automatique";
const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, TEST_USER_EMAIL, TEST_USER_PASSWORD } =
  process.env;
const configured = Boolean(
  NEXT_PUBLIC_SUPABASE_URL && NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY && TEST_USER_EMAIL && TEST_USER_PASSWORD,
);

type Tx = { id: string; type: string; amount: number };

describe.skipIf(!configured)("concurrence sur Supabase", () => {
  const api = new SupabaseApi(NEXT_PUBLIC_SUPABASE_URL!, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
  let shopId = "";
  const createdCustomers: string[] = [];

  beforeAll(async () => {
    await api.signIn(TEST_USER_EMAIL!, TEST_USER_PASSWORD!);
    const shops = await api.select<{ id: string }>(
      "shops",
      `select=id&name=eq.${encodeURIComponent(TEST_SHOP_NAME)}&limit=1`,
    );
    if (shops.length) {
      shopId = shops[0].id;
    } else {
      const created = await api.rpc<{ id: string }>("create_shop", { p_name: TEST_SHOP_NAME });
      if (!created.ok) throw new Error(`create_shop : ${JSON.stringify(created.error)}`);
      shopId = created.data.id;
    }
  }, 30_000);

  afterAll(async () => {
    // Solder puis archiver les clients de test.
    for (const id of createdCustomers) {
      const remaining = await balance(id);
      if (remaining > 0) await repay(id, remaining);
      await api.update("customers", `id=eq.${id}`, { archived_at: new Date().toISOString() });
    }
  }, 60_000);

  async function newCustomer(label: string): Promise<string> {
    const c = await api.insert<{ id: string }>("customers", {
      shop_id: shopId,
      name: `TEST ${label} ${new Date().toISOString()}`,
    });
    createdCustomers.push(c.id);
    return c.id;
  }

  const debt = (customerId: string, amount: number, requestId = randomUUID()) =>
    api.rpc<Tx>("record_debt", { p_customer_id: customerId, p_amount: amount, p_client_request_id: requestId });

  const repay = (customerId: string, amount: number, requestId = randomUUID()) =>
    api.rpc<Tx>("record_repayment", {
      p_customer_id: customerId,
      p_amount: amount,
      p_client_request_id: requestId,
      p_payment_method: "CASH",
    });

  async function balance(customerId: string): Promise<number> {
    const [row] = await api.select<{ balance: number }>("customer_balances", `select=balance&customer_id=eq.${customerId}`);
    return Number(row.balance);
  }

  async function ledgerSum(customerId: string): Promise<number> {
    const rows = await api.select<{ balance_effect: number }>(
      "ledger_transactions",
      `select=balance_effect&customer_id=eq.${customerId}`,
    );
    return rows.reduce((sum, r) => sum + Number(r.balance_effect), 0);
  }

  it("10 remboursements totaux simultanés : un seul passe", async () => {
    const customerId = await newCustomer("double paiement");
    expect((await debt(customerId, 1000)).ok).toBe(true);

    const results = await Promise.all(Array.from({ length: 10 }, () => repay(customerId, 1000)));

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    for (const r of results.filter((r) => !r.ok)) expect(r.error?.message).toBe("amount_exceeds_balance");
    expect(await balance(customerId)).toBe(0);
    expect(await ledgerSum(customerId)).toBe(0);
  }, 30_000);

  it("6 remboursements partiels simultanés de 300 sur 1 000 : exactement 3 passent", async () => {
    const customerId = await newCustomer("partiels");
    await debt(customerId, 1000);

    const results = await Promise.all(Array.from({ length: 6 }, () => repay(customerId, 300)));

    expect(results.filter((r) => r.ok)).toHaveLength(3);
    expect(await balance(customerId)).toBe(100);
  }, 30_000);

  it("la même dette envoyée 10 fois en parallèle n'est enregistrée qu'une fois", async () => {
    const customerId = await newCustomer("idempotence");
    const requestId = randomUUID();

    const results = await Promise.all(Array.from({ length: 10 }, () => debt(customerId, 500, requestId)));

    // Toutes les réponses renvoient la même transaction (ou, au pire, un conflit d'unicité refusé).
    const ids = new Set(results.filter((r) => r.ok).map((r) => r.data.id));
    expect(ids.size).toBe(1);
    const rows = await api.select("ledger_transactions", `select=id&client_request_id=eq.${requestId}`);
    expect(rows).toHaveLength(1);
    expect(await balance(customerId)).toBe(500);
  }, 30_000);

  it("rafale mixte dettes/remboursements : le solde reste cohérent et jamais négatif", async () => {
    const customerId = await newCustomer("rafale");
    await debt(customerId, 2000);

    const ops = Array.from({ length: 20 }, (_, i) =>
      i % 2 === 0 ? { kind: "debt" as const, amount: 100 + i * 10 } : { kind: "repay" as const, amount: 400 },
    );
    const results = await Promise.all(
      ops.map((op) => (op.kind === "debt" ? debt(customerId, op.amount) : repay(customerId, op.amount))),
    );

    const expected =
      2000 +
      results.reduce((sum, r, i) => {
        if (!r.ok) return sum;
        return sum + (ops[i].kind === "debt" ? ops[i].amount : -ops[i].amount);
      }, 0);
    const actual = await balance(customerId);
    expect(actual).toBe(expected);
    expect(await ledgerSum(customerId)).toBe(expected);
    expect(actual).toBeGreaterThanOrEqual(0);
  }, 30_000);
});

describe.runIf(!configured)("concurrence sur Supabase (non configuré)", () => {
  it.skip("renseignez TEST_USER_EMAIL et TEST_USER_PASSWORD dans .env.test.local", () => {});
});
