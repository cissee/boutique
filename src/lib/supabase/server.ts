import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabasePublishableKey, supabaseUrl } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Client Supabase côté serveur (Server Components, Server Actions, Route Handlers),
 * authentifié avec la session de l'utilisateur : toutes les requêtes passent par la RLS.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Appelé depuis un Server Component : écriture impossible, le proxy rafraîchit la session.
        }
      },
    },
  });
}
