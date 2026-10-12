"use client";

import { useActionState } from "react";
import { FormAlert, SubmitButton, TextField } from "@/components/ui/form";
import { getMessages } from "@/i18n";
import { initialFormState } from "@/lib/validation/form-state";
import { updatePassword } from "@/server/actions/auth";

const t = getMessages();

/** Atteinte via le lien « mot de passe oublié » (session de récupération) ou depuis les paramètres. */
export default function ResetPasswordPage() {
  const [state, action] = useActionState(updatePassword, initialFormState);

  return (
    <>
      <h1 className="text-3xl font-bold">{t.auth.resetTitle}</h1>
      <form action={action} className="flex flex-col gap-5" noValidate>
        <FormAlert error={state.error} />
        <TextField
          label={t.fields.newPassword}
          name="password"
          type="password"
          autoComplete="new-password"
          hint={t.fields.passwordHint}
          required
          errors={state.fieldErrors?.password}
        />
        <TextField
          label={t.fields.confirmPassword}
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          errors={state.fieldErrors?.confirmPassword}
        />
        <SubmitButton>{t.auth.resetSubmit}</SubmitButton>
      </form>
    </>
  );
}
