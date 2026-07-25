import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { getCurrentProfile } from "@/lib/profile";
import { notify } from "@/lib/notifications";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await req.json();
  const result = body.result as string;
  const calibrationData = typeof body.calibrationData === "object" && body.calibrationData ? body.calibrationData : {};
  const reportNotes = typeof body.reportNotes === "string" ? body.reportNotes.trim() : "";

  if (!["pending", "pass", "fail"].includes(result)) {
    return NextResponse.json({ error: "Invalid result." }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("qc_records")
    .insert({
      job_order_id: params.id,
      performed_by: profile.id,
      result,
      calibration_data: calibrationData,
      report_notes: reportNotes,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: jo } = await admin.from("job_orders").select("jo_number, created_by").eq("id", params.id).maybeSingle();
  if (jo) {
    await notify(
      jo.created_by,
      "qc_recorded",
      `QC ${result}: ${jo.jo_number}`,
      `${profile.full_name || profile.email} recorded a QC result of "${result}".`,
      `/job-orders/${params.id}`
    );
  }

  return NextResponse.json({ qcRecord: data });
}
