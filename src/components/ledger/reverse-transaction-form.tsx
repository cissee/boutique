"use client";

import { useActionState, useState } from "react";
import { FormAlert, SubmitButton, TextField } from "@/components/ui/form";
import { getMessages } from "@/i18n";
import { reverseTransaction } from "@/server/actions/ledger";

const t = getMessages();

/** Annulation d'une opération par le propriétaire, avec motif obligatoire. */
export function ReverseTransactionForm({ transactionId, requestId }: { transactionId: string; requestId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(reverseTransaction, { requestId });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-9 self-start rounded-lg border border-border px-3 text-sm font-semibold text-debt"
      >
        {t.ledger.reverse}
      </button>
    );
  }

  return (
    <form action={action} className="mt-2 flex flex-col gap-3 rounded-xl border-2 border-debt bg-debt-soft p-3" noValidate>
      <p className="text-base font-semibold text-debt">{t.ledger.reverseTitle}</p>
      <input type="hidden" name="transactionId" value={transactionId} />
      <input type="hidden" name="requestId" value={state.requestId ?? requestId} />
      <FormAlert error={state.error} />
      <TextField
        label={t.ledger.reverseReason}
        name="reason"
        required
        maxLength={500}
        hint={t.ledger.reverseReasonHint}
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
        <SubmitButton variant="danger">{t.ledger.reverseConfirm}</SubmitButton>
      </div>
    </form>
  );
}
