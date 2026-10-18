"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { FormAlert, PasswordField, SubmitButton, TextField } from "@/components/ui/form";
import { getMessages } from "@/i18n";
import { initialFormState } from "@/lib/validation/form-state";
import { signUp } from "@/server/actions/auth";

const t = getMessages();

export function SignupForm() {
  const [state, action] = useActionState(signUp, initialFormState);
  const next = useSearchParams().get("next") ?? "";

  if (state.success) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl bg-repayment-soft p-5 text-repayment" role="status">
        <h2 className="text-xl font-bold">{t.auth.checkEmailTitle}</h2>
        <p className="text-base">{state.success}</p>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="next" value={next} />
      <FormAlert error={state.error} />
      <TextField
        label={t.fields.fullName}
        name="fullName"
        autoComplete="name"
        required
        defaultValue={state.values?.fullName}
        errors={state.fieldErrors?.fullName}
      />
      <TextField
        label={t.fields.email}
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={state.values?.email}
        errors={state.fieldErrors?.email}
      />
      <PasswordField
        label={t.fields.password}
        name="password"
        autoComplete="new-password"
        hint={t.fields.passwordHint}
        required
        errors={state.fieldErrors?.password}
      />
      <PasswordField
        label={t.fields.confirmPassword}
        name="confirmPassword"
        autoComplete="new-password"
        required
        errors={state.fieldErrors?.confirmPassword}
      />
      <SubmitButton>{t.auth.signupSubmit}</SubmitButton>
    </form>
  );
}
