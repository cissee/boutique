"use client";

import { useActionState } from "react";
import { FormAlert, SubmitButton, TextField } from "@/components/ui/form";
import { getMessages } from "@/i18n";
import { formatPhone } from "@/lib/format/phone";
import { saveProfile } from "@/server/actions/account";

const t = getMessages();

type Props = {
  defaults: { fullName: string; phone: string | null };
  /** Dans l'onboarding, l'enregistrement mène à l'étape suivante. */
  onboarding?: boolean;
  submitLabel: string;
};

export function ProfileForm({ defaults, onboarding, submitLabel }: Props) {
  const [state, action] = useActionState(saveProfile, {
    values: { fullName: defaults.fullName, phone: formatPhone(defaults.phone) },
  });

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {onboarding && <input type="hidden" name="onboarding" value="1" />}
      <FormAlert error={state.error} success={state.success} />
      <TextField
        label={t.fields.fullName}
        name="fullName"
        autoComplete="name"
        required
        defaultValue={state.values?.fullName}
        errors={state.fieldErrors?.fullName}
      />
      <TextField
        label={t.fields.phone}
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        optional
        hint={t.fields.phoneHint}
        defaultValue={state.values?.phone}
        errors={state.fieldErrors?.phone}
      />
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
