import { fr, type Messages } from "./messages/fr";

export const locales = ["fr"] as const; // "wo" à venir
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "fr";

const dictionaries: Record<Locale, Messages> = { fr };

/**
 * Retourne les textes de l'interface. Pour l'instant la langue est fixe ;
 * le choix de la langue (cookie ou profil) sera branché ici sans toucher aux écrans.
 */
export function getMessages(locale: Locale = defaultLocale): Messages {
  return dictionaries[locale];
}

export type { Messages };
