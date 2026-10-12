"use server";

import { redirect } from "next/navigation";
import { getMessages } from "@/i18n";
import { safeNextPath } from "@/lib/auth/routes";
import { siteUrl } from "@/lib/env";
import { authErrorMessage } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { invalidForm, type FormState } from "@/lib/validation/form-state";
import {
  forgotPasswordSchema,
  formFields,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
} from "@/lib/validation/schemas";

const t = getMessages();

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = formFields(formData, ["email", "password", "next"]);
  const parsed = loginSchema.safeParse(raw);
  const values = { email: raw.email };
  if (!parsed.success) return invalidForm(parsed.error, values);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: authErrorMessage(error), values };

  redirect(safeNextPath(raw.next));
}

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = formFields(formData, ["fullName", "email", "password", "confirmPassword"]);
  const parsed = signupSchema.safeParse(raw);
  const values = { fullName: raw.fullName, email: raw.email };
  if (!parsed.success) return invalidForm(parsed.error, values);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${siteUrl()}/auth/callback?next=/onboarding/profile`,
    },
  });
  if (error) return { error: authErrorMessage(error), values };

  // Confirmation d'email désactivée : la session existe déjà.
  if (data.session) redirect("/onboarding/profile");

  // Même message que l'adresse soit nouvelle ou déjà utilisée (pas d'énumération des comptes).
  return { success: t.auth.checkEmail };
}

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = formFields(formData, ["email"]);
  const parsed = forgotPasswordSchema.safeParse(raw);
  if (!parsed.success) return invalidForm(parsed.error, raw);

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteUrl()}/auth/callback?next=/reset-password`,
  });
  // Seule la limitation de débit est signalée ; sinon même réponse que le compte existe ou non.
  if (error?.code === "over_email_send_rate_limit" || error?.code === "over_request_rate_limit") {
    return { error: authErrorMessage(error), values: raw };
  }
  return { success: t.auth.forgotSent };
}

export async function updatePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = formFields(formData, ["password", "confirmPassword"]);
  const parsed = resetPasswordSchema.safeParse(raw);
  if (!parsed.success) return invalidForm(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: authErrorMessage(error) };

  redirect("/dashboard");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
