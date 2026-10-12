/** Le Sénégal est en GMT toute l'année (pas d'heure d'été). */
export const APP_TIME_ZONE = "Africa/Dakar";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  timeZone: APP_TIME_ZONE,
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("fr-FR", {
  timeZone: APP_TIME_ZONE,
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(value: string | Date): string {
  return dateFormatter.format(new Date(value));
}

export function formatDateTime(value: string | Date): string {
  return dateTimeFormatter.format(new Date(value));
}

/** Date du jour au format "YYYY-MM-DD" (valeur par défaut des champs date). */
export function todayISODate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE }).format(now);
}
