"use client";

import Link from "next/link";
import { startTransition, useActionState, useState, type FormEvent } from "react";
import { FormAlert, SubmitButton, TextAreaField, TextField } from "@/components/ui/form";
import { Money } from "@/components/ui/money";
import { getMessages } from "@/i18n";
import { formatAmountInput, formatFCFA, parseAmount } from "@/lib/format/currency";
import { PAYMENT_METHODS } from "@/lib/ledger";
import { recordRepayment } from "@/server/actions/ledger";
import { AmountChip, AmountInput } from "./amount-input";
import { CustomerPicker, type PickerCustomer } from "./customer-picker";
import { ReceiptButtons } from "./receipt-buttons";

const t = getMessages();

type Props = {
  /** Clients ayant un solde positif uniquement. */
  customers: PickerCustomer[];
  initialCustomerId: string | null;
  initialRequestId: string;
  today: string;
};

export function RepaymentForm({ customers, initialCustomerId, initialRequestId, today }: Props) {
  const [state, formAction, pending] = useActionState(recordRepayment, { requestId: initialRequestId });
  const requestId = state.requestId ?? initialRequestId;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="requestId" value={requestId} />
      {state.success && (
        <div className="flex flex-col gap-3">
          <FormAlert success={state.success} />
          {state.receipt && <ReceiptButtons text={state.receipt.text} phone={state.receipt.phone} />}
          {state.customerId && (
            <Link href={`/customers/${state.customerId}`} className="font-semibold text-brand underline-offset-4 hover:underline">
              {t.ledger.viewCustomer}
            </Link>
          )}
        </div>
      )}
      <FormAlert error={state.error} />
      <RepaymentFields
        key={requestId}
        customers={customers}
        initialCustomerId={initialCustomerId}
        today={today}
        fieldErrors={state.fieldErrors}
        pending={pending}
      />
    </form>
  );
}

function RepaymentFields({
  customers,
  initialCustomerId,
  today,
  fieldErrors,
  pending,
}: {
  customers: PickerCustomer[];
  initialCustomerId: string | null;
  today: string;
  fieldErrors?: Record<string, string[] | undefined>;
  pending: boolean;
}) {
  const [customerId, setCustomerId] = useState(
    customers.some((c) => c.id === initialCustomerId) ? initialCustomerId : null,
  );
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<string>("CASH");

  const customer = customers.find((c) => c.id === customerId) ?? null;
  const value = parseAmount(amount);
  const exceeds = customer !== null && value !== null && value > customer.balance;
  const amountErrors = exceeds
    ? [t.ledger.exceedsBalance.replace("{balance}", formatFCFA(customer.balance))]
    : fieldErrors?.amount;

  return (
    <>
      <CustomerPicker
        customers={customers}
        value={customerId}
        onChange={setCustomerId}
        errors={fieldErrors?.customerId}
        emptyMessage={t.ledger.noDebtors}
      />

      <AmountInput label={t.ledger.amountPaid} value={amount} onChange={setAmount} errors={amountErrors}>
        {customer && (
          <AmountChip onClick={() => setAmount(formatAmountInput(String(customer.balance)))}>
            {t.ledger.payAll.replace("{amount}", formatFCFA(customer.balance))}
          </AmountChip>
        )}
      </AmountInput>
      {customer && value !== null && !exceeds && (
        <p className="-mt-3 text-base">
          {t.ledger.remainingAfter.split("{amount}")[0]}
          <Money amount={customer.balance - value} tone={customer.balance - value > 0 ? "debt" : "repayment"} />
        </p>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-base font-semibold">{t.ledger.paymentMethod}</legend>
        <input type="hidden" name="paymentMethod" value={method} />
        <div className="flex flex-wrap gap-2">
          {PAYMENT_METHODS.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={method === m}
              onClick={() => setMethod(m)}
              className={`min-h-11 rounded-full border-2 px-4 text-sm font-semibold ${
                method === m ? "border-repayment bg-repayment text-white" : "border-border bg-surface"
              }`}
            >
              {t.transactions.paymentMethod[m]}
            </button>
          ))}
        </div>
      </fieldset>

      <TextField label={t.ledger.date} name="date" type="date" defaultValue={today} max={today} errors={fieldErrors?.date} />
      <TextAreaField label={t.ledger.comment} name="comment" optional maxLength={500} errors={fieldErrors?.comment} />

      <SubmitButton pending={pending} disabled={exceeds || customer === null}>
        {t.ledger.submitRepayment}
      </SubmitButton>
    </>
  );
}
