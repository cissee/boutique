import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./harness";

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
}, 60_000);

/** Boutique avec un propriétaire, un vendeur et un client. */
async function setupShop() {
  const owner = await db.createUser("Propriétaire");
  const seller = await db.createUser("Vendeur");
  const shopId = await db.createShop(owner);
  await db.addMember(shopId, seller, "seller");
  const customerId = await db.createCustomer(owner, shopId, "Awa Diop");
  return { owner, seller, shopId, customerId };
}

describe("boutique et clients", () => {
  it("create_shop crée la boutique et rend l'utilisateur propriétaire", async () => {
    const user = await db.createUser();
    const shopId = await db.createShop(user, "Boutique Keur Massar");
    const members = await db.as(user, "select user_id, role from public.shop_members where shop_id = $1", [shopId]);
    expect(members).toEqual([{ user_id: user, role: "owner" }]);
  });

  it("un membre crée un client ; created_by est forcé à l'utilisateur", async () => {
    const { seller, shopId } = await setupShop();
    const [c] = await db.as<{ name: string; created_by: string }>(
      seller,
      "insert into public.customers (shop_id, name, phone) values ($1, 'Moussa Fall', '+221771234567') returning name, created_by",
      [shopId],
    );
    expect(c).toEqual({ name: "Moussa Fall", created_by: seller });
  });

  it("refuse un nom vide ou un téléphone mal formé", async () => {
    const { owner, shopId } = await setupShop();
    await expect(
      db.as(owner, "insert into public.customers (shop_id, name) values ($1, '   ')", [shopId]),
    ).rejects.toThrow(/check constraint/);
    await expect(
      db.as(owner, "insert into public.customers (shop_id, name, phone) values ($1, 'X', '77123')", [shopId]),
    ).rejects.toThrow(/check constraint/);
  });

  it("un vendeur modifie un client ; la modification est journalisée", async () => {
    const { owner, seller, customerId } = await setupShop();
    const [c] = await db.as<{ name: string }>(
      seller,
      "update public.customers set name = 'Awa Diop Ndiaye', notes = 'Quartier Médina' where id = $1 returning name",
      [customerId],
    );
    expect(c.name).toBe("Awa Diop Ndiaye");
    const logs = await db.as(owner, "select action from public.audit_log where record_id = $1 and action = 'customers.update'", [
      customerId,
    ]);
    expect(logs).toHaveLength(1);
  });

  it("un client ne peut pas être déplacé vers une autre boutique", async () => {
    const { owner, customerId } = await setupShop();
    const otherShop = await db.createShop(owner, "Deuxième boutique");
    await expect(
      db.as(owner, "update public.customers set shop_id = $1 where id = $2", [otherShop, customerId]),
    ).rejects.toThrow(/permission denied/);
  });

  it("un client n'est jamais supprimé (pas de privilège DELETE)", async () => {
    const { owner, customerId } = await setupShop();
    await expect(db.as(owner, "delete from public.customers where id = $1", [customerId])).rejects.toThrow(
      /permission denied/,
    );
  });
});

describe("dettes et remboursements", () => {
  it("une dette augmente le solde", async () => {
    const { seller, customerId } = await setupShop();
    const tx = await db.debt(seller, customerId, 5000);
    expect(tx.type).toBe("DEBT");
    expect(await db.balance(seller, customerId)).toBe(5000);
  });

  it("remboursement partiel puis total", async () => {
    const { owner, seller, customerId } = await setupShop();
    await db.debt(seller, customerId, 10000);
    await db.debt(seller, customerId, 2500);

    await db.repay(seller, customerId, 4000);
    expect(await db.balance(owner, customerId)).toBe(8500);

    await db.repay(owner, customerId, 8500);
    expect(await db.balance(owner, customerId)).toBe(0);
  });

  it("refuse un remboursement supérieur au solde", async () => {
    const { seller, customerId } = await setupShop();
    await db.debt(seller, customerId, 3000);
    await expect(db.repay(seller, customerId, 3001)).rejects.toThrow("amount_exceeds_balance");
    expect(await db.balance(seller, customerId)).toBe(3000);
  });

  it("refuse un remboursement sur un solde nul", async () => {
    const { seller, customerId } = await setupShop();
    await expect(db.repay(seller, customerId, 100)).rejects.toThrow("amount_exceeds_balance");
  });

  it.each([0, -500, 12.5, 1_000_000_001])("refuse le montant invalide %s", async (amount) => {
    const { seller, customerId } = await setupShop();
    await expect(db.debt(seller, customerId, amount)).rejects.toThrow("invalid_amount");
  });

  it("refuse une date d'opération dans le futur", async () => {
    const { seller, customerId } = await setupShop();
    await expect(
      db.as(seller, "select public.record_debt($1, 1000, $2, null, now() + interval '3 days')", [
        customerId,
        randomUUID(),
      ]),
    ).rejects.toThrow("invalid_date");
  });

  it("le solde affiché égale la somme recalculée depuis le registre", async () => {
    const { owner, seller, customerId } = await setupShop();
    await db.debt(seller, customerId, 7000);
    await db.debt(seller, customerId, 1500);
    await db.repay(seller, customerId, 2000);
    const mistaken = await db.repay(seller, customerId, 500);
    await db.reverse(owner, mistaken.id);
    const expected = 7000 + 1500 - 2000;
    expect(await db.balance(owner, customerId)).toBe(expected);
    expect(await db.ledgerSum(customerId)).toBe(expected);
  });
});

