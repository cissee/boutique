"use client";

import { useActionState } from "react";
import { FormAlert } from "@/components/ui/form";
import { getMessages } from "@/i18n";
import { initialFormState } from "@/lib/validation/form-state";
import { leaveShop, removeMember } from "@/server/actions/team";

const t = getMessages();

const buttonClass = "min-h-10 rounded-lg border-2 border-debt px-3 text-sm font-semibold text-debt disabled:opacity-60";

/** Propriétaire : retirer un vendeur, après confirmation. */
export function RemoveMemberButton({ userId, name }: { userId: string; name: string }) {
  const [state, action, pending] = useActionState(removeMember, initialFormState);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(t.team.removeConfirm.replace("{name}", name))) e.preventDefault();
      }}
      className="flex flex-col items-end gap-1"
    >
      <input type="hidden" name="userId" value={userId} />
      <button type="submit" disabled={pending} className={buttonClass}>
        {t.team.remove}
      </button>
      {state.error && <p className="text-xs text-debt">{state.error}</p>}
    </form>
  );
}

/** Vendeur : quitter la boutique, après confirmation. */
export function LeaveShopButton() {
  const [state, action, pending] = useActionState(leaveShop, initialFormState);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(t.team.leaveConfirm)) e.preventDefault();
      }}
      className="flex flex-col gap-2"
    >
      <FormAlert error={state.error} />
      <button type="submit" disabled={pending} className={`${buttonClass} min-h-12 w-full text-base`}>
        {t.team.leave}
      </button>
    </form>
  );
}
