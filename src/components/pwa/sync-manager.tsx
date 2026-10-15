"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { runSync, SYNC_REQUEST_EVENT } from "@/lib/offline/client";
import { syncOfflineOperation } from "@/server/actions/offline";

const RETRY_INTERVAL_MS = 60_000;

/**
 * Envoie la file hors ligne : à l'ouverture, au retour d'Internet, à chaque nouvelle
 * saisie et toutes les minutes. Rafraîchit la page quand des opérations sont passées.
 */
export function SyncManager() {
  const router = useRouter();

  useEffect(() => {
    const sync = () => {
      runSync(syncOfflineOperation)
        .then((report) => {
          if (report?.synced) router.refresh();
        })
        .catch(() => undefined);
    };
    sync();
    window.addEventListener("online", sync);
    window.addEventListener(SYNC_REQUEST_EVENT, sync);
    const timer = window.setInterval(sync, RETRY_INTERVAL_MS);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener(SYNC_REQUEST_EVENT, sync);
      window.clearInterval(timer);
    };
  }, [router]);

  return null;
}