describe("prévention des doublons (idempotence)", () => {
  it("rejouer la même requête ne crée qu'une seule dette", async () => {
    const { seller, customerId } = await setupShop();
    const requestId = randomUUID();
    const first = await db.debt(seller, customerId, 2000, requestId);
    const second = await db.debt(seller, customerId, 2000, requestId);
    expect(second.id).toBe(first.id);
    expect(await db.balance(seller, customerId)).toBe(2000);
  });

  it("rejouer un remboursement ne débite qu'une fois", async () => {
    const { seller, customerId } = await setupShop();
    await db.debt(seller, customerId, 5000);
    const requestId = randomUUID();
    await db.repay(seller, customerId, 5000, requestId);
    await db.repay(seller, customerId, 5000, requestId);
    expect(await db.balance(seller, customerId)).toBe(0);
  });

  it("réutiliser une clé pour une autre opération est refusé", async () => {
    const { seller, customerId } = await setupShop();
    const requestId = randomUUID();
    await db.debt(seller, customerId, 2000, requestId);
    await expect(db.debt(seller, customerId, 3000, requestId)).rejects.toThrow("idempotency_conflict");
  });
});

describe("annulations et intégrité du registre", () => {
  it("le propriétaire annule une dette : trace conservée, solde corrigé", async () => {
    const { owner, seller, customerId } = await setupShop();
    const debt = await db.debt(seller, customerId, 4000);
    const reversal = await db.reverse(owner, debt.id);
    expect(reversal.type).toBe("REVERSAL");
    expect(reversal.reversed_transaction_id).toBe(debt.id);
    expect(Number(reversal.balance_effect)).toBe(-4000);
    expect(await db.balance(owner, customerId)).toBe(0);

    const rows = await db.as(owner, "select type from public.ledger_transactions where customer_id = $1 order by created_at", [
      customerId,
    ]);
    expect(rows).toHaveLength(2);
  });

  it("annuler un remboursement fait remonter le solde", async () => {
    const { owner, seller, customerId } = await setupShop();
    await db.debt(seller, customerId, 4000);
    const repayment = await db.repay(seller, customerId, 1000);
    await db.reverse(owner, repayment.id);
    expect(await db.balance(owner, customerId)).toBe(4000);
  });

  it("une transaction ne peut être annulée qu'une fois", async () => {
    const { owner, seller, customerId } = await setupShop();
    const debt = await db.debt(seller, customerId, 4000);
    await db.reverse(owner, debt.id);
    await expect(db.reverse(owner, debt.id)).rejects.toThrow("already_reversed");
  });

  it("on ne peut pas annuler une annulation", async () => {
    const { owner, seller, customerId } = await setupShop();
    const debt = await db.debt(seller, customerId, 4000);
    const reversal = await db.reverse(owner, debt.id);
    await expect(db.reverse(owner, reversal.id)).rejects.toThrow("cannot_reverse_reversal");
  });

  it("refuse d'annuler une dette déjà remboursée (solde négatif)", async () => {
    const { owner, seller, customerId } = await setupShop();
    const debt = await db.debt(seller, customerId, 4000);
    await db.repay(seller, customerId, 4000);
    await expect(db.reverse(owner, debt.id)).rejects.toThrow("reversal_would_make_negative_balance");
  });

  it("une annulation exige un motif", async () => {
    const { owner, seller, customerId } = await setupShop();
    const debt = await db.debt(seller, customerId, 4000);
    await expect(db.reverse(owner, debt.id, "  ")).rejects.toThrow("invalid_input");
  });

  it("le registre est en ajout seul, même pour le superutilisateur", async () => {
    const { seller, customerId } = await setupShop();
    const debt = await db.debt(seller, customerId, 4000);
    await expect(db.admin("update public.ledger_transactions set amount = 1 where id = $1", [debt.id])).rejects.toThrow(
      "ledger_transactions_is_append_only",
    );
    await expect(db.admin("delete from public.ledger_transactions where id = $1", [debt.id])).rejects.toThrow(
      "ledger_transactions_is_append_only",
    );
  });

  it("chaque écriture est journalisée dans audit_log", async () => {
    const { owner, seller, customerId } = await setupShop();
    const debt = await db.debt(seller, customerId, 4000);
    const logs = await db.as<{ action: string; actor_id: string }>(
      owner,
      "select action, actor_id from public.audit_log where record_id = $1",
      [debt.id],
    );
    expect(logs).toEqual([{ action: "ledger_transactions.insert", actor_id: seller }]);
  });
});

