/**
 * Génération CSV compatible Excel en français : séparateur « ; », BOM UTF-8, fins de ligne CRLF.
 * Les textes commençant par = + - @ sont neutralisés (injection de formules : un nom de
 * client comme "=HYPERLINK(...)" ne doit pas s'exécuter à l'ouverture dans Excel).
 */

export type CsvValue = string | number | null | undefined;

export type CsvColumn<T> = { header: string; value: (row: T) => CsvValue };

const SEPARATOR = ";";

function escapeCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  let text = value;
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[";\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const lines = [
    columns.map((c) => escapeCell(c.header)).join(SEPARATOR),
    ...rows.map((row) => columns.map((c) => escapeCell(c.value(row))).join(SEPARATOR)),
  ];
  return `﻿${lines.join("\r\n")}\r\n`;
}

export function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
