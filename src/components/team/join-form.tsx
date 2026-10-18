"use client";

import { useActionState } from "react";
import { FormAlert, SubmitButton, TextField } from "@/components/ui/form";
import { getMessages } from "@/i18n";
import { acceptInvitation } from "@/server/actions/team";

const t = getMessages();

export function JoinForm({ initialCode }: { initialCode: string }) {
  const [state, action] = useActionState(acceptInvitation, { values: { code: initialCode } });
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <FormAlert error={state.error} />
      <TextField
        label={t.join.code}
        name="code"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        hint={t.join.codeHint}
        maxLength={12}
        required
        defaultValue={state.values?.code}
        errors={state.fieldErrors?.code}
        className="tabular min-h-14 w-full rounded-xl border-2 border-border bg-surface px-4 text-center text-2xl font-bold tracking-widest uppercase outline-none focus:border-brand"
      />
      <SubmitButton>{t.join.submit}</SubmitButton>
    </form>
  );
}
