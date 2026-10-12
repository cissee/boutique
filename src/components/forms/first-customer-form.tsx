"use client";

import { useActionState } from "react";
import { FormAlert, SubmitButton, TextField } from "@/components/ui/form";
import { getMessages } from "@/i18n";
import { initialFormState } from "@/lib/validation/form-state";
import { createFirstCustomer } from "@/server/actions/account";

const t = getMessages();

export function FirstCustomerForm() {
  const [state, action] = useActionState(createFirstCustomer, initialFormState);

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <FormAlert error={state.error} />
      <TextField
        label={t.fields.customerName}
        name="name"
        required
        defaultValue={state.values?.name}
        errors={state.fieldErrors?.name}
      />
      <TextField
        label={t.fields.phone}
        name="phone"
        type="tel"
        inputMode="tel"
        optional
        hint={t.fields.phoneHint}
        defaultValue={state.values?.phone}
        errors={state.fieldErrors?.phone}
      />
      <SubmitButton>{t.onboarding.customerSubmit}</SubmitButton>
    </form>
  );
}
