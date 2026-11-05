"use server";

import { createClient } from "@/lib/supabase/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function unsubscribe(token: string): Promise<boolean> {
  if (!UUID_RE.test(token)) return false;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("public_unsubscribe", { p_token: token });
  return !error && data === true;
}
