"use client";

import { useEffect } from "react";

/** Enregistre le service worker (production uniquement) et rafraîchit la page /offline en cache. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then(async (registration) => {
        await navigator.serviceWorker.ready;
        if (navigator.onLine) registration.active?.postMessage("refresh-offline");
      })
      .catch(() => undefined);
  }, []);
  return null;
}
