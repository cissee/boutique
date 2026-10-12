import type { Metadata } from "next";
import Link from "next/link";
import { getMessages } from "@/i18n";
import { SignupForm } from "./signup-form";

const t = getMessages();

export const metadata: Metadata = { title: t.auth.signupTitle };

export default function SignupPage() {
  return (
    <>
      <h1 className="text-3xl font-bold">{t.auth.signupTitle}</h1>
      <SignupForm />
      <p className="text-base">
        {t.auth.hasAccount}{" "}
        <Link href="/login" className="font-semibold text-brand underline-offset-4 hover:underline">
          {t.auth.loginLink}
        </Link>
      </p>
    </>
  );
}
