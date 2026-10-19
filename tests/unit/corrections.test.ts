import { describe, expect, it } from "vitest";
import { canCorrect, SELF_CORRECTION_MINUTES } from "@/lib/ledger";

const now = Date.parse("2026-10-19T12:00:00Z");
const minutesAgo = (m: number) => new Date(now - m * 60_000).toISOString();
const tx = (o: Partial<{ type: string; created_by: string; created_at: string; isReversed: boolean }> = {}) => ({
  type: "DEBT",
  created_by: "vendeur",
  created_at: minutesAgo(5),
  isReversed: false,
  ...o,
});

describe("canCorrect (bouton « Modifier »)", () => {
  it("le propriétaire peut toujours corriger une dette ou un remboursement", () => {
    const owner = { currentUserId: "patron", isOwner: true };
    expect(canCorrect(tx({ created_at: minutesAgo(60 * 24 * 30) }), owner, now)).toBe(true);
    expect(canCorrect(tx({ type: "REPAYMENT" }), owner, now)).toBe(true);
  });

  it(`l'auteur peut corriger sa saisie pendant ${SELF_CORRECTION_MINUTES} minutes`, () => {
    const seller = { currentUserId: "vendeur", isOwner: false };
    expect(canCorrect(tx({ created_at: minutesAgo(SELF_CORRECTION_MINUTES - 1) }), seller, now)).toBe(true);
    expect(canCorrect(tx({ created_at: minutesAgo(SELF_CORRECTION_MINUTES + 1) }), seller, now)).toBe(false);
  });

  it("un vendeur ne corrige pas la saisie d'un autre", () => {
    expect(canCorrect(tx({ created_by: "autre" }), { currentUserId: "vendeur", isOwner: false }, now)).toBe(false);
  });

  it("jamais pour une annulation ni une opération déjà annulée ou corrigée", () => {
    const owner = { currentUserId: "patron", isOwner: true };
    expect(canCorrect(tx({ type: "REVERSAL" }), owner, now)).toBe(false);
    expect(canCorrect(tx({ isReversed: true }), owner, now)).toBe(false);
  });
});
