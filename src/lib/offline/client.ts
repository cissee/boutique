"use client";

import { useEffect, useState } from "react";
import { createIndexedDbStore, type OfflineStore } from "./store";
import { syncPending, type SyncReport } from "./sync";
import type { PendingOperation, SyncResult } from "./types";

/**
 * Accès au stockage hors ligne depuis le navigateur, notifications de changement
 * (y compris entre onglets) et lancement de la synchronisation.
 */

let store: OfflineStore | null = null;

export function offlineStore(): OfflineStore | null {
  if (typeof indexedDB === "undefined") return null;
  store ??= createIndexedDbStore();
  return store;
}

const listeners = new Set<() => void>();
let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  if (!channel) {
    channel = new BroadcastChannel("boutikdekk-offline");
    channel.onmessage = () => listeners.forEach((l) => l());
  }
  return channel;
}

export function subscribeOffline(listener: () => void): () => void {
  listeners.add(listener);
  getChannel();
  return () => listeners.delete(listener);
}

/** Signale un changement de la file (cet onglet et les autres). */
export function notifyOfflineChange(): void {
  listeners.forEach((l) => l());
  getChannel()?.postMessage("changed");
}

/** File d'attente, rechargée à chaque changement. */
export function usePendingOperations(): PendingOperation[] {
  const [ops, setOps] = useState<PendingOperation[]>([]);
  useEffect(() => {
    const load = () => {
      offlineStore()
        ?.listOperations()
        .then(setOps)
        .catch(() => undefined);
    };
    load();
    return subscribeOffline(load);
  }, []);
  return ops;
}

export async function enqueueOperation(op: PendingOperation): Promise<void> {
  const s = offlineStore();
  if (!s) throw new Error("Stockage local indisponible");
  await s.putOperation(op);
  notifyOfflineChange();
  window.dispatchEvent(new Event(SYNC_REQUEST_EVENT));
}

export const SYNC_REQUEST_EVENT = "boutikdekk:sync-request";

let running: Promise<SyncReport | null> | null = null;

/**
 * Lance une synchronisation si aucune n'est en cours (dans cet onglet, et dans les autres
 * grâce au verrou Web Locks quand il est disponible).
 */
export function runSync(execute: (op: PendingOperation) => Promise<SyncResult>): Promise<SyncReport | null> {
  const s = offlineStore();
  if (!s || (typeof navigator !== "undefined" && !navigator.onLine)) return Promise.resolve(null);
  if (running) return running;

  const task = async (): Promise<SyncReport | null> => {
    const report = await syncPending(s, execute);
    if (report.synced || report.rejected) notifyOfflineChange();
    return report;
  };

  // Les types DOM de Web Locks imbriquent la promesse du callback : on la remet à plat.
  const locked = (): Promise<SyncReport | null> =>
    navigator.locks.request("boutikdekk-sync", { ifAvailable: true }, (lock) =>
      lock ? task() : null,
    ) as unknown as Promise<SyncReport | null>;

  const current = (typeof navigator !== "undefined" && navigator.locks ? locked() : task()).finally(() => {
    running = null;
  });
  running = current;
  return current;
}

/** Déconnexion : efface les données locales. */
export async function clearOfflineData(): Promise<void> {
  await offlineStore()?.clearAll();
  notifyOfflineChange();
}
