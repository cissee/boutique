"use client";

import { useActionState } from "react";
import { FormAlert, SubmitButton, TextField } from "@/components/ui/form";
import { getMessages } from "@/i18n";
import { formatPhone } from "@/lib/format/phone";
import type { FormState } from "@/lib/validation/form-state";

const t = getMessages();

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  defaults?: { name: string; phone: string | null; address: string | null };
  submitLabel: string;
  readOnly?: boolean;
};

export function ShopForm({ action: serverAction, defaults, submitLabel, readOnly }: Props) {
  const [state, action] = useActionState(serverAction, {
    values: {
      name: defaults?.name ?? "",
      phone: formatPhone(defaults?.phone),
      address: defaults?.address ?? "",
    },
  });

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <FormAlert error={state.error} success={state.success} />
      <fieldset disabled={readOnly} className="flex flex-col gap-5 disabled:opacity-70">
        <TextField
          label={t.fields.shopName}
          name="name"
          hint={t.fields.shopNameHint}
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
        <TextField
          label={t.fields.address}
          name="address"
          optional
          defaultValue={state.values?.address}
          errors={state.fieldErrors?.address}
        />
      </fieldset>
      {!readOnly && <SubmitButton>{submitLabel}</SubmitButton>}
    </form>
  );
}
