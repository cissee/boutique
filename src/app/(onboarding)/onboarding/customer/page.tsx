import type { Metadata } from "next";
import Link from "next/link";
import { FirstCustomerForm } from "@/components/forms/first-customer-form";
import { getMessages } from "@/i18n";
import { requireShop } from "@/lib/auth/session";
import { OnboardingStep } from "../step";

const t = getMessages();

export const metadata: Metadata = { title: t.onboarding.customerTitle };

export default async function OnboardingCustomerPage() {
  await requireShop();
  return (
    <>
      <OnboardingStep step={3} title={t.onboarding.customerTitle} />
      <p className="text-base text-muted">{t.onboarding.customerIntro}</p>
      <FirstCustomerForm />
      <Link
        href="/dashboard"
        className="flex min-h-12 items-center justify-center text-base font-semibold text-muted underline-offset-4 hover:underline"
      >
        {t.common.later}
      </Link>
    </>
  );
}
