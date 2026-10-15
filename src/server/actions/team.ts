"use server";

import { cookies } from "next/headers";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getMessages } from "@/i18n";
import { ACTIVE_SHOP_COOKIE, listMyShops, requireShop, requireUser } from "@/lib/auth/session";
import { dbErrorMessage } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/validation/form-state";
import { isUuid } from "@/server/queries/customers";

const t = getMessages();

const ONE_YEAR = 60 * 60 * 24 * 365;

async function setActiveShop(shopId: string) {
  (await cookies()).set(ACTIVE_SHOP_COOKIE, shopId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR,
  });
}

export type InvitationState = FormState & { code?: string };

/** Propriétaire : nouveau code d'invitation pour la boutique active. */
export async function createInvitation(_prev: InvitationState): Promise<InvitationState> {
  const { shop, role } = await requireShop();
  if (role !== "owner") return { error: t.errors.forbidden };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_shop_invitation", { p_shop_id: shop.id });
  if (error) return { error: dbErrorMessage(error) };

  refresh();
  return { code: data.code };
}

export async function revokeInvitation(formData: FormData): Promise<void> {
  const { shop, role } = await requireShop();
  const id = String(formData.get("id") ?? "");
  if (role !== "owner" || !isUuid(id)) return;

  const supabase = await createClient();
  await supabase
    .from("shop_invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("shop_id", shop.id);
  refresh();
}

/** Propriétaire : retirer un vendeur (la RLS n'autorise que le retrait d'un vendeur). */
export async function removeMember(_prev: FormState, formData: FormData): Promise<FormState> {
  const { shop, role, user } = await requireShop();
  const userId = String(formData.get("userId") ?? "");
  if (role !== "owner" || !isUuid(userId) || userId === user.id) return { error: t.errors.forbidden };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shop_members")
    .delete()
    .eq("shop_id", shop.id)
    .eq("user_id", userId)
    .eq("role", "seller")
    .select("id");
  if (error) return { error: dbErrorMessage(error) };
  if (!data.length) return { error: t.errors.forbidden };

  refresh();
  return {};
}

/** Vendeur : quitter la boutique active. */
export async function leaveShop(_prev: FormState): Promise<FormState> {
  const { shop, role, user } = await requireShop();
  if (role !== "seller") return { error: t.errors.lastOwner };

  const supabase = await createClient();
  const { error } = await supabase.from("shop_members").delete().eq("shop_id", shop.id).eq("user_id", user.id);
  if (error) return { error: dbErrorMessage(error) };

  (await cookies()).delete(ACTIVE_SHOP_COOKIE);
  redirect("/dashboard");
}

/** Rejoindre une boutique avec un code d'invitation. */
export async function acceptInvitation(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const code = String(formData.get("code") ?? "").trim();
  if (!code) return { fieldErrors: { code: [t.errors.required] }, values: { code } };

  const supabase = await createClient();
  const { data: shopId, error } = await supabase.rpc("accept_shop_invitation", { p_code: code });
  if (error) return { error: dbErrorMessage(error), values: { code } };

  await setActiveShop(shopId);
  redirect("/dashboard");
}

/** Changer de boutique active (uniquement vers une boutique dont on est membre). */
export async function switchShop(formData: FormData): Promise<void> {
  const shopId = String(formData.get("shopId") ?? "");
  const shops = await listMyShops();
  if (!shops.some((s) => s.shop.id === shopId)) return;
  await setActiveShop(shopId);
  redirect("/dashboard");
}
