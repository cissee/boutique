import { todayISODate } from "@/lib/format/date";

/** Dates "YYYY-MM-DD" (heure de Dakar = UTC). */
export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isoDate(value: unknown): string | undefined {
  return typeof value === "string" && ISO_DATE.test(value) && !Number.isNaN(Date.parse(value)) ? value : undefined;
}

export function daysAgo(days: number, now: Date = new Date()): string {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - days);
  return todayISODate(d);
}

export function startOfMonth(now: Date = new Date()): string {
  return `${todayISODate(now).slice(0, 7)}-01`;
}

export type PeriodKey = "today" | "last7" | "month" | "last30";

/** Périodes prédéfinies, bornes incluses. */
export function periodPresets(now: Date = new Date()): Record<PeriodKey, { from: string; to: string }> {
  const today = todayISODate(now);
  return {
    today: { from: today, to: today },
    last7: { from: daysAgo(6, now), to: today },
    month: { from: startOfMonth(now), to: today },
    last30: { from: daysAgo(29, now), to: today },
  };
}
