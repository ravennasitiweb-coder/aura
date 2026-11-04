import { createBrowserClient } from "@supabase/ssr";
import { supabaseEnv } from "./env";

// Client per i componenti che girano nel browser ("use client").
export function createClient() {
  const { url, key } = supabaseEnv();
  return createBrowserClient(url, key);
}
