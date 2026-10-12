import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShopForm } from "@/components/forms/shop-form";
import { getMessages } from "@/i18n";
import { getActiveShop } from "@/lib/auth/session";
import { createShop } from "@/server/actions/account";
import { OnboardingStep } from "../step";

const t = getMessages();

export const metadata: Metadata = { title: t.onboarding.shopTitle };

export default async function OnboardingShopPage() {
  if (await getActiveShop()) redirect("/onboarding/customer");
  return (
    <>
      <OnboardingStep step={2} title={t.onboarding.shopTitle} />
      <ShopForm action={createShop} submitLabel={t.onboarding.shopSubmit} />
    </>
  );
}
