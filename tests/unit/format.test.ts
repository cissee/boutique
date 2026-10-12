import { describe, expect, it } from "vitest";
import { formatAmountInput, formatFCFA, MAX_AMOUNT, parseAmount } from "@/lib/format/currency";
import { formatPhone, normalizePhone } from "@/lib/format/phone";
import { todayISODate } from "@/lib/format/date";

/** Remplace les espaces insécables par des espaces simples pour comparer. */
const plain = (s: string) => s.replace(/[  ]/g, " ");

describe("formatFCFA", () => {
  it("formate un entier avec séparateur de milliers", () => {
    expect(plain(formatFCFA(12500))).toBe("12 500 FCFA");
    expect(plain(formatFCFA(0))).toBe("0 FCFA");
    expect(plain(formatFCFA("1500000"))).toBe("1 500 000 FCFA");
  });

  it("ne plante pas sur une valeur invalide", () => {
    expect(formatFCFA("abc")).toBe("— FCFA");
  });
});

describe("formatAmountInput", () => {
  it("garde uniquement les chiffres", () => {
    expect(plain(formatAmountInput("12a500"))).toBe("12 500");
    expect(formatAmountInput("")).toBe("");
    expect(formatAmountInput("000")).toBe("0");
  });
});

describe("parseAmount", () => {
  it.each([
    ["12500", 12500],
    ["12 500", 12500],
    ["12 500", 12500],
    ["12.500", 12500],
    ["12 500 FCFA", 12500],
    ["500f", 500],
  ])("accepte %j", (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });

  it.each(["", "0", "-500", "12,5", "12.5", "abc", "1e5", String(MAX_AMOUNT + 1)])(
    "refuse %j",
    (input) => {
      expect(parseAmount(input)).toBeNull();
    },
  );
});

describe("normalizePhone", () => {
  it.each([
    ["77 123 45 67", "+221771234567"],
    ["771234567", "+221771234567"],
    ["+221 77 123 45 67", "+221771234567"],
    ["00221771234567", "+221771234567"],
    ["33 820 00 00", "+221338200000"],
    ["+33 6 12 34 56 78", "+33612345678"],
  ])("normalise %j", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each(["", "12345", "79 123 45 67", "+221 12 345 67 89", "abc"])("refuse %j", (input) => {
    expect(normalizePhone(input)).toBeNull();
  });

  it("affiche un numéro sénégalais lisiblement", () => {
    expect(formatPhone("+221771234567")).toBe("77 123 45 67");
    expect(formatPhone("+33612345678")).toBe("+33612345678");
  });
});

describe("todayISODate", () => {
  it("utilise le fuseau de Dakar", () => {
    expect(todayISODate(new Date("2026-10-12T23:30:00Z"))).toBe("2026-10-12");
  });
});
