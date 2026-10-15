"use client";

import { useOffline } from "next/offline";
import { getMessages } from "@/i18n";
import { usePendingOperations } from "@/lib/offline/client";

const t = getMessages();

/**
 * Bandeau d'état : hors ligne, et/ou opérations hors ligne en attente ou refusées.
 * Le lien vers /offline est un <a> (navigation complète) : sans réseau, le service
 * worker sert la page en cache.
 */
export function OfflineBanner() {
  const isOffline = useOffline();
  const ops = usePendingOperations();
  const pending = ops.filter((op) => op.status === "pending").length;
  const rejected = ops.length - pending;

  if (!isOffline && !pending && !rejected) return null;

  return (
    <div role="status" className="flex flex-col gap-1 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">
      {isOffline && <p className="font-semibold">{t.offline.banner}</p>}
      {pending > 0 && <p>{t.offline.pending.replace("{count}", String(pending))}</p>}
      {rejected > 0 && <p className="font-semibold text-debt">{t.offline.rejected.replace("{count}", String(rejected))}</p>}
      <a href="/offline" className="self-start font-semibold underline underline-offset-4">
        {isOffline ? t.offline.openOfflineMode : t.offline.see} →
      </a>
    </div>
  );
}
