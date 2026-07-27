import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { JobOrder } from "@/lib/jobOrders";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PO_VISIBLE_TABS = ["jo-input", "sales-support-supervisor", "sales-manager", "operation-manager", "gm"];

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const tab = req.nextUrl.searchParams.get("tab");
  const admin = getSupabaseAdminClient();
  const { id } = params;

  const [jobOrderRes, bom, history, productionLogs, qcChecks] = await Promise.all([
    admin.from("job_orders").select("*").eq("id", id).maybeSingle(),
    admin.from("job_order_bom").select("*").eq("job_order_id", id).order("created_at"),
    admin.from("job_order_history").select("*").eq("job_order_id", id).order("changed_at", { ascending: true }),
    admin
      .from("production_logs")
      .select("*, station:station_codes(station_name, parameter), account:production_accounts(full_name)")
      .eq("job_order_id", id)
      .order("scanned_at", { ascending: false }),
    admin.from("qc_checks").select("*").eq("job_order_id", id).order("performed_at", { ascending: false }),
  ]);

  if (jobOrderRes.error || !jobOrderRes.data) {
    return NextResponse.json({ error: "Job order not found." }, { status: 404 });
  }

  let jobOrder = jobOrderRes.data as JobOrder;
  if (!tab || !PO_VISIBLE_TABS.includes(tab)) {
    jobOrder = { ...jobOrder, po_attachment_path: undefined };
  }

  return NextResponse.json({
    jobOrder,
    bom: bom.data ?? [],
    history: history.data ?? [],
    productionLogs: productionLogs.data ?? [],
    qcChecks: qcChecks.data ?? [],
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const serialNo = typeof body.serialNo === "string" ? body.serialNo.trim() : undefined;
  const finishEstimation = typeof body.finishEstimation === "string" ? body.finishEstimation : undefined;

  const admin = getSupabaseAdminClient();
  const { data: jobOrder } = await admin.from("job_orders").select("status").eq("id", params.id).maybeSingle();
  if (!jobOrder) return NextResponse.json({ error: "Job order not found." }, { status: 404 });

  const updates: Record<string, unknown> = {};
  if (serialNo !== undefined) updates.serial_no = serialNo;
  if (finishEstimation !== undefined) updates.finish_estimation = finishEstimation || null;

  // First time filling these in on an approved job order acknowledges it.
  if (jobOrder.status === "approved") {
    updates.status = "acknowledged";
  }

  const { data, error } = await admin.from("job_orders").update(updates).eq("id", params.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (updates.status === "acknowledged") {
    await admin.from("job_order_history").insert({
      job_order_id: params.id,
      status: "acknowledged",
      changed_by: "Production Manager",
      comment: "Acknowledged with serial no. / finish estimation.",
    });
  }

  return NextResponse.json({ jobOrder: data });
}
