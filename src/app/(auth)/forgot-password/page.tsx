"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormAlert, SubmitButton, TextField } from "@/components/ui/form";
import { getMessages } from "@/i18n";
import { initialFormState } from "@/lib/validation/form-state";
import { requestPasswordReset } from "@/server/actions/auth";

const t = getMessages();

export default function ForgotPasswordPage() {
  const [state, action] = useActionState(requestPasswordReset, initialFormState);

  return (
    <>
      <h1 className="text-3xl font-bold">{t.auth.forgotTitle}</h1>
      {state.success ? (
        <FormAlert success={state.success} />
      ) : (
        <form action={action} className="flex flex-col gap-5" noValidate>
          <p className="text-base text-muted">{t.auth.forgotIntro}</p>
          <FormAlert error={state.error} />
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
          <SubmitButton>{t.auth.forgotSubmit}</SubmitButton>
        </form>
      )}
      <Link href="/login" className="text-base font-semibold text-brand underline-offset-4 hover:underline">
        {t.auth.loginLink}
      </Link>
    </>
  );
}
