"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { FormAlert, SubmitButton, TextField } from "@/components/ui/form";
import { getMessages } from "@/i18n";
import { initialFormState } from "@/lib/validation/form-state";
import { signIn } from "@/server/actions/auth";

const t = getMessages();

export function LoginForm() {
  const [state, action] = useActionState(signIn, initialFormState);
  const searchParams = useSearchParams();
  const linkError = searchParams.get("error") === "link" ? t.auth.linkInvalid : undefined;

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="next" value={searchParams.get("next") ?? ""} />
      <FormAlert error={state.error ?? linkError} />
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
      <TextField
        label={t.fields.password}
        name="password"
        type="password"
        autoComplete="current-password"
        required
        errors={state.fieldErrors?.password}
      />
      <SubmitButton>{t.auth.loginSubmit}</SubmitButton>
    </form>
  );
}
