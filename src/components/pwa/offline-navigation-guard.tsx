"use client";

import { useOffline } from "next/offline";
import { useEffect, useRef } from "react";
import { browserOffline } from "@/lib/offline/form";

/**
 * Sans réseau, une navigation dans l'application (onglets, liste des clients…) resterait
 * bloquée sur l'écran de chargement. Ce garde intercepte les clics sur les liens internes
 * et ouvre à la place le mode hors ligne (servi par le service worker).
 */
export function OfflineNavigationGuard() {
  const isOffline = useOffline();
  const offlineRef = useRef(isOffline);

  useEffect(() => {
    offlineRef.current = isOffline;
  }, [isOffline]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (!offlineRef.current && !browserOffline()) return;
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (!(link instanceof HTMLAnchorElement) || link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === "/offline") return;

      event.preventDefault();
      event.stopPropagation();
      window.location.assign("/offline");
    }
    // Phase de capture : avant le gestionnaire de <Link> de Next.js.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
