import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const STATUSES = ["ongoing", "finished"];

// Anyone (Project Manager's own page, or the read-only Project tab) can
// post a progress update - it's the Status panel's Save button. Always
// updates the project's own status to match, and logs the entry either
// way even when the status didn't actually change (a comment-only note).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const status = typeof body.status === "string" ? body.status : "";
  if (!STATUSES.includes(status)) return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  const comment = typeof body.comment === "string" ? body.comment.trim() : "";
  const changedBy = typeof body.changedBy === "string" && body.changedBy.trim() ? body.changedBy.trim() : "Unknown";

  const admin = getSupabaseAdminClient();
  const { data: project, error } = await admin.from("projects").update({ status }).eq("id", params.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: entry, error: historyError } = await admin
    .from("project_progress")
    .insert({ project_id: params.id, status, comment, changed_by: changedBy })
    .select()
    .single();
  if (historyError) return NextResponse.json({ error: historyError.message }, { status: 500 });

  return NextResponse.json({ project, entry });
}
