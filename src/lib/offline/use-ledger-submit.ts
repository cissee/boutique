"use client";

import { useOffline } from "next/offline";
import { startTransition, useState, type FormEvent } from "react";
import { getMessages } from "@/i18n";
import type { FormState } from "@/lib/validation/form-state";
import { enqueueOperation } from "./client";
import { browserOffline, offlineOperationFromForm } from "./form";
import type { PendingOperation } from "./types";

const t = getMessages();

type OfflineResult = { forState: FormState; requestId: string; message?: string; error?: string };

/**
 * Envoi des formulaires « dette » et « remboursement » :
 * - en ligne : Server Action (comme avant) ;
 * - hors ligne : l'opération est mise dans la file du téléphone avec la même clé
 *   d'idempotence, puis envoyée automatiquement au retour d'Internet.
 */
export function useLedgerSubmit(opts: {
  kind: PendingOperation["kind"];
  state: FormState;
  formAction: (formData: FormData) => void;
  initialRequestId: string;
  shopId: string;
  customers: { id: string; name: string; balance: number }[];
}) {
  const isOffline = useOffline();
  const [offline, setOffline] = useState<OfflineResult | null>(null);
  // Un résultat hors ligne n'est valable que tant que le serveur n'a pas renvoyé de nouvel état.
  const active = offline && offline.forState === opts.state ? offline : null;
  const requestId = active?.requestId ?? opts.state.requestId ?? opts.initialRequestId;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    if (!isOffline && !browserOffline()) {
      startTransition(() => opts.formAction(formData));
      return;
    }

    const result = offlineOperationFromForm(opts.kind, formData, { shopId: opts.shopId, customers: opts.customers });
    if ("error" in result) {
      setOffline({ forState: opts.state, requestId, error: result.error });
      return;
    }
    try {
      await enqueueOperation(result.op);
      // Nouvelle clé : le formulaire se vide pour la saisie suivante.
      setOffline({ forState: opts.state, requestId: crypto.randomUUID(), message: t.offline.saved });
    } catch {
      setOffline({ forState: opts.state, requestId, error: t.errors.generic });
    }
  }

  return { requestId, onSubmit, offlineMessage: active?.message, offlineError: active?.error };
}
