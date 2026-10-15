import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/lib/supabase/database.types";

export type TeamMember = {
  userId: string;
  role: Enums<"shop_role">;
  name: string | null;
  phone: string | null;
  joinedAt: string;
};

/** Membres de la boutique (lisibles par tous les membres, via la RLS). */
export async function listTeam(shopId: string): Promise<TeamMember[]> {
  const supabase = await createClient();
  const { data: members, error } = await supabase
    .from("shop_members")
    .select("user_id, role, created_at")
    .eq("shop_id", shopId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, phone")
    .in(
      "id",
      members.map((m) => m.user_id),
    );
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

  return members.map((m) => ({
    userId: m.user_id,
    role: m.role,
    name: byId.get(m.user_id)?.full_name || null,
    phone: byId.get(m.user_id)?.phone ?? null,
    joinedAt: m.created_at,
  }));
}

export type PendingInvitation = { id: string; code: string; expiresAt: string };

/** Invitations en attente (propriétaire uniquement : la RLS renvoie une liste vide aux vendeurs). */
export async function listPendingInvitations(shopId: string): Promise<PendingInvitation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shop_invitations")
    .select("id, code, expires_at")
    .eq("shop_id", shopId)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map((i) => ({ id: i.id, code: i.code, expiresAt: i.expires_at }));
}
