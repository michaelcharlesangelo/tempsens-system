import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { getCurrentProfile } from "@/lib/profile";
import { PO_VISIBLE_ROLES, JobOrder } from "@/lib/jobOrders";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const admin = getSupabaseAdminClient();
  const { id } = params;

  const [jobOrderRes, bom, purchaseRequests, qcRecords, history, productionLogs] = await Promise.all([
    admin.from("job_orders").select("*").eq("id", id).maybeSingle(),
    admin.from("job_order_bom").select("*").eq("job_order_id", id).order("created_at"),
    admin.from("purchase_requests").select("*").eq("job_order_id", id).order("created_at"),
    admin.from("qc_records").select("*").eq("job_order_id", id).order("performed_at", { ascending: false }),
    admin.from("job_order_history").select("*").eq("job_order_id", id).order("changed_at", { ascending: false }),
    admin.from("production_logs").select("*").eq("job_order_id", id).order("scanned_at", { ascending: false }),
  ]);

  if (jobOrderRes.error || !jobOrderRes.data) {
    return NextResponse.json({ error: "Job order not found." }, { status: 404 });
  }

  let jobOrder = jobOrderRes.data as JobOrder;
  if (!PO_VISIBLE_ROLES.includes(profile.role)) {
    jobOrder = { ...jobOrder, po_attachment_url: undefined };
  }

  return NextResponse.json({
    jobOrder,
    bom: bom.data ?? [],
    purchaseRequests: purchaseRequests.data ?? [],
    qcRecords: qcRecords.data ?? [],
    history: history.data ?? [],
    productionLogs: productionLogs.data ?? [],
  });
}
