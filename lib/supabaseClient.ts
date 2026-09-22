import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Public anon credentials (safe in client) for gather-room voice presence. */
const DEFAULT_SUPABASE_URL = "https://kxbeofqiahloeqkillvy.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4YmVvZnFpYWhsb2Vxa2lsbHZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5Njg3MjUsImV4cCI6MjEwNDU0NDcyNX0.t8ro7wZ2cQBchfVOpemPE3oe1miLBtl21KroELR6pqA";

let client: SupabaseClient | null | undefined;

function resolveSupabaseConfig(): { url: string; key: string } | null {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || DEFAULT_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    DEFAULT_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return { url, key };
}

/** Realtime presence discovery (avoids contested PeerJS host ids on 0.peerjs.com). */
export function isPresenceDiscoveryEnabled(): boolean {
  return resolveSupabaseConfig() != null;
}

export function getSupabaseClient(): SupabaseClient | null {
  if (client !== undefined) return client;
  const cfg = resolveSupabaseConfig();
  if (!cfg) {
    client = null;
    return client;
  }
  const { url, key } = cfg;
  client = createClient(url, key, {
    realtime: { params: { eventsPerSecond: 8 } },
  });
  return client;
}
