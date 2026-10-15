"use client";

import { useActionState, useState } from "react";
import { FormAlert, SubmitButton } from "@/components/ui/form";
import { getMessages } from "@/i18n";
import { displayCode } from "@/lib/invitations";
import { createInvitation, type InvitationState } from "@/server/actions/team";

const t = getMessages();

export function InvitePanel({ shopName, joinBaseUrl }: { shopName: string; joinBaseUrl: string }) {
  const [state, action] = useActionState<InvitationState>(createInvitation, {});
  const [copied, setCopied] = useState(false);
  const link = state.code ? `${joinBaseUrl}/join?code=${state.code}` : "";
  const message = state.code
    ? t.team.whatsappMessage
        .replace("{shop}", shopName)
        .replace("{link}", link)
        .replace("{code}", displayCode(state.code))
    : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">{t.team.inviteIntro}</p>
      <FormAlert error={state.error} />

      {state.code && (
        <div className="flex flex-col gap-3 rounded-xl border-2 border-brand bg-brand-soft p-4">
          <p className="text-sm font-semibold text-brand-strong">{t.team.newCode}</p>
          <p className="tabular text-center text-3xl font-bold tracking-widest" aria-live="polite">
            {displayCode(state.code)}
          </p>
          <p className="text-sm">{t.team.codeHelp}</p>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(message)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-12 items-center justify-center rounded-xl bg-repayment px-4 font-semibold text-white"
          >
            {t.team.shareWhatsapp}
          </a>
          <button
            type="button"
            onClick={copy}
            className="min-h-12 rounded-xl border-2 border-brand bg-surface px-4 font-semibold text-brand"
          >
            {copied ? t.team.copied : t.team.copyLink}
          </button>
        </div>
      )}

      <form action={action}>
        <SubmitButton>{t.team.invite}</SubmitButton>
      </form>
    </div>
  );
}
