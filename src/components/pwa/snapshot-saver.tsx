"use client";

import { useEffect } from "react";
import { notifyOfflineChange, offlineStore } from "@/lib/offline/client";
import type { SnapshotCustomer } from "@/lib/offline/types";

/** Enregistre sur le téléphone la dernière liste de clients chargée, pour la consulter hors ligne. */
export function SnapshotSaver({
  userId,
  shopId,
  shopName,
  customers,
}: {
  userId: string;
  shopId: string;
  shopName: string;
  customers: SnapshotCustomer[];
}) {
  useEffect(() => {
    offlineStore()
      ?.saveSnapshot({ userId, shopId, shopName, customers, savedAt: new Date().toISOString() })
      .then(notifyOfflineChange)
      .catch(() => undefined);
  }, [userId, shopId, shopName, customers]);
  return null;
}
