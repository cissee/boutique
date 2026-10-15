import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ProfileForm } from "@/components/forms/profile-form";
import { ShopForm } from "@/components/forms/shop-form";
import { PageHeader } from "@/components/layout/page-header";
import { TeamSection } from "@/components/team/team-section";
import { SubmitButton } from "@/components/ui/form";
import { getMessages } from "@/i18n";
import { getProfile, listMyShops, requireShop } from "@/lib/auth/session";
import { updateShop } from "@/server/actions/account";
import { signOut } from "@/server/actions/auth";
import { switchShop } from "@/server/actions/team";

const t = getMessages();

export const metadata: Metadata = { title: t.nav.settings };

export default async function SettingsPage() {
  const active = await requireShop();
  const { shop, role, user } = active;
  const [profile, myShops] = await Promise.all([getProfile(), listMyShops()]);
  const isOwner = role === "owner";

  return (
    <>
      <PageHeader title={t.nav.settings} />
      <div className="flex flex-col gap-6">
        {myShops.length > 1 && (
          <Section title={t.shops.switchTitle}>
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
              {myShops.map((s) => (
                <li key={s.shop.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-base font-semibold">{s.shop.name}</span>
                    <span className="text-sm text-muted">{t.settings.role[s.role]}</span>
                  </span>
                  {s.shop.id === shop.id ? (
                    <span className="text-sm font-semibold text-brand">{t.shops.current}</span>
                  ) : (
                    <form action={switchShop}>
                      <input type="hidden" name="shopId" value={s.shop.id} />
                      <button type="submit" className="min-h-10 rounded-lg border-2 border-brand px-3 text-sm font-semibold text-brand">
                        {t.shops.switch}
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section title={t.settings.profileSection}>
          <ProfileForm
            submitLabel={t.common.save}
            defaults={{ fullName: profile?.full_name ?? "", phone: profile?.phone ?? null }}
          />
        </Section>

        <Section title={t.settings.shopSection} badge={t.settings.role[role]}>
          {!isOwner && <p className="text-sm text-muted">{t.settings.shopOwnerOnly}</p>}
          <ShopForm key={shop.id} action={updateShop} defaults={shop} submitLabel={t.common.save} readOnly={!isOwner} />
        </Section>

        <Section title={t.team.title}>
          <TeamSection active={active} user={user} />
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
