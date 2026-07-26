import { createClient } from "@supabase/supabase-js";

// Server-only client using the service_role key. Used by API routes for
// all data reads/writes - bypasses Row Level Security, so authorization
// (who's allowed to do what) is enforced in application code by checking
// the logged-in user's role from `profiles`, not by RLS policies. Never
// import this into a "use client" component.
export function getSupabaseAdminClient() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY " +
        "in your environment (see .env.example)."
    );
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
    global: {
      // Next.js's App Router patches the global fetch() to cache GET
      // requests by default, which can cause reads to silently return a
      // stale snapshot even right after a write. Learned this the hard
      // way on the thermocouple pricer - fixing it here from day one.
      fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init, cache: "no-store" }),
    },
  });
}
