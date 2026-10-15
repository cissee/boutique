import type { Metadata } from "next";
import { ProfileForm } from "@/components/forms/profile-form";
import { getMessages } from "@/i18n";
import { getProfile } from "@/lib/auth/session";
import { OnboardingStep } from "../step";

const t = getMessages();

export const metadata: Metadata = { title: t.onboarding.profileTitle };

// Données lues en base à chaque requête : voir le commentaire de (app)/layout.tsx.
export const instant = false;

export default async function OnboardingProfilePage() {
  const profile = await getProfile();
  return (
    <>
      <OnboardingStep step={1} title={t.onboarding.profileTitle} />
      <ProfileForm
        onboarding
        submitLabel={t.common.continue}
        defaults={{ fullName: profile?.full_name ?? "", phone: profile?.phone ?? null }}
      />
    </>
  );
}
