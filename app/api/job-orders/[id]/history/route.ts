import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Adds a comment-only history entry without changing the job order's
// status - e.g. Warehouse Manager noting material is prepared, which
// isn't itself a status transition.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const changedBy = typeof body.changedBy === "string" ? body.changedBy.trim() : "";
  const comment = typeof body.comment === "string" ? body.comment.trim() : "";
  if (!changedBy || !comment) {
    return NextResponse.json({ error: "changedBy and comment are required." }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  const { data: jo } = await admin.from("job_orders").select("status").eq("id", params.id).maybeSingle();
  if (!jo) return NextResponse.json({ error: "Job order not found." }, { status: 404 });

  const { data, error } = await admin
    .from("job_order_history")
    .insert({ job_order_id: params.id, status: jo.status, changed_by: changedBy, comment })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entry: data });
}
