import type { Metadata } from "next";
import { OfflineApp } from "@/components/pwa/offline-app";
import { SyncManager } from "@/components/pwa/sync-manager";
import { getMessages } from "@/i18n";

const t = getMessages();

export const metadata: Metadata = { title: t.offline.title };

/**
 * Page statique, mise en cache par le service worker : aucune donnée côté serveur,
 * tout vient du stockage local du téléphone (IndexedDB).
 */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6">
      <OfflineApp />
      <SyncManager />
    </main>
  );
}
