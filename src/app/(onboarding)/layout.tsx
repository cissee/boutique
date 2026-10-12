import { getMessages } from "@/i18n";

const t = getMessages();

export default function OnboardingLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-5 py-10">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" width={40} height={40} className="rounded-xl" />
        <span className="text-xl font-bold text-brand">{t.app.name}</span>
      </div>
      {children}
    </main>
  );
}
