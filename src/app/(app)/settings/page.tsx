import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ProfileForm } from "@/components/forms/profile-form";
import { ShopForm } from "@/components/forms/shop-form";
import { PageHeader } from "@/components/layout/page-header";
import { SubmitButton } from "@/components/ui/form";
import { getMessages } from "@/i18n";
import { getProfile, requireShop } from "@/lib/auth/session";
import { updateShop } from "@/server/actions/account";
import { signOut } from "@/server/actions/auth";

const t = getMessages();

export const metadata: Metadata = { title: t.nav.settings };

export default async function SettingsPage() {
  const { shop, role, user } = await requireShop();
  const profile = await getProfile();
  const isOwner = role === "owner";

  return (
    <>
      <PageHeader title={t.nav.settings} />
      <div className="flex flex-col gap-6">
        <Section title={t.settings.profileSection}>
          <ProfileForm
            submitLabel={t.common.save}
            defaults={{ fullName: profile?.full_name ?? "", phone: profile?.phone ?? null }}
          />
        </Section>

        <Section title={t.settings.shopSection} badge={t.settings.role[role]}>
          {!isOwner && <p className="text-sm text-muted">{t.settings.shopOwnerOnly}</p>}
          <ShopForm action={updateShop} defaults={shop} submitLabel={t.common.save} readOnly={!isOwner} />
        </Section>

        <Section title={t.settings.accountSection}>
          {user.email && <p className="text-base text-muted">{user.email}</p>}
          <Link
            href="/reset-password"
            className="flex min-h-12 items-center justify-center rounded-xl border-2 border-border px-6 text-base font-semibold"
          >
            {t.auth.resetTitle}
          </Link>
          <form action={signOut}>
            <SubmitButton variant="danger">{t.auth.logout}</SubmitButton>
          </form>
        </Section>
      </div>
    </>
  );
}

function Section({ title, badge, children }: { title: string; badge?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold">{title}</h2>
        {badge && (
          <span className="rounded-full bg-brand-soft px-3 py-1 text-sm font-semibold text-brand-strong">{badge}</span>
        )}
      </div>
      {children}
    </section>
  );
}
