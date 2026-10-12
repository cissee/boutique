"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { getMessages } from "@/i18n";
import { getActiveShop, requireShop, requireUser } from "@/lib/auth/session";
import { dbErrorMessage } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { invalidForm, type FormState } from "@/lib/validation/form-state";
import { customerSchema, formFields, profileSchema, shopSchema } from "@/lib/validation/schemas";

const t = getMessages();

/** Profil : utilisé par l'onboarding (avec `next`) et par les paramètres (sans). */
export async function saveProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const raw = formFields(formData, ["fullName", "phone"]);
  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) return invalidForm(parsed.error, raw);

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.fullName, phone: parsed.data.phone })
    .eq("id", user.id);
  if (error) return { error: dbErrorMessage(error), values: raw };

  if (formData.get("onboarding") === "1") redirect("/onboarding/shop");
  refresh();
  return { success: t.common.saved, values: raw };
}

/** Onboarding : création de la boutique (l'utilisateur en devient propriétaire). */
export async function createShop(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  // Une seule boutique créée via l'onboarding : évite les doublons en cas de double envoi.
  if (await getActiveShop()) redirect("/onboarding/customer");

  const raw = formFields(formData, ["name", "phone", "address"]);
  const parsed = shopSchema.safeParse(raw);
  if (!parsed.success) return invalidForm(parsed.error, raw);

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_shop", {
    p_name: parsed.data.name,
    p_phone: parsed.data.phone,
    p_address: parsed.data.address,
  });
  if (error) return { error: dbErrorMessage(error), values: raw };

  redirect("/onboarding/customer");
}

/** Paramètres : modification de la boutique (la RLS n'autorise que le propriétaire). */
export async function updateShop(_prev: FormState, formData: FormData): Promise<FormState> {
  const { shop, role } = await requireShop();
  if (role !== "owner") return { error: t.errors.forbidden };

  const raw = formFields(formData, ["name", "phone", "address"]);
  const parsed = shopSchema.safeParse(raw);
  if (!parsed.success) return invalidForm(parsed.error, raw);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shops")
    .update({ name: parsed.data.name, phone: parsed.data.phone, address: parsed.data.address })
    .eq("id", shop.id)
    .select("id");
  if (error) return { error: dbErrorMessage(error), values: raw };
  if (!data?.length) return { error: t.errors.forbidden, values: raw };

  refresh();
  return { success: t.common.saved, values: raw };
}

/** Onboarding : premier client, rattaché à la boutique déduite côté serveur. */
export async function createFirstCustomer(_prev: FormState, formData: FormData): Promise<FormState> {
  const { shop } = await requireShop();
  const raw = formFields(formData, ["name", "phone"]);
  const parsed = customerSchema.safeParse({ ...raw, notes: "" });
  if (!parsed.success) return invalidForm(parsed.error, raw);

  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .insert({ shop_id: shop.id, name: parsed.data.name, phone: parsed.data.phone });
  if (error) return { error: dbErrorMessage(error), values: raw };

  redirect("/dashboard");
}
