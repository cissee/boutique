import { createBrowserClient } from "@supabase/ssr";
import { supabasePublishableKey, supabaseUrl } from "@/lib/env";
import type { Database } from "./database.types";

/** Client Supabase côté navigateur (clé publique uniquement ; la RLS protège les données). */
export function createClient() {
  return createBrowserClient<Database>(supabaseUrl, supabasePublishableKey);
}
