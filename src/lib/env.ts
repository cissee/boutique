/**
 * Variables d'environnement publiques. Elles doivent être référencées littéralement
 * (process.env.NEXT_PUBLIC_…) pour être injectées dans le code du navigateur.
 * Aucune clé secrète n'est utilisée par l'application.
 */
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Variable d'environnement manquante : ${name} (voir .env.example)`);
  }
  return value;
}

export const supabaseUrl = required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);

export const supabasePublishableKey = required(
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

/**
 * URL publique du site, utilisée dans les liens envoyés par email.
 * Sur les déploiements de prévisualisation Vercel, laisser NEXT_PUBLIC_SITE_URL vide :
 * l'URL du déploiement (VERCEL_URL) est alors utilisée.
 */
export function siteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
