import type { SnapshotCustomer } from "./types";

/** Liste de clients (vue customer_balances) -> copie locale consultable hors ligne. */
export function toSnapshotCustomers(
  rows: { customer_id: string; name: string; phone: string | null; balance: number }[],
): SnapshotCustomer[] {
  return rows.map((c) => ({ id: c.customer_id, name: c.name, phone: c.phone, balance: c.balance }));
}
