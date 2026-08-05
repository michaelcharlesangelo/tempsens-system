import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const STATUSES = ["ongoing", "finished"];

// Only Project Manager's own page exposes edit/delete for a progress entry
// (enforced client-side, same no-real-login pattern as the rest of the
// app) - the read-only Project tab can only add new ones via the sibling
// status route.
export async function PATCH(req: NextRequest, { params }: { params: { progressId: string } }) {
  const body = await req.json();
  const updates: Record<string, unknown> = {};
  if (typeof body.status === "string" && STATUSES.includes(body.status)) updates.status = body.status;
  if (typeof body.comment === "string") updates.comment = body.comment.trim();
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.from("project_progress").update(updates).eq("id", params.progressId).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entry: data });
}

export async function DELETE(req: NextRequest, { params }: { params: { progressId: string } }) {
  const admin = getSupabaseAdminClient();
  const { error } = await admin.from("project_progress").delete().eq("id", params.progressId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
