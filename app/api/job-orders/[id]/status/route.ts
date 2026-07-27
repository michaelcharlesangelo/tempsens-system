import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { APPROVAL_LAYERS } from "@/lib/jobOrders";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Action = "submit" | "approve" | "reject" | "acknowledge" | "send_to_qc" | "complete" | "cancel";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const action = body.action as Action;
  const comment = typeof body.comment === "string" ? body.comment.trim() : "";
  const by = typeof body.by === "string" && body.by.trim() ? body.by.trim() : "Unknown";

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
    const serialNo = typeof body.serialNo === "string" ? body.serialNo.trim() : "";
    const finishEstimation = typeof body.finishEstimation === "string" && body.finishEstimation ? body.finishEstimation : null;
    newStatus = "acknowledged";
    updates.status = newStatus;
    updates.serial_no = serialNo;
    updates.finish_estimation = finishEstimation;
    updates.acknowledged_at = new Date().toISOString();
  } else if (action === "send_to_qc") {
    if (!["acknowledged", "in_progress"].includes(jobOrder.status)) {
      return NextResponse.json({ error: `Can't send to QC from "${jobOrder.status}".` }, { status: 400 });
    }
    newStatus = "qc";
    updates.status = newStatus;
  } else if (action === "complete") {
    if (!["qc", "in_progress"].includes(jobOrder.status)) {
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

  if (action === "complete" && jobOrder.item_no) {
    const { data: bomRowsRaw } = await admin.from("job_order_bom").select("*").eq("job_order_id", params.id);
    const bomRows = (bomRowsRaw ?? []) as { item_no: string; description: string; qty: number; unit: string }[];
    if (bomRows.length > 0) {
      await admin.from("product_bom_templates").upsert({
        item_no: jobOrder.item_no,
        description: jobOrder.item_description,
        bom_snapshot: bomRows.map((b) => ({ itemNo: b.item_no, description: b.description, qty: b.qty, unit: b.unit })),
        saved_at: new Date().toISOString(),
        source_jo_number: jobOrder.jo_number,
        drawing_path: jobOrder.drawing_path,
        drawing_number: jobOrder.drawing_number || "",
      });
    }
  }

  await admin.from("job_order_history").insert({
    job_order_id: params.id,
    status: `${newStatus}${updates.current_approval_layer ? ` (layer ${updates.current_approval_layer})` : ""}`,
    changed_by: by,
    comment,
  });

  return NextResponse.json({ jobOrder: updated });
}
