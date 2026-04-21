/**
 * Supabase client for server-side reads from Next.js route handlers + Server
 * Components.
 *
 * Uses the *publishable* key (formerly called "anon") which is safe to expose —
 * RLS policies on Supabase gate what each caller can see. The pipeline uses a
 * separate secret key for writes.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase environment variables missing. Set NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (see .env.example).",
    );
  }

  _client = createClient(url, key, {
    auth: { persistSession: false },
  });
  return _client;
}
