"use client";

import { useActionState } from "react";
import { FormAlert, SubmitButton, TextAreaField, TextField } from "@/components/ui/form";
import { getMessages } from "@/i18n";
import { formatPhone } from "@/lib/format/phone";
import type { FormState } from "@/lib/validation/form-state";

const t = getMessages();

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  customer?: { id: string; name: string; phone: string | null; notes: string | null };
  submitLabel: string;
};

export function CustomerForm({ action: serverAction, customer, submitLabel }: Props) {
  const [state, action] = useActionState(serverAction, {
    values: {
      name: customer?.name ?? "",
      phone: formatPhone(customer?.phone),
      notes: customer?.notes ?? "",
    },
  });

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {customer && <input type="hidden" name="id" value={customer.id} />}
      <FormAlert error={state.error} />
      <TextField
        label={t.fields.customerName}
        name="name"
        autoComplete="off"
        required
        maxLength={100}
        defaultValue={state.values?.name}
        errors={state.fieldErrors?.name}
      />
      <TextField
        label={t.fields.phone}
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="off"
        optional
        hint={t.fields.phoneHint}
        defaultValue={state.values?.phone}
        errors={state.fieldErrors?.phone}
      />
      <TextAreaField
        label={t.customers.notes}
        name="notes"
        optional
        maxLength={1000}
        hint={t.customers.notesHint}
        defaultValue={state.values?.notes}
        errors={state.fieldErrors?.notes}
      />
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
