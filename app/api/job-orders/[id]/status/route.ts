import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { getCurrentProfile } from "@/lib/profile";
import { notify } from "@/lib/notifications";
import { APPROVAL_LAYERS } from "@/lib/jobOrders";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Action = "submit" | "approve" | "reject" | "acknowledge" | "send_to_qc" | "complete" | "cancel";

async function notifyRole(admin: ReturnType<typeof getSupabaseAdminClient>, role: string, type: string, title: string, message: string, link: string) {
  const { data: people } = await admin.from("profiles").select("id").eq("role", role);
  for (const person of people ?? []) {
    await notify(person.id, type, title, message, link);
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await req.json();
  const action = body.action as Action;
  const comment = typeof body.comment === "string" ? body.comment.trim() : "";

  const admin = getSupabaseAdminClient();
  const { data: jobOrder, error: fetchError } = await admin
    .from("job_orders")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (fetchError || !jobOrder) {
    return NextResponse.json({ error: "Job order not found." }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};
  let newStatus = jobOrder.status;

  if (action === "submit") {
    if (jobOrder.status !== "draft") {
      return NextResponse.json({ error: `Can't submit a job order that's "${jobOrder.status}".` }, { status: 400 });
    }
    newStatus = "pending_approval";
    updates.status = newStatus;
    updates.current_approval_layer = 1;
  } else if (action === "approve" || action === "reject") {
    if (jobOrder.status !== "pending_approval") {
      return NextResponse.json({ error: `Can't ${action} a job order that's "${jobOrder.status}".` }, { status: 400 });
    }
    const currentLayer = APPROVAL_LAYERS.find((l) => l.layer === jobOrder.current_approval_layer);
    if (!currentLayer) {
      return NextResponse.json({ error: "Job order has no valid approval layer set." }, { status: 400 });
    }
    if (profile.role !== "admin" && profile.role !== currentLayer.role) {
      return NextResponse.json({ error: `Only the ${currentLayer.label} can ${action} this right now.` }, { status: 403 });
    }
    if (action === "reject") {
      newStatus = "rejected";
      updates.status = newStatus;
    } else {
      const nextLayer = APPROVAL_LAYERS.find((l) => l.layer === currentLayer.layer + 1);
      if (nextLayer) {
        updates.current_approval_layer = nextLayer.layer;
        newStatus = "pending_approval";
      } else {
        newStatus = "approved";
        updates.status = newStatus;
        updates.current_approval_layer = null;
        updates.approved_at = new Date().toISOString();
      }
    }
  } else if (action === "acknowledge") {
    if (jobOrder.status !== "approved") {
      return NextResponse.json({ error: `Can't acknowledge a job order that's "${jobOrder.status}".` }, { status: 400 });
    }
    if (profile.role !== "admin" && profile.role !== "production_manager") {
      return NextResponse.json({ error: "Only the Production Manager can acknowledge a job order." }, { status: 403 });
    }
    newStatus = "acknowledged";
    updates.status = newStatus;
    updates.acknowledged_by = profile.id;
  } else if (action === "send_to_qc") {
    if (!["acknowledged", "in_progress"].includes(jobOrder.status)) {
      return NextResponse.json({ error: `Can't send to QC from "${jobOrder.status}".` }, { status: 400 });
    }
    newStatus = "qc";
    updates.status = newStatus;
  } else if (action === "complete") {
    if (jobOrder.status !== "qc") {
      return NextResponse.json({ error: `Can't complete a job order that's "${jobOrder.status}".` }, { status: 400 });
    }
    newStatus = "completed";
    updates.status = newStatus;
    updates.finish_date = new Date().toISOString();
  } else if (action === "cancel") {
    if (!["draft", "pending_approval", "approved", "acknowledged", "in_progress", "qc"].includes(jobOrder.status)) {
      return NextResponse.json({ error: `Can't cancel a job order that's "${jobOrder.status}".` }, { status: 400 });
    }
    newStatus = "cancelled";
    updates.status = newStatus;
  } else {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  const { data: updated, error: updateError } = await admin
    .from("job_orders")
    .update(updates)
    .eq("id", params.id)
    .select()
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  await admin.from("job_order_history").insert({
    job_order_id: params.id,
    status: `${newStatus}${updates.current_approval_layer ? ` (layer ${updates.current_approval_layer})` : ""}`,
    changed_by: profile.id,
    comment,
  });

  // Notify whoever needs to act next.
  if (action === "submit") {
    await notifyRole(admin, "sales_manager", "approval_pending", `Approval needed: ${updated.jo_number}`,
      `${profile.full_name || profile.email} submitted "${updated.customer_name}" for approval.`, `/job-orders/${updated.id}`);
  } else if (action === "approve" && updates.current_approval_layer) {
    const nextLayer = APPROVAL_LAYERS.find((l) => l.layer === updates.current_approval_layer);
    if (nextLayer) {
      await notifyRole(admin, nextLayer.role, "approval_pending", `Approval needed: ${updated.jo_number}`,
        `${profile.full_name || profile.email} approved - now awaiting ${nextLayer.label}.`, `/job-orders/${updated.id}`);
    }
  } else if (action === "approve" && newStatus === "approved") {
    await notifyRole(admin, "production_manager", "jo_approved", `Ready to acknowledge: ${updated.jo_number}`,
      `${updated.jo_number} was fully approved and is ready for production acknowledgement.`, `/job-orders/${updated.id}`);
    await notify(updated.created_by, "jo_approved", `${updated.jo_number} approved`, "Fully approved through all 3 layers.", `/job-orders/${updated.id}`);
  } else if (action === "reject") {
    await notify(updated.created_by, "jo_rejected", `${updated.jo_number} rejected`,
      comment || `${profile.full_name || profile.email} rejected this job order.`, `/job-orders/${updated.id}`);
  } else if (action === "acknowledge") {
    await notify(updated.created_by, "jo_acknowledged", `${updated.jo_number} acknowledged`,
      `${profile.full_name || profile.email} acknowledged this job order and is preparing the BOM.`, `/job-orders/${updated.id}`);
  }

  return NextResponse.json({ jobOrder: updated });
}
