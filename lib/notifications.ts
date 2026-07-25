import { getSupabaseAdminClient } from "./supabaseAdmin";

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  created_at: string;
}

// Creates a notification for a specific user - call this wherever
// something now needs their attention (a job order awaiting their
// approval, a task assigned to them, etc). Shows up as the badge count on
// their next login and in their notifications list.
export async function notify(userId: string, type: string, title: string, message: string, link?: string) {
  const admin = getSupabaseAdminClient();
  await admin.from("notifications").insert({
    user_id: userId,
    type,
    title,
    message,
    link: link ?? null,
  });
}
