import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Enums, Tables } from "@/lib/supabase/database.types";

/**
 * Couche d'accès aux données (DAL) : point unique pour connaître l'utilisateur
 * et sa boutique. `cache` évite de refaire les requêtes dans une même page.
 */

export type CurrentUser = { id: string; email: string | null };

export type ActiveShop = {
  shop: Pick<Tables<"shops">, "id" | "name" | "phone" | "address" | "currency">;
  role: Enums<"shop_role">;
};

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export const getProfile = cache(async () => {
  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, full_name, phone").eq("id", user.id).maybeSingle();
  return data;
});

/**
 * Boutique active de l'utilisateur, déduite de ses appartenances en base (RLS).
 * Pour l'instant : la plus ancienne. Un sélecteur de boutique viendra plus tard.
 */
export const getActiveShop = cache(async (): Promise<ActiveShop | null> => {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shop_members")
    .select("role, shop:shops!inner(id, name, phone, address, currency, archived_at)")
    .eq("user_id", user.id)
    .is("shop.archived_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  const { archived_at: _archived, ...shop } = data.shop;
  return { role: data.role, shop };
});

/** Pour toutes les pages de l'application : exige un utilisateur ET une boutique. */
export async function requireShop(): Promise<ActiveShop & { user: CurrentUser }> {
  const user = await requireUser();
  const active = await getActiveShop();
  if (!active) redirect("/onboarding/profile");
  return { ...active, user };
}
