import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Action = "approve" | "reject" | "cancel" | "register";

// current_approval_layer at the moment of action, not after - identifies
// which layer actually just approved/rejected.
const LAYER_LABELS: Record<number, string> = { 1: "Operational Manager", 2: "General Manager" };

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const action = body.action as Action;
  const typedComment = typeof body.comment === "string" ? body.comment.trim() : "";
  const by = typeof body.by === "string" && body.by.trim() ? body.by.trim() : "Unknown";

  const admin = getSupabaseAdminClient();
  const { data: form, error: fetchError } = await admin.from("purchase_forms").select("*").eq("id", params.id).maybeSingle();
  if (fetchError || !form) return NextResponse.json({ error: "Form not found." }, { status: 404 });

  const updates: Record<string, unknown> = {};
  let newStatus = form.status;
  // Falls back to an auto-generated comment naming the approving layer when
  // nothing was typed - the history list only shows entries with a comment,
  // so approving without typing one used to leave no visible record at all
  // of when (or by which layer) it happened.
  let comment = typedComment;
  const layerLabel = LAYER_LABELS[form.current_approval_layer as number] ?? "Approver";

  if (action === "cancel") {
    if (form.status !== "pending_approval") {
      return NextResponse.json({ error: `Can't cancel a form that's "${form.status}".` }, { status: 400 });
    }
    newStatus = "cancelled";
    updates.status = newStatus;
    updates.current_approval_layer = null;
    if (!comment) comment = "Cancelled.";
  } else if (action === "approve" || action === "reject") {
    if (form.status !== "pending_approval") {
      return NextResponse.json({ error: `Can't ${action} a form that's "${form.status}".` }, { status: 400 });
    }
    if (action === "reject") {
      newStatus = "rejected";
      updates.status = newStatus;
      updates.current_approval_layer = null;
      if (!comment) comment = `Rejected by ${layerLabel}.`;
    } else if (form.current_approval_layer === 1) {
      // Layer 1 (Operational Manager) clears -> on to General Manager.
      updates.current_approval_layer = 2;
      if (!comment) comment = `Approved by ${layerLabel}.`;
    } else {
      // Layer 2 (General Manager) clears -> fully approved.
      newStatus = "approved";
      updates.status = newStatus;
      updates.current_approval_layer = null;
      if (!comment) comment = `Approved by ${layerLabel}.`;
    }
  } else if (action === "register") {
    if (form.status !== "approved") {
      return NextResponse.json({ error: `Can't register a form that's "${form.status}".` }, { status: 400 });
    }
    updates.registered = true;
    if (!comment) comment = "Registered.";
  } else {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  const { data: updated, error: updateError } = await admin.from("purchase_forms").update(updates).eq("id", params.id).select().single();
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  await admin.from("purchase_form_history").insert({
    purchase_form_id: params.id, status: newStatus, changed_by: by, comment,
  });

  return NextResponse.json({ form: updated });
}
