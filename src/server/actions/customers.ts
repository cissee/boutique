"use server";

import { redirect } from "next/navigation";
import { getMessages } from "@/i18n";
import { requireShop } from "@/lib/auth/session";
import { dbErrorMessage } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { invalidForm, type FormState } from "@/lib/validation/form-state";
import { customerSchema, formFields } from "@/lib/validation/schemas";
import { isUuid } from "@/server/queries/customers";

const t = getMessages();
const FIELDS = ["name", "phone", "notes"] as const;

export async function createCustomer(_prev: FormState, formData: FormData): Promise<FormState> {
  const { shop } = await requireShop();
  const raw = formFields(formData, FIELDS);
  const parsed = customerSchema.safeParse(raw);
  if (!parsed.success) return invalidForm(parsed.error, raw);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .insert({ shop_id: shop.id, ...parsed.data })
    .select("id")
    .single();
  if (error) return { error: dbErrorMessage(error), values: raw };

  redirect(`/customers/${data.id}`);
}

export async function updateCustomer(_prev: FormState, formData: FormData): Promise<FormState> {
  const { shop } = await requireShop();
  const id = String(formData.get("id") ?? "");
  const raw = formFields(formData, FIELDS);
  if (!isUuid(id)) return { error: t.errors.customerNotFound, values: raw };

  const parsed = customerSchema.safeParse(raw);
  if (!parsed.success) return invalidForm(parsed.error, raw);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .update(parsed.data)
    .eq("id", id)
    .eq("shop_id", shop.id)
    .select("id");
  if (error) return { error: dbErrorMessage(error), values: raw };
  if (!data.length) return { error: t.errors.customerNotFound, values: raw };

  redirect(`/customers/${id}`);
}

/** Archivage : propriétaire uniquement, solde nul (vérifié aussi par un trigger en base). */
export async function archiveCustomer(_prev: FormState, formData: FormData): Promise<FormState> {
  const { shop, role } = await requireShop();
  if (role !== "owner") return { error: t.errors.forbidden };
  const id = String(formData.get("id") ?? "");
  if (!isUuid(id)) return { error: t.errors.customerNotFound };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .eq("shop_id", shop.id)
    .select("id");
  if (error) return { error: dbErrorMessage(error) };
  if (!data.length) return { error: t.errors.customerNotFound };

  redirect("/customers");
}
