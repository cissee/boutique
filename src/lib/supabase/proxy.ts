import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabasePublishableKey, supabaseUrl } from "@/lib/env";
import { AFTER_LOGIN_PATH, GUEST_ONLY_PATHS, isPublicPath } from "@/lib/auth/routes";
import type { Database } from "./database.types";

/**
 * Rafraîchit la session Supabase à chaque requête et applique les redirections de base.
 * Ce n'est qu'un premier filtre : chaque page et chaque action revérifient l'utilisateur,
 * et la RLS reste la protection finale des données.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  // getClaims() valide le JWT (signature) : ne pas le remplacer par getSession().
  const { data } = await supabase.auth.getClaims();
  const isLoggedIn = Boolean(data?.claims?.sub);
  const { pathname, search } = request.nextUrl;

  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = "";
    if (path === "/login" && pathname !== "/") url.searchParams.set("next", pathname + search);
    const redirect = NextResponse.redirect(url);
    // Conserver les cookies de session rafraîchis.
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  };

  if (!isLoggedIn && !isPublicPath(pathname)) return redirectTo("/login");
  if (isLoggedIn && GUEST_ONLY_PATHS.includes(pathname)) return redirectTo(AFTER_LOGIN_PATH);

  return response;
}
