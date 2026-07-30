import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const STATUSES = ["not_done", "in_progress", "done"];
const STATUS_LABELS: Record<string, string> = { not_done: "Not Done", in_progress: "In Progress", done: "Done" };

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const admin = getSupabaseAdminClient();

  // Engineering's status + comment update - one combined history entry,
  // same pattern as PO Out's Exim status panel.
  if (typeof body.action === "string" && body.action === "setStatus") {
    if (!STATUSES.includes(body.status)) return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    const changedBy = typeof body.changedBy === "string" && body.changedBy.trim() ? body.changedBy.trim() : "Unknown";
    const note = typeof body.comment === "string" ? body.comment.trim() : "";
    const updates: Record<string, unknown> = { status: body.status };
    if (body.status === "done") updates.resolved_at = new Date().toISOString();
    const { data, error } = await admin.from("complaints").update(updates).eq("id", params.id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const label = STATUS_LABELS[body.status];
    await admin.from("complaint_history").insert({
      complaint_id: params.id, changed_by: changedBy, status: body.status,
      comment: note ? `${label} - ${note}` : `Status changed to ${label}.`,
    });
    return NextResponse.json({ complaint: data });
  }

  const status = typeof body.status === "string" ? body.status : undefined;
  const suggestedAction = typeof body.suggestedAction === "string" ? body.suggestedAction : undefined;
  const archived = typeof body.archived === "boolean" ? body.archived : undefined;

  const updates: Record<string, unknown> = {};
  if (status) {
    updates.status = status;
    if (status === "done") updates.resolved_at = new Date().toISOString();
  }
  if (suggestedAction !== undefined) updates.suggested_action = suggestedAction;
  if (archived !== undefined) updates.archived = archived;
  if (typeof body.customerName === "string") updates.customer_name = body.customerName.trim();
  if (typeof body.soNo === "string") updates.so_no = body.soNo.trim();
  if (typeof body.itemDescription === "string") updates.item_description = body.itemDescription.trim();
  if (body.quantity !== undefined) updates.quantity = Number(body.quantity) || 0;
  if (typeof body.problemDescription === "string") updates.problem_description = body.problemDescription.trim();

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const { data, error } = await admin.from("complaints").update(updates).eq("id", params.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ complaint: data });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = getSupabaseAdminClient();
  const { error } = await admin.from("complaints").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
