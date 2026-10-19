"use server";

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { getMessages } from "@/i18n";
import { requireShop } from "@/lib/auth/session";
import { dbErrorMessage } from "@/lib/errors";
import { formatFCFA } from "@/lib/format/currency";
import { repaymentReceipt } from "@/lib/receipt";
import { createClient } from "@/lib/supabase/server";
import { invalidForm, type FormState } from "@/lib/validation/form-state";
import { correctionSchema, debtSchema, formFields, repaymentSchema, reversalSchema } from "@/lib/validation/schemas";

/**
 * Opérations financières. Les montants et soldes sont toujours calculés par PostgreSQL
 * (fonctions record_debt / record_repayment / reverse_transaction) : l'action ne fait
 * que valider la saisie, appeler la fonction et relire le solde.
 */

const t = getMessages();

type ErrorWithDetails = { message?: string; code?: string; details?: string | null };

function ledgerErrorMessage(error: ErrorWithDetails): string {
  if (error.message === "amount_exceeds_balance" && error.details) {
    return t.ledger.exceedsBalance.replace("{balance}", formatFCFA(error.details));
  }
  return dbErrorMessage(error);
}

async function customerSummary(customerId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("customer_balances")
    .select("name, phone, balance")
    .eq("customer_id", customerId)
    .maybeSingle();
  const balance = Number(data?.balance ?? 0);
  return { name: data?.name ?? "", phone: data?.phone ?? null, balance, formattedBalance: formatFCFA(balance) };
}

export async function recordDebt(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireShop();
  const raw = formFields(formData, ["customerId", "amount", "description", "date", "requestId"]);
  const parsed = debtSchema.safeParse(raw);
  if (!parsed.success) return { ...invalidForm(parsed.error, raw), requestId: raw.requestId };

  const { customerId, amount, description, date, requestId } = parsed.data;
  const supabase = await createClient();
  const { data: tx, error } = await supabase.rpc("record_debt", {
    p_customer_id: customerId,
    p_amount: amount,
    p_client_request_id: requestId,
    p_description: description,
    p_occurred_at: date,
  });
  if (error) return { error: ledgerErrorMessage(error), values: raw, requestId };

  const summary = await customerSummary(customerId);
  refresh();
  return {
    success: t.ledger.debtSaved
      .replace("{amount}", formatFCFA(amount))
      .replace("{name}", summary.name)
      .replace("{balance}", summary.formattedBalance),
    customerId,
    requestId: randomUUID(),
    transactionId: tx.id,
    transactionAmount: amount,
    correctionRequestId: randomUUID(),
  };
}

export async function recordRepayment(_prev: FormState, formData: FormData): Promise<FormState> {
  const { shop } = await requireShop();
  const raw = formFields(formData, ["customerId", "amount", "paymentMethod", "comment", "date", "requestId"]);
  const parsed = repaymentSchema.safeParse(raw);
  if (!parsed.success) return { ...invalidForm(parsed.error, raw), requestId: raw.requestId };

  const { customerId, amount, paymentMethod, comment, date, requestId } = parsed.data;
  const supabase = await createClient();
  const { data: tx, error } = await supabase.rpc("record_repayment", {
    p_customer_id: customerId,
    p_amount: amount,
    p_client_request_id: requestId,
    p_payment_method: paymentMethod,
    p_comment: comment,
    p_occurred_at: date,
  });
  if (error) {
    // Le solde a pu changer entre-temps : on rafraîchit l'affichage.
    if (error.message === "amount_exceeds_balance") refresh();
    return { error: ledgerErrorMessage(error), values: raw, requestId };
  }

  const summary = await customerSummary(customerId);
  refresh();
  return {
    success: t.ledger.repaymentSaved
      .replace("{amount}", formatFCFA(amount))
      .replace("{name}", summary.name)
      .replace("{balance}", summary.formattedBalance),
    customerId,
    requestId: randomUUID(),
    transactionId: tx.id,
    transactionAmount: amount,
    correctionRequestId: randomUUID(),
    receipt: {
      phone: summary.phone,
      text: repaymentReceipt({
        shopName: shop.name,
        amount,
        paymentMethod,
        occurredAt: date,
        remaining: summary.balance,
      }),
    },
  };
}

/** Annulation : propriétaire uniquement (contrôlé aussi par la fonction PostgreSQL). */
export async function reverseTransaction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { role } = await requireShop();
  const raw = formFields(formData, ["transactionId", "reason", "requestId"]);
  if (role !== "owner") return { error: t.errors.forbidden, values: raw, requestId: raw.requestId };

  const parsed = reversalSchema.safeParse(raw);
  if (!parsed.success) return { ...invalidForm(parsed.error, raw), requestId: raw.requestId };

  const { transactionId, reason, requestId } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("reverse_transaction", {
    p_transaction_id: transactionId,
    p_reason: reason,
    p_client_request_id: requestId,
  });
  if (error) return { error: ledgerErrorMessage(error), values: raw, requestId };

  refresh();
  return { success: t.ledger.reversed, requestId: randomUUID() };
}

/**
 * Correction du montant : annule l'opération et enregistre la bonne, en une seule fois
 * (fonction PostgreSQL correct_transaction). Propriétaire toujours ; auteur pendant 30 minutes.
 */
export async function correctTransaction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireShop();
  const raw = formFields(formData, ["transactionId", "amount", "reason", "requestId"]);
  const parsed = correctionSchema.safeParse(raw);
  if (!parsed.success) return { ...invalidForm(parsed.error, raw), requestId: raw.requestId };

  const { transactionId, amount, reason, requestId } = parsed.data;
  const supabase = await createClient();
  const { data: original } = await supabase
    .from("ledger_transactions")
    .select("amount")
    .eq("id", transactionId)
    .maybeSingle();
  const { data: fixed, error } = await supabase.rpc("correct_transaction", {
    p_transaction_id: transactionId,
    p_new_amount: amount,
    p_client_request_id: requestId,
    p_reason: reason,
  });
  if (error) return { error: ledgerErrorMessage(error), values: raw, requestId };

  const summary = await customerSummary(fixed.customer_id);
  refresh();
  return {
    success: t.ledger.corrected
      .replace("{old}", formatFCFA(original?.amount ?? 0))
      .replace("{new}", formatFCFA(amount))
      .replace("{balance}", summary.formattedBalance),
    customerId: fixed.customer_id,
    transactionId: fixed.id,
    requestId: randomUUID(),
  };
}
