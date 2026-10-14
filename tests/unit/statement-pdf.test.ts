import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { pdfSafe, renderStatementPdf, type StatementData } from "@/lib/pdf/statement";

const base: StatementData = {
  shop: { name: "Boutique Chez Modou", phone: "+221771234567", address: "Médina, Dakar" },
  customer: { name: "Ndèye Fatou Diop", phone: "+221781112233" },
  from: null,
  to: null,
  openingBalance: 0,
  transactions: [],
  generatedAt: new Date("2026-10-14T10:00:00Z"),
};

describe("pdfSafe", () => {
  it("garde les accents français et remplace l'inaffichable", () => {
    expect(pdfSafe("Ndèye Aïssatou – 12 500 € œ")).toBe("Ndèye Aïssatou – 12 500 € œ");
    expect(pdfSafe("Ŝ")).toBe("S");
    expect(pdfSafe("محمد 😀")).toBe("???? ?");
  });
});

describe("renderStatementPdf", () => {
  it("produit un PDF valide d'une page pour un client sans opération", async () => {
    const bytes = await renderStatementPdf(base);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getTitle()).toBe("Relevé - Ndèye Fatou Diop");
  });

  it("pagine les longs historiques et accepte des textes non latins", async () => {
    const transactions = Array.from({ length: 120 }, (_, i) => ({
      id: String(i),
      type: (i % 3 === 0 ? "REPAYMENT" : "DEBT") as "DEBT" | "REPAYMENT",
      amount: 1000,
      balanceEffect: i % 3 === 0 ? -1000 : 1000,
      description: i === 5 ? "Riz 😀 محمد — très longue description qui dépasse largement la colonne" : null,
      occurredAt: new Date(Date.UTC(2026, 0, 1 + i)).toISOString(),
      isReversed: false,
    }));
    const bytes = await renderStatementPdf({ ...base, openingBalance: 5000, transactions });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(2);
  });
});
