import Link from "next/link";
import { getMessages } from "@/i18n";

const t = getMessages();

export default function LandingPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-6 py-12">
      <div className="flex flex-col gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" width={72} height={72} className="rounded-2xl" />
        <h1 className="text-4xl font-bold text-brand">{t.app.name}</h1>
        <p className="text-lg text-muted">{t.app.tagline}</p>
      </div>

      <ul className="flex flex-col gap-3 text-base">
        {t.landing.points.map((point) => (
          <li key={point} className="flex items-start gap-3">
            <span aria-hidden="true" className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-brand" />
            {point}
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-3">
        <Link
          href="/signup"
          className="flex min-h-14 items-center justify-center rounded-xl bg-brand px-6 text-lg font-semibold text-white active:bg-brand-strong"
        >
          {t.landing.signup}
        </Link>
        <Link
          href="/login"
          className="flex min-h-14 items-center justify-center rounded-xl border-2 border-brand px-6 text-lg font-semibold text-brand"
        >
          {t.landing.login}
        </Link>
      </div>
    </main>
  );
}
