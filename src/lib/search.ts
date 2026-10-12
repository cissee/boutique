/**
 * Recherche instantanée côté client : insensible à la casse et aux accents
 * ("ndeye" trouve "Ndèye"), et par chiffres du téléphone ("771234" ou "77 123").
 */

export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Chiffres significatifs d'un numéro, sans l'indicatif sénégalais. */
function phoneDigits(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits.startsWith("221") && digits.length === 12 ? digits.slice(3) : digits;
}

export type Searchable = { name: string; phone: string | null };

/** Construit un filtre réutilisable pour une requête donnée. */
export function matcher(query: string): (item: Searchable) => boolean {
  const text = normalizeText(query);
  if (!text) return () => true;

  const words = text.split(" ");
  let digits = query.replace(/\D/g, "");
  const searchPhone = digits.length >= 3 && digits.length === query.replace(/[\s+.\-]/g, "").length;
  // Indicatif saisi ("+221 78…", "00221 78…") : on le retire pour comparer.
  if (/^\s*(\+|00)/.test(query)) digits = digits.replace(/^(00)?221/, "");

  return (item) => {
    if (searchPhone) {
      return item.phone !== null && phoneDigits(item.phone).includes(digits);
    }
    const name = normalizeText(item.name);
    return words.every((word) => name.includes(word));
  };
}
