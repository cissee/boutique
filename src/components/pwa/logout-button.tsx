"use client";

import { useTransition } from "react";
import { getMessages } from "@/i18n";
import { clearOfflineData, offlineStore } from "@/lib/offline/client";
import { signOut } from "@/server/actions/auth";

const t = getMessages();

/** Déconnexion : prévient s'il reste des opérations hors ligne, puis efface les données locales. */
export function LogoutButton() {
  const [pending, startTransition] = useTransition();

  async function logout() {
    const ops = (await offlineStore()?.listOperations()) ?? [];
    const unsent = ops.filter((op) => op.status === "pending").length;
    if (unsent && !window.confirm(t.offline.logoutPendingConfirm.replace("{count}", String(unsent)))) return;
    await clearOfflineData().catch(() => undefined);
    startTransition(() => signOut());
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={pending}
      className="flex min-h-14 w-full items-center justify-center rounded-xl border-2 border-debt bg-surface px-6 text-lg font-semibold text-debt disabled:opacity-60"
    >
      {pending ? t.common.loading : t.auth.logout}
    </button>
  );
}
