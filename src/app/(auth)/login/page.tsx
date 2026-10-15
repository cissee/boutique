import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getMessages } from "@/i18n";
import { LoginForm, SignupLink } from "./login-form";

const t = getMessages();

export const metadata: Metadata = { title: t.auth.loginTitle };

export default function LoginPage() {
  return (
    <>
      <h1 className="text-3xl font-bold">{t.auth.loginTitle}</h1>
      {/* Le formulaire lit l'URL (?next=, ?error=) : il est rendu à la requête. */}
      <Suspense>
        <LoginForm />
      </Suspense>
      <div className="flex flex-col gap-3 text-base">
        <Link href="/forgot-password" className="font-semibold text-brand underline-offset-4 hover:underline">
          {t.auth.forgotLink}
        </Link>
        <p>
          {t.auth.noAccount}{" "}
          <Suspense>
            <SignupLink />
          </Suspense>
        </p>
      </div>
    </>
  );
}
