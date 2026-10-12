"use client";

import { useActionState } from "react";
import { FormAlert, SubmitButton } from "@/components/ui/form";
import { getMessages } from "@/i18n";
import { initialFormState } from "@/lib/validation/form-state";
import { archiveCustomer } from "@/server/actions/customers";

const t = getMessages();

export function ArchiveCustomerButton({ customerId }: { customerId: string }) {
  const [state, action] = useActionState(archiveCustomer, initialFormState);

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(t.customers.archiveConfirm)) e.preventDefault();
      }}
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="id" value={customerId} />
      <FormAlert error={state.error} />
      <SubmitButton variant="danger">{t.customers.archive}</SubmitButton>
    </form>
  );
}
