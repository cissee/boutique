import { BottomNav } from "@/components/layout/bottom-nav";
import { OfflineBanner } from "@/components/pwa/offline-banner";
import { SyncManager } from "@/components/pwa/sync-manager";
import { SideNav } from "@/components/layout/side-nav";

/** Coquille de l'application connectée (le contrôle de session sera ajouté à l'étape 5). */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1">
      <SideNav />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 pt-6 pb-28 md:px-8 md:pb-10">
        <OfflineBanner />
        <div>{children}</div>
      </main>
      <SyncManager />
      <BottomNav />
    </div>
  );
}
