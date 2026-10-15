import type { Metadata } from "next";
import { JoinForm } from "@/components/team/join-form";
import { getMessages } from "@/i18n";
import { requireUser } from "@/lib/auth/session";

const t = getMessages();

export const metadata: Metadata = { title: t.join.title };

// Données lues en base à chaque requête : voir le commentaire de (app)/layout.tsx.
export const instant = false;

/** Lien d'invitation : /join?code=XXXXXXXX (connexion exigée par le proxy). */
export default async function JoinPage({ searchParams }: PageProps<"/join">) {
  await requireUser();
  const { code } = await searchParams;

  return (
    <>
      <h1 className="text-2xl font-bold">{t.join.title}</h1>
      <p className="text-base text-muted">{t.join.intro}</p>
      <JoinForm initialCode={typeof code === "string" ? code.slice(0, 12) : ""} />
    </>
  );
}