describe("permissions propriétaire / vendeur", () => {
  it("un vendeur ne peut pas annuler une transaction", async () => {
    const { seller, customerId } = await setupShop();
    const debt = await db.debt(seller, customerId, 4000);
    await expect(db.reverse(seller, debt.id)).rejects.toThrow("forbidden");
  });

  it("un vendeur ne peut pas archiver un client", async () => {
    const { seller, customerId } = await setupShop();
    await expect(
      db.as(seller, "update public.customers set archived_at = now() where id = $1", [customerId]),
    ).rejects.toThrow("forbidden");
  });

  it("le propriétaire archive un client soldé, pas un client débiteur", async () => {
    const { owner, seller, customerId } = await setupShop();
    await db.debt(seller, customerId, 1000);
    await expect(
      db.as(owner, "update public.customers set archived_at = now() where id = $1", [customerId]),
    ).rejects.toThrow("customer_has_balance");

    await db.repay(seller, customerId, 1000);
    await db.as(owner, "update public.customers set archived_at = now() where id = $1", [customerId]);
    await expect(db.debt(seller, customerId, 500)).rejects.toThrow("customer_archived");
  });

  it("un vendeur ne peut pas modifier la boutique ni le journal d'audit", async () => {
    const { seller, shopId } = await setupShop();
    const updated = await db.as(seller, "update public.shops set name = 'Piratée' where id = $1 returning id", [shopId]);
    expect(updated).toHaveLength(0);
    expect(await db.as(seller, "select * from public.audit_log where shop_id = $1", [shopId])).toHaveLength(0);
  });

  it("le dernier propriétaire ne peut pas être retiré", async () => {
    const { owner, shopId } = await setupShop();
    await expect(
      db.admin("delete from public.shop_members where shop_id = $1 and user_id = $2", [shopId, owner]),
    ).rejects.toThrow("last_owner");
  });

  it("personne n'écrit directement dans le registre", async () => {
    const { owner, shopId, customerId } = await setupShop();
    await expect(
      db.as(
        owner,
        `insert into public.ledger_transactions
           (shop_id, customer_id, type, amount, balance_effect, created_by, client_request_id)
         values ($1, $2, 'REPAYMENT', 1000, -1000, $3, gen_random_uuid())`,
        [shopId, customerId, owner],
      ),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("tableau de bord (shop_dashboard)", () => {
  type Stats = {
    total_outstanding: string;
    debtor_count: string;
    customer_count: string;
    repayments_today: string;
    repayments_today_count: string;
    debts_today: string;
    debts_today_count: string;
  };
  const stats = async (userId: string, shopId: string) => {
    const [row] = await db.as<Stats>(userId, "select * from public.shop_dashboard($1)", [shopId]);
    return Object.fromEntries(Object.entries(row).map(([k, v]) => [k, Number(v)]));
  };

  it("calcule les totaux depuis le registre, sans les opérations annulées", async () => {
    const { owner, seller, shopId, customerId } = await setupShop();
    const other = await db.createCustomer(owner, shopId, "Moussa");
    await db.createCustomer(owner, shopId, "Client soldé");

    await db.debt(seller, customerId, 10000);
    await db.debt(seller, other, 3000);
    await db.repay(seller, customerId, 4000);
    const mistaken = await db.repay(seller, other, 1000);
    await db.reverse(owner, mistaken.id);
    // Dette d'hier : comptée dans le total, pas dans « aujourd'hui ».
    await db.as(seller, "select public.record_debt($1, 500, gen_random_uuid(), null, now() - interval '1 day')", [other]);

    expect(await stats(seller, shopId)).toEqual({
      total_outstanding: 10000 + 3000 + 500 - 4000,
      debtor_count: 2,
      customer_count: 3,
      repayments_today: 4000,
      repayments_today_count: 1,
      debts_today: 13000,
      debts_today_count: 2,
    });
  });

  it("une autre boutique n'obtient que des zéros", async () => {
    const a = await setupShop();
    await db.debt(a.owner, a.customerId, 7000);
    const intruder = await db.createUser();
    await db.createShop(intruder);
    const s = await stats(intruder, a.shopId);
    expect(s.total_outstanding).toBe(0);
    expect(s.customer_count).toBe(0);
  });
});

describe("rapport de période (shop_report)", () => {
  const report = async (userId: string, shopId: string, from: string, to: string) => {
    const [row] = await db.as<Record<string, unknown>>(userId, "select * from public.shop_report($1, $2, $3)", [
      shopId,
      from,
      to,
    ]);
    return row;
  };
  const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

  it("totaux de la période, remboursements par mode, annulations exclues", async () => {
    const { owner, seller, shopId, customerId } = await setupShop();
    // Avant la période : dette de 1 000 il y a 10 jours.
    await db.as(seller, "select public.record_debt($1, 1000, gen_random_uuid(), null, now() - interval '10 days')", [
      customerId,
    ]);
    await db.debt(seller, customerId, 5000);
    await db.repay(seller, customerId, 2000); // CASH
    await db.as(seller, "select public.record_repayment($1, 500, gen_random_uuid(), 'WAVE')", [customerId]);
    const mistaken = await db.debt(seller, customerId, 700);
    await db.reverse(owner, mistaken.id);

    const r = await report(owner, shopId, day(-2), day(0));
    expect(Number(r.debts_total)).toBe(5000);
    expect(Number(r.debts_count)).toBe(1);
    expect(Number(r.repayments_total)).toBe(2500);
    expect(Number(r.repayments_count)).toBe(2);
    expect(r.repayments_by_method).toEqual({ CASH: 2000, WAVE: 500 });
    expect(Number(r.reversals_count)).toBe(1);
    expect(Number(r.new_customers)).toBe(1);
    expect(Number(r.outstanding_end)).toBe(1000 + 5000 - 2500);
  });

  it("le solde de fin de période ignore les opérations postérieures", async () => {
    const { owner, seller, shopId, customerId } = await setupShop();
    await db.as(seller, "select public.record_debt($1, 1000, gen_random_uuid(), null, now() - interval '10 days')", [
      customerId,
    ]);
    await db.debt(seller, customerId, 5000);
    const r = await report(owner, shopId, day(-20), day(-5));
    expect(Number(r.outstanding_end)).toBe(1000);
    expect(Number(r.debts_total)).toBe(1000);
  });

  it("refuse une période inversée", async () => {
    const { owner, shopId } = await setupShop();
    await expect(report(owner, shopId, day(0), day(-1))).rejects.toThrow("invalid_date");
  });
});

describe("isolation entre boutiques", () => {
  it("un utilisateur ne voit ni les clients, ni les transactions, ni les soldes d'une autre boutique", async () => {
    const a = await setupShop();
    await db.debt(a.owner, a.customerId, 9000);
    const intruder = await db.createUser("Autre boutiquier");
    await db.createShop(intruder);

    expect(await db.as(intruder, "select * from public.customers where shop_id = $1", [a.shopId])).toHaveLength(0);
    expect(await db.as(intruder, "select * from public.ledger_transactions where shop_id = $1", [a.shopId])).toHaveLength(0);
    expect(await db.as(intruder, "select * from public.customer_balances where shop_id = $1", [a.shopId])).toHaveLength(0);
    expect(await db.as(intruder, "select * from public.shops where id = $1", [a.shopId])).toHaveLength(0);
    expect(await db.as(intruder, "select * from public.shop_members where shop_id = $1", [a.shopId])).toHaveLength(0);
    expect(await db.as(intruder, "select * from public.profiles where id = $1", [a.owner])).toHaveLength(0);
  });

  it("un utilisateur ne peut pas écrire dans une autre boutique en fournissant son shop_id", async () => {
    const a = await setupShop();
    const intruder = await db.createUser();
    await db.createShop(intruder);

    await expect(db.createCustomer(intruder, a.shopId)).rejects.toThrow(/row-level security/);
    await expect(db.debt(intruder, a.customerId, 1000)).rejects.toThrow("customer_not_found");
    await db.debt(a.owner, a.customerId, 1000);
    await expect(db.repay(intruder, a.customerId, 1000)).rejects.toThrow("customer_not_found");

    const renamed = await db.as(intruder, "update public.customers set name = 'X' where id = $1 returning id", [
      a.customerId,
    ]);
    expect(renamed).toHaveLength(0);
  });

  it("un visiteur non connecté n'a accès à rien", async () => {
    const a = await setupShop();
    await expect(db.as(null, "select * from public.customers")).rejects.toThrow(/permission denied/);
    await expect(db.as(null, "select * from public.ledger_transactions")).rejects.toThrow(/permission denied/);
    await expect(db.as(null, "select public.record_debt($1, 1000, gen_random_uuid())", [a.customerId])).rejects.toThrow(
      /permission denied/,
    );
    await expect(db.as(null, "select public.create_shop('X')")).rejects.toThrow(/permission denied/);
  });
});
