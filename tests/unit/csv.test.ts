import { describe, expect, it } from "vitest";
import { toCsv } from "@/lib/csv";

type Row = { name: string; amount: number; note: string | null };
const columns = [
  { header: "Nom", value: (r: Row) => r.name },
  { header: "Montant", value: (r: Row) => r.amount },
  { header: "Note", value: (r: Row) => r.note },
];

describe("toCsv", () => {
  it("BOM, séparateur ; et CRLF", () => {
    const csv = toCsv([{ name: "Awa", amount: 1500, note: null }], columns);
    expect(csv).toBe("﻿Nom;Montant;Note\r\nAwa;1500;\r\n");
  });

  it("protège les guillemets, points-virgules et retours à la ligne", () => {
    const csv = toCsv([{ name: 'Fatou "Mère"', amount: -200, note: "riz; huile\nsucre" }], columns);
    expect(csv.split("\r\n")[1]).toBe('"Fatou ""Mère""";-200;"riz; huile\nsucre"');
  });

  it("neutralise les formules dans les textes (injection CSV)", () => {
    const csv = toCsv([{ name: "=HYPERLINK(\"x\")", amount: 1, note: "+221 77" }], columns);
    const line = csv.split("\r\n")[1];
    expect(line.startsWith("\"'=HYPERLINK")).toBe(true);
    expect(line.endsWith(";'+221 77")).toBe(true);
  });
});
