import { z } from "zod";
import { getMessages } from "@/i18n";
import { parseAmount } from "@/lib/format/currency";
import { todayISODate } from "@/lib/format/date";
import { normalizePhone } from "@/lib/format/phone";
import { PAYMENT_METHODS } from "@/lib/ledger";

const t = getMessages();

const requiredText = (max: number) =>
  z
    .string({ error: t.errors.required })
    .trim()
    .min(1, { error: t.errors.required })
    .max(max, { error: t.errors.tooLong });

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: t.errors.tooLong })
    .transform((v) => (v === "" ? null : v));

/** Téléphone facultatif, normalisé en E.164 (+221…). */
const optionalPhone = z
  .string()
  .trim()
  .refine((v) => v === "" || normalizePhone(v) !== null, { error: t.errors.invalidPhone })
  .transform((v) => (v === "" ? null : normalizePhone(v)));

const email = z.string().trim().toLowerCase().pipe(z.email({ error: t.errors.invalidEmail }));

const password = z.string().min(8, { error: t.errors.passwordTooShort }).max(72, { error: t.errors.tooLong });

export const loginSchema = z.object({
  email,
  password: z.string().min(1, { error: t.errors.required }),
});

export const signupSchema = z
  .object({
    fullName: requiredText(100),
    email,
    password,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    error: t.errors.passwordMismatch,
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({ password, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    error: t.errors.passwordMismatch,
    path: ["confirmPassword"],
  });

export const profileSchema = z.object({
  fullName: requiredText(100),
  phone: optionalPhone,
});

export const shopSchema = z.object({
  name: requiredText(100),
  phone: optionalPhone,
  address: optionalText(200),
});

export const customerSchema = z.object({
  name: requiredText(100),
  phone: optionalPhone,
  notes: optionalText(1000),
});

// --- Registre ------------------------------------------------------------------

const uuid = z.uuid({ error: t.errors.generic });

const amount = z
  .string()
  .transform((v) => parseAmount(v))
  .refine((v): v is number => v !== null, { error: t.errors.invalidAmount });

/**
 * Date d'opération "YYYY-MM-DD" (heure de Dakar = UTC) -> horodatage ISO.
 * Aujourd'hui : l'heure actuelle ; un jour passé (reprise du cahier) : midi.
 */
const occurredAt = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: t.errors.invalidDate })
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && v <= todayISODate(), {
    error: t.errors.invalidDate,
  })
  .transform((v) => (v === todayISODate() ? new Date().toISOString() : `${v}T12:00:00.000Z`));

export const debtSchema = z.object({
  customerId: uuid,
  amount,
  description: optionalText(500),
  date: occurredAt,
  requestId: uuid,
});

export const repaymentSchema = z.object({
  customerId: uuid,
  amount,
  paymentMethod: z
    .string()
    .transform((v) => (v === "" ? null : v))
    .refine((v) => v === null || (PAYMENT_METHODS as readonly string[]).includes(v), {
      error: t.errors.invalidPaymentMethod,
    }),
  comment: optionalText(500),
  date: occurredAt,
  requestId: uuid,
});

export const reversalSchema = z.object({
  transactionId: uuid,
  reason: requiredText(500),
  requestId: uuid,
});

/** Lit les champs texte d'un FormData (les valeurs absentes deviennent ""). */
export function formFields<K extends string>(formData: FormData, keys: readonly K[]): Record<K, string> {
  const out = {} as Record<K, string>;
  for (const key of keys) {
    const value = formData.get(key);
    out[key] = typeof value === "string" ? value : "";
  }
  return out;
}
