import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Uses the anon key + the request's auth cookies to figure out who's
// currently logged in (if anyone). Safe to use in Server Components and
// Route Handlers. Respects RLS (there isn't much configured, since
// authorization is enforced in application code - see supabaseAdmin.ts).
export function getSupabaseServerClient() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY in your environment."
    );
  }

  const cookieStore = cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // setAll can be called from a Server Component where cookies
          // can't be written - safe to ignore, middleware.ts handles
          // refreshing the session on every request instead.
        }
      },
    },
  });
}
