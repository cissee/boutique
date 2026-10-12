/**
 * Numéros de téléphone. Format de stockage : E.164 (ex. "+221771234567").
 * Les numéros sénégalais (9 chiffres, mobiles 7x, fixes 33) sont acceptés
 * sans indicatif ; les numéros étrangers doivent commencer par "+" ou "00".
 */

const SN_LOCAL = /^(7[05678]\d{7}|3[03]\d{7})$/;

export function normalizePhone(raw: string): string | null {
  const compact = raw.replace(/[\s  .\-()]/g, "");
  if (!compact) return null;

  let international = compact;
  if (international.startsWith("00")) international = `+${international.slice(2)}`;

  if (international.startsWith("+")) {
    const digits = international.slice(1);
    if (!/^\d{8,15}$/.test(digits)) return null;
    if (digits.startsWith("221")) {
      return SN_LOCAL.test(digits.slice(3)) ? `+${digits}` : null;
    }
    return `+${digits}`;
  }

  return SN_LOCAL.test(international) ? `+221${international}` : null;
}

/** "+221771234567" -> "77 123 45 67" ; numéros étrangers affichés tels quels. */
export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  const match = /^\+221(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(e164);
  return match ? match.slice(1).join(" ") : e164;
}
