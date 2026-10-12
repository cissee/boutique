import { getMessages } from "@/i18n";

const t = getMessages();

/** Titre d'étape avec barre de progression (3 étapes). */
export function OnboardingStep({ step, title }: { step: 1 | 2 | 3; title: string }) {
  return (
    <header className="flex flex-col gap-3">
      <div className="flex gap-2" aria-hidden="true">
        {[1, 2, 3].map((n) => (
          <span key={n} className={`h-1.5 flex-1 rounded-full ${n <= step ? "bg-brand" : "bg-border"}`} />
        ))}
      </div>
      <p className="text-sm font-medium text-muted">{t.onboarding.stepOf.replace("{step}", String(step))}</p>
      <h1 className="text-2xl font-bold">{title}</h1>
    </header>
  );
}
