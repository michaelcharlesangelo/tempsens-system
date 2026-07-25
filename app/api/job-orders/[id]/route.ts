import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { JobOrder } from "@/lib/jobOrders";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PO_VISIBLE_TABS = ["jo-input", "sales-manager", "operation-manager", "gm"];

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const tab = req.nextUrl.searchParams.get("tab");
  const admin = getSupabaseAdminClient();
  const { id } = params;

  const [jobOrderRes, bom, history, productionLogs, qcChecks] = await Promise.all([
    admin.from("job_orders").select("*").eq("id", id).maybeSingle(),
    admin.from("job_order_bom").select("*").eq("job_order_id", id).order("created_at"),
    admin.from("job_order_history").select("*").eq("job_order_id", id).order("changed_at", { ascending: false }),
    admin.from("production_logs").select("*").eq("job_order_id", id).order("scanned_at", { ascending: false }),
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
