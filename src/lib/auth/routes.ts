/** Pages accessibles sans être connecté. */
export const PUBLIC_PATHS = ["/", "/login", "/signup", "/forgot-password"];

/** Pages réservées aux visiteurs non connectés (redirigés vers l'application sinon). */
export const GUEST_ONLY_PATHS = ["/", "/login", "/signup"];

export const AFTER_LOGIN_PATH = "/dashboard";

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.includes(pathname) || pathname.startsWith("/auth/");
}

/**
 * N'accepte que les chemins internes ("/clients"), jamais une URL externe
 * ("//site.com", "https://…") : évite les redirections ouvertes.
 */
export function safeNextPath(value: unknown, fallback = AFTER_LOGIN_PATH): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f]/.test(value)) return fallback;
  return value;
}
