import { getSupabaseAdminClient } from "./supabaseAdmin";
import { getSupabaseServerClient } from "./supabaseServer";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: string;
}

// Gets the currently logged-in user's profile (id, email, name, role), or
// null if nobody's logged in. Call this at the top of API routes to check
// "who is making this request" before allowing sensitive actions - e.g.
// only someone with role 'approver' or 'admin' should be able to approve a
// job order.
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (error || !data) return null;
  return data as Profile;
}
