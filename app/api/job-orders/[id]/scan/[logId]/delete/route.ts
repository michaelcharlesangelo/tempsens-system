import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { getCurrentProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MANAGER_ROLES = ["admin", "production_manager", "warehouse_manager", "operational_manager"];

export async function POST(req: Request, { params }: { params: { id: string; logId: string } }) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!MANAGER_ROLES.includes(profile.role)) {
    return NextResponse.json({ error: "Only a manager can delete a production log entry." }, { status: 403 });
  }

  const admin = getSupabaseAdminClient();
  const { error } = await admin.from("production_logs").delete().eq("id", params.logId).eq("job_order_id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
