import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";

const root = join(__dirname, "..", "..");
const migrationsDir = join(root, "supabase", "migrations");

/** Base PostgreSQL en mémoire avec l'environnement Supabase simulé et toutes les migrations. */
export async function createTestDb(): Promise<TestDb> {
  const pg = await PGlite.create({ extensions: { pg_trgm } });
  await pg.exec(readFileSync(join(__dirname, "supabase-shim.sql"), "utf8"));
  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
    await pg.exec(readFileSync(join(migrationsDir, file), "utf8"));
  }
  return new TestDb(pg);
}

type Row = Record<string, unknown>;

export class TestDb {
  constructor(readonly pg: PGlite) {}

  /** Requête en superutilisateur (préparation des données de test). */
  async admin<T extends Row = Row>(sql: string, params: unknown[] = []): Promise<T[]> {
    await this.pg.exec("reset role; select set_config('request.jwt.claims', '', false);");
    return (await this.pg.query<T>(sql, params)).rows;
  }

  /** Crée un utilisateur Supabase Auth (le trigger crée son profil). */
  async createUser(fullName = "Test"): Promise<string> {
    const id = randomUUID();
    await this.admin(
      "insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)",
      [id, `${id}@test.local`, JSON.stringify({ full_name: fullName })],
    );
    return id;
  }

  /** Exécute une requête avec le rôle `authenticated` et le JWT de l'utilisateur, comme PostgREST. */
  async as<T extends Row = Row>(userId: string | null, sql: string, params: unknown[] = []): Promise<T[]> {
    const role = userId ? "authenticated" : "anon";
    const claims = userId ? JSON.stringify({ sub: userId, role }) : "";
    await this.pg.query("select set_config('request.jwt.claims', $1, false)", [claims]);
    await this.pg.exec(`set role ${role}`);
    try {
      return (await this.pg.query<T>(sql, params)).rows;
    } finally {
      await this.pg.exec("reset role");
    }
  }

  /** Crée une boutique via la RPC, l'utilisateur en devient propriétaire. */
  async createShop(ownerId: string, name = "Boutique test"): Promise<string> {
    const [shop] = await this.as<{ id: string }>(ownerId, "select id from public.create_shop($1)", [name]);
    return shop.id;
  }

  async addMember(shopId: string, userId: string, role: "owner" | "seller"): Promise<void> {
    await this.admin("insert into public.shop_members (shop_id, user_id, role) values ($1, $2, $3)", [
      shopId,
      userId,
      role,
    ]);
  }

  async createCustomer(userId: string, shopId: string, name = "Client"): Promise<string> {
    const [c] = await this.as<{ id: string }>(
      userId,
      "insert into public.customers (shop_id, name) values ($1, $2) returning id",
      [shopId, name],
    );
    return c.id;
  }

  async debt(userId: string, customerId: string, amount: number, requestId = randomUUID()) {
    const [tx] = await this.as<LedgerRow>(
      userId,
      "select * from public.record_debt($1, $2, $3)",
      [customerId, amount, requestId],
    );
    return tx;
  }

  async repay(userId: string, customerId: string, amount: number, requestId = randomUUID()) {
    const [tx] = await this.as<LedgerRow>(
      userId,
      "select * from public.record_repayment($1, $2, $3, 'CASH')",
      [customerId, amount, requestId],
    );
    return tx;
  }

  async reverse(userId: string, transactionId: string, reason = "Erreur de saisie", requestId = randomUUID()) {
    const [tx] = await this.as<LedgerRow>(
      userId,
      "select * from public.reverse_transaction($1, $2, $3)",
      [transactionId, reason, requestId],
    );
    return tx;
  }

  /** Solde tel que vu par l'utilisateur (vue soumise à la RLS). */
  async balance(userId: string, customerId: string): Promise<number> {
    const [row] = await this.as<{ balance: string }>(
      userId,
      "select balance::text from public.customer_balances where customer_id = $1",
      [customerId],
    );
    return Number(row.balance);
  }

  /** Solde recalculé directement depuis le registre (référence). */
  async ledgerSum(customerId: string): Promise<number> {
    const [row] = await this.admin<{ s: string }>(
      "select coalesce(sum(balance_effect), 0)::text as s from public.ledger_transactions where customer_id = $1",
      [customerId],
    );
    return Number(row.s);
  }
}

export type LedgerRow = {
  id: string;
  type: "DEBT" | "REPAYMENT" | "REVERSAL";
  amount: string;
  balance_effect: string;
  reversed_transaction_id: string | null;
};
