import { describe, expect, it } from "vitest";
import { balancesAfter, plainAmount, repaymentReceipt, smsLink, whatsappLink } from "@/lib/receipt";

describe("repaymentReceipt", () => {
  it("remboursement partiel : montant, date, mode et reste à payer", () => {
    const text = repaymentReceipt({
      shopName: "Boutique Chez Modou",
      amount: 5000,
      paymentMethod: "WAVE",
      occurredAt: "2026-10-18T10:00:00Z",
      remaining: 7500,
    });
    expect(text).toBe(
      "Boutique Chez Modou : remboursement de 5 000 FCFA reçu le 18/10/2026 (Wave). Reste à payer : 7 500 FCFA. Merci !",
    );
  });

  it("remboursement total : compte soldé, sans mode de paiement", () => {
    const text = repaymentReceipt({
      shopName: "Chez Awa",
      amount: 12500,
      paymentMethod: null,
      occurredAt: "2026-10-18T23:30:00Z",
      remaining: 0,
    });
    expect(text).toBe("Chez Awa : remboursement de 12 500 FCFA reçu le 18/10/2026. Votre compte est soldé. Merci !");
  });

  it("aucun espace insécable (SMS en un seul message)", () => {
    const text = repaymentReceipt({
      shopName: "X",
      amount: 1_250_000,
      paymentMethod: "ORANGE_MONEY",
      occurredAt: new Date(),
      remaining: 15000,
    });
    expect(text).not.toMatch(/[  ]/);
    expect(plainAmount(1_250_000)).toBe("1 250 000");
  });
});

describe("liens de partage", () => {
  const text = "Reçu : 5 000 FCFA & merci";

  it("WhatsApp avec le numéro du client, texte encodé", () => {
    expect(whatsappLink("+221771234567", text)).toBe(
      `https://wa.me/221771234567?text=${encodeURIComponent(text)}`,
    );
    expect(whatsappLink(null, "ok")).toBe("https://wa.me/?text=ok");
  });

  it("SMS avec le numéro du client", () => {
    expect(smsLink("+221771234567", "ok")).toBe("sms:+221771234567?body=ok");
    expect(smsLink(null, "ok")).toBe("sms:?body=ok");
  });
});

describe("balancesAfter", () => {
  it("retrouve le solde restant après chaque opération, du plus récent au plus ancien", () => {
    // Chronologie : dette 10 000 -> remb. 3 000 -> dette 2 000 -> remb. 4 000 (solde actuel 5 000)
    const history = [
      { id: "r2", balance_effect: -4000 },
      { id: "d2", balance_effect: 2000 },
      { id: "r1", balance_effect: -3000 },
      { id: "d1", balance_effect: 10000 },
    ];
    const after = balancesAfter(history, 5000);
    expect(Object.fromEntries(after)).toEqual({ r2: 5000, d2: 9000, r1: 7000, d1: 10000 });
  });
});
