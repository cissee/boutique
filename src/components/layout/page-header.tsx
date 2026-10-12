import type { ReactNode } from "react";
import { getMessages } from "@/i18n";

const t = getMessages();

export function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <header className="flex items-center justify-between gap-4 pb-4">
      <h1 className="text-2xl font-bold">{title}</h1>
      {action}
    </header>
  );
}

export function ComingSoon({ step }: { step: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface p-6 text-muted">
      <p>{t.common.comingSoon}</p>
      <p className="mt-1 text-sm">{step}</p>
    </div>
  );
}
