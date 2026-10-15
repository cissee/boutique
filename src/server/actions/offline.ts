"use server";

import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { dbErrorMessage } from "@/lib/errors";
import { MAX_AMOUNT } from "@/lib/format/currency";
import { PAYMENT_METHODS } from "@/lib/ledger";
import { classifyLedgerError } from "@/lib/offline/classify";
import type { SyncResult } from "@/lib/offline/types";
import { createClient } from "@/lib/supabase/server";

/** Opération reçue du navigateur : tout est revalidé ici, puis par PostgreSQL. */
const operationSchema = z.object({
  requestId: z.uuid(),
  kind: z.enum(["DEBT", "REPAYMENT"]),
  customerId: z.uuid(),
  amount: z.number().int().positive().max(MAX_AMOUNT),
  description: z.string().trim().max(500).nullable(),
  paymentMethod: z.enum(PAYMENT_METHODS).nullable(),
  occurredAt: z.iso.datetime({ offset: true }),
});

/**
 * Envoie une opération saisie hors ligne. Renvoie « done », « rejected » (refus définitif,
 * avec un message lisible) ou « auth » (session expirée). Toute autre erreur est levée :
 * le navigateur réessaiera plus tard avec le même requestId (idempotent).
 */
export async function syncOfflineOperation(input: unknown): Promise<SyncResult> {
  if (!(await getCurrentUser())) return { status: "auth" };

  const parsed = operationSchema.safeParse(input);
  if (!parsed.success) return { status: "rejected", message: dbErrorMessage({ message: "invalid_input" }) };
  const op = parsed.data;

  const supabase = await createClient();
  const { error } =
    op.kind === "DEBT"
      ? await supabase.rpc("record_debt", {
          p_customer_id: op.customerId,
          p_amount: op.amount,
          p_client_request_id: op.requestId,
          p_description: op.description,
          p_occurred_at: op.occurredAt,
        })
      : await supabase.rpc("record_repayment", {
          p_customer_id: op.customerId,
          p_amount: op.amount,
          p_client_request_id: op.requestId,
          p_payment_method: op.paymentMethod,
          p_comment: op.description,
          p_occurred_at: op.occurredAt,
        });

  if (!error) return { status: "done" };
  const classified = classifyLedgerError(error, dbErrorMessage);
  if (classified) return classified;
  throw new Error("sync_temporarily_failed");
}
