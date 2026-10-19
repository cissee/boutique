"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { FormAlert, SubmitButton, TextField } from "@/components/ui/form";
import { getMessages } from "@/i18n";
import { formatFCFA } from "@/lib/format/currency";
import { correctTransaction } from "@/server/actions/ledger";
import { AmountInput } from "./amount-input";

const t = getMessages();

/**
 * Correction du montant d'une dette ou d'un remboursement. La base annule l'opération
 * d'origine et enregistre la bonne en une seule fois : l'historique garde la trace.
 */
export function CorrectTransactionForm({
  transactionId,
  currentAmount,
  requestId,
  buttonLabel = t.ledger.correct,
}: {
  transactionId: string;
  currentAmount: number;
  requestId: string;
  buttonLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [state, action, pending] = useActionState(correctTransaction, { requestId });

  // Envoi manuel : la saisie est conservée si la base refuse la correction.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => action(formData));
  }

  if (state.success) return <FormAlert success={state.success} />;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-9 self-start rounded-lg border border-border px-3 text-sm font-semibold text-brand"
      >
        {buttonLabel}
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-2 flex flex-col gap-3 rounded-xl border-2 border-brand bg-brand-soft p-3" noValidate>
      <p className="text-base font-semibold text-brand-strong">{t.ledger.correctTitle}</p>
      <p className="text-sm">{t.ledger.correctCurrent.replace("{amount}", formatFCFA(currentAmount))}</p>
      <input type="hidden" name="transactionId" value={transactionId} />
      <input type="hidden" name="requestId" value={state.requestId ?? requestId} />
      <FormAlert error={state.error} />
      <AmountInput label={t.ledger.correctNewAmount} value={amount} onChange={setAmount} errors={state.fieldErrors?.amount} />
      <TextField
        label={t.ledger.correctReason}
        name="reason"
        optional
        maxLength={500}
        hint={t.ledger.correctReasonHint}
        defaultValue={state.values?.reason}
        errors={state.fieldErrors?.reason}
      />
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="min-h-14 rounded-xl border-2 border-border bg-surface text-base font-semibold"
        >
          {t.ledger.reverseKeep}
        </button>
        <SubmitButton pending={pending}>{t.ledger.correctSubmit}</SubmitButton>
      </div>
    </form>
  );
}
