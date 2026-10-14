"use client";

import { useState, useSyncExternalStore } from "react";
import { getMessages } from "@/i18n";

const t = getMessages();

/** Le partage de fichiers (WhatsApp, etc.) n'existe que sur certains navigateurs mobiles. */
function canShareFiles(): boolean {
  try {
    return typeof navigator !== "undefined" && typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [new File([], "test.pdf", { type: "application/pdf" })] });
  } catch {
    return false;
  }
}

const subscribe = () => () => {};

/** Boutons « Relevé PDF » (ouvrir/télécharger) et « Envoyer le relevé » (partage natif). */
export function StatementActions({ customerId, shopName, className }: { customerId: string; shopName: string; className: string }) {
  const shareSupported = useSyncExternalStore(subscribe, canShareFiles, () => false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const href = `/customers/${customerId}/statement`;

  async function share() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(href);
      if (!res.ok) throw new Error(String(res.status));
      const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "releve.pdf";
      const file = new File([await res.blob()], name, { type: "application/pdf" });
      await navigator.share({ files: [file], title: t.customers.shareText.replace("{shop}", shopName) });
    } catch (e) {
      // Annulation par l'utilisateur : pas une erreur.
      if (!(e instanceof DOMException && e.name === "AbortError")) setError(t.customers.shareFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <a href={href} target="_blank" rel="noopener" className={className}>
        {t.customers.statement}
      </a>
      {shareSupported && (
        <button type="button" onClick={share} disabled={busy} className={`${className} disabled:opacity-60`}>
          {busy ? t.common.loading : t.customers.shareStatement}
        </button>
      )}
      {error && <p className="w-full text-sm text-debt">{error}</p>}
    </>
  );
}
