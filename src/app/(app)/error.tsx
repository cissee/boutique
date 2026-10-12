"use client";

import Link from "next/link";
import { useEffect } from "react";
import { getMessages } from "@/i18n";

const t = getMessages();

/** Erreur inattendue dans une page de l'application : message simple, sans détail technique. */
export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6" role="alert">
      <h1 className="text-xl font-bold">{t.errors.pageTitle}</h1>
      <p className="text-base text-muted">{t.errors.pageText}</p>
      <button
        type="button"
        onClick={() => retry()}
        className="flex min-h-14 items-center justify-center rounded-xl bg-brand px-6 text-lg font-semibold text-white"
      >
        {t.errors.retry}
      </button>
      <Link href="/dashboard" className="text-center font-semibold text-brand underline-offset-4 hover:underline">
        {t.errors.backHome}
      </Link>
    </div>
  );
}
