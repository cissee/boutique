"use client";

import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useOffline } from "next/offline";
import { getMessages } from "@/i18n";

const t = getMessages();

type TextFieldProps = {
  label: string;
  name: string;
  hint?: string;
  optional?: boolean;
  errors?: string[];
} & Omit<InputHTMLAttributes<HTMLInputElement>, "name">;

/** Champ texte grand format, lisible et facile à toucher. */
export function TextField({ label, name, hint, optional, errors, ...input }: TextFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const hasError = Boolean(errors?.length);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-base font-semibold">
        {label}
        {optional && <span className="font-normal text-muted"> ({t.common.optional})</span>}
      </label>
      <input
        id={id}
        name={name}
        aria-invalid={hasError || undefined}
        aria-describedby={[hint && hintId, hasError && errorId].filter(Boolean).join(" ") || undefined}
        className={`min-h-12 rounded-xl border-2 bg-surface px-4 text-lg outline-none focus:border-brand ${
          hasError ? "border-debt" : "border-border"
        }`}
        {...input}
      />
      {hint && !hasError && (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {hasError && (
        <p id={errorId} className="text-sm font-medium text-debt">
          {errors![0]}
        </p>
      )}
    </div>
  );
}

type TextAreaFieldProps = {
  label: string;
  name: string;
  hint?: string;
  optional?: boolean;
  errors?: string[];
  defaultValue?: string;
  maxLength?: number;
};

export function TextAreaField({ label, name, hint, optional, errors, defaultValue, maxLength }: TextAreaFieldProps) {
  const id = useId();
  const hasError = Boolean(errors?.length);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-base font-semibold">
        {label}
        {optional && <span className="font-normal text-muted"> ({t.common.optional})</span>}
      </label>
      <textarea
        id={id}
        name={name}
        rows={3}
        maxLength={maxLength}
        defaultValue={defaultValue}
        aria-invalid={hasError || undefined}
        aria-describedby={hasError ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={`rounded-xl border-2 bg-surface px-4 py-3 text-lg outline-none focus:border-brand ${
          hasError ? "border-debt" : "border-border"
        }`}
      />
      {hint && !hasError && (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {hasError && (
        <p id={`${id}-error`} className="text-sm font-medium text-debt">
          {errors![0]}
        </p>
      )}
    </div>
  );
}

/** Bouton d'envoi : désactivé pendant l'envoi pour éviter les doubles clics. */
export function SubmitButton({
  children,
  variant = "primary",
  pending: pendingOverride,
  disabled,
}: {
  children: ReactNode;
  variant?: "primary" | "danger";
  /** À fournir quand le formulaire est envoyé manuellement (useActionState + startTransition). */
  pending?: boolean;
  disabled?: boolean;
}) {
  const status = useFormStatus();
  const pending = pendingOverride ?? status.pending;
  const isOffline = useOffline();
  const colors =
    variant === "danger"
      ? "border-2 border-debt bg-surface text-debt"
      : "bg-brand text-white active:bg-brand-strong";
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      aria-disabled={pending || disabled}
      className={`flex min-h-14 w-full items-center justify-center rounded-xl px-6 text-lg font-semibold disabled:opacity-60 ${colors}`}
    >
      {pending ? (isOffline ? t.offline.waiting : t.common.loading) : children}
    </button>
  );
}

export function FormAlert({ error, success }: { error?: string; success?: string }) {
  if (!error && !success) return null;
  return (
    <p
      role={error ? "alert" : "status"}
      className={`rounded-xl px-4 py-3 text-base font-medium ${
        error ? "bg-debt-soft text-debt" : "bg-repayment-soft text-repayment"
      }`}
    >
      {error ?? success}
    </p>
  );
}
