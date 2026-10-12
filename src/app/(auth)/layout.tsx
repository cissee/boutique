import Link from "next/link";
import { getMessages } from "@/i18n";

const t = getMessages();

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-5 py-10">
      <Link href="/" className="flex items-center gap-3 self-start">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" width={44} height={44} className="rounded-xl" />
        <span className="text-2xl font-bold text-brand">{t.app.name}</span>
      </Link>
      {children}
    </main>
  );
}
