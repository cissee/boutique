"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { FormAlert, SubmitButton, TextField } from "@/components/ui/form";
import { getMessages } from "@/i18n";
import { formatAmountInput } from "@/lib/format/currency";
import { useLedgerSubmit } from "@/lib/offline/use-ledger-submit";
import { recordDebt } from "@/server/actions/ledger";
import { AmountChip, AmountInput } from "./amount-input";
import { CorrectTransactionForm } from "./correct-transaction-form";
import { CustomerPicker, type PickerCustomer } from "./customer-picker";

const t = getMessages();
const QUICK_AMOUNTS = [500, 1000, 2000, 5000];

type Props = {
  customers: PickerCustomer[];
  initialCustomerId: string | null;
  initialRequestId: string;
  today: string;
  shopId: string;
};

export function DebtForm({ customers, initialCustomerId, initialRequestId, today, shopId }: Props) {
  const [state, formAction, pending] = useActionState(recordDebt, { requestId: initialRequestId });
  // Envoi manuel (la saisie est conservée après une erreur) ; sans réseau, file du téléphone.
  const { requestId, onSubmit, offlineMessage, offlineError } = useLedgerSubmit({
    kind: "DEBT",
    state,
    formAction,
    initialRequestId,
    shopId,
    customers,
  });

  return (
    <div className="flex flex-col gap-5">
      {offlineMessage && <FormAlert success={offlineMessage} />}
      {!offlineMessage && state.success && (
        <div className="flex flex-col gap-2">
          <FormAlert success={state.success} />
          {state.transactionId && state.correctionRequestId && state.transactionAmount && (
            <CorrectTransactionForm
              key={state.transactionId}
              transactionId={state.transactionId}
              currentAmount={state.transactionAmount}
              requestId={state.correctionRequestId}
              buttonLabel={t.ledger.correctAfterSave}
            />
          )}
          {state.customerId && (
            <Link href={`/customers/${state.customerId}`} className="font-semibold text-brand underline-offset-4 hover:underline">
              {t.ledger.viewCustomer}
            </Link>
          )}
        </div>
      )}
      {/* Hors du <form> : le bloc de confirmation contient son propre formulaire (correction). */}
      <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        <input type="hidden" name="requestId" value={requestId} />
        <FormAlert error={offlineError ?? state.error} />
        {/* Nouvelle clé après chaque succès : les champs repartent à zéro pour la saisie suivante. */}
        <DebtFields
          key={requestId}
          customers={customers}
          initialCustomerId={initialCustomerId}
          today={today}
          fieldErrors={state.fieldErrors}
        />
        <SubmitButton pending={pending}>{t.ledger.submitDebt}</SubmitButton>
      </form>
    </div>
  );
}

function DebtFields({
  customers,
  initialCustomerId,
  today,
  fieldErrors,
}: {
  customers: PickerCustomer[];
  initialCustomerId: string | null;
  today: string;
  fieldErrors?: Record<string, string[] | undefined>;
}) {
  const [customerId, setCustomerId] = useState(initialCustomerId);
  const [amount, setAmount] = useState("");

  return (
    <>
      <CustomerPicker customers={customers} value={customerId} onChange={setCustomerId} errors={fieldErrors?.customerId} />
      <AmountInput label={t.ledger.amount} value={amount} onChange={setAmount} errors={fieldErrors?.amount}>
        {QUICK_AMOUNTS.map((value) => (
          <AmountChip key={value} onClick={() => setAmount(formatAmountInput(String(value)))}>
            {formatAmountInput(String(value))}
          </AmountChip>
        ))}
      </AmountInput>
      <TextField
        label={t.ledger.description}
        name="description"
        optional
        maxLength={500}
        hint={t.ledger.descriptionHint}
        errors={fieldErrors?.description}
      />
      <TextField label={t.ledger.date} name="date" type="date" defaultValue={today} max={today} errors={fieldErrors?.date} />
    </>
  );
}
