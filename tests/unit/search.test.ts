import { describe, expect, it } from "vitest";
import { matcher, normalizeText } from "@/lib/search";

const customers = [
  { name: "Ndèye Fatou Diop", phone: "+221771234567" },
  { name: "Mamadou Sall", phone: "+221781112233" },
  { name: "Aïssatou Ba", phone: null },
];

const search = (q: string) => customers.filter(matcher(q)).map((c) => c.name);

describe("normalizeText", () => {
  it("retire accents, majuscules et espaces superflus", () => {
    expect(normalizeText("  Ndèye   FATOU ")).toBe("ndeye fatou");
    expect(normalizeText("Aïssatou")).toBe("aissatou");
  });
});

describe("matcher", () => {
  it("requête vide : tout le monde", () => {
    expect(search("")).toHaveLength(3);
  });

  it("trouve sans tenir compte des accents ni de la casse", () => {
    expect(search("ndeye")).toEqual(["Ndèye Fatou Diop"]);
    expect(search("AISSA")).toEqual(["Aïssatou Ba"]);
  });

  it("tous les mots doivent correspondre, dans n'importe quel ordre", () => {
    expect(search("diop fatou")).toEqual(["Ndèye Fatou Diop"]);
    expect(search("fatou sall")).toEqual([]);
  });

  it("recherche par téléphone, avec ou sans espaces ni indicatif", () => {
    expect(search("77 123")).toEqual(["Ndèye Fatou Diop"]);
    expect(search("781112233")).toEqual(["Mamadou Sall"]);
    expect(search("+221 78 111")).toEqual(["Mamadou Sall"]);
  });
});
