import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface ResultInput { parameter?: string; actual?: string; }

export async function POST(req: NextRequest) {
  const body = await req.json();
  const jobOrderId = typeof body.jobOrderId === "string" ? body.jobOrderId : "";
  const stationId = typeof body.stationId === "string" ? body.stationId : "";
  const results = Array.isArray(body.results)
    ? (body.results as ResultInput[])
        .map((r) => ({ parameter: String(r.parameter ?? ""), actual: String(r.actual ?? "").trim() }))
        .filter((r) => r.parameter)
    : [];

  if (!jobOrderId || !stationId) {
    return NextResponse.json({ error: "Job order and station are required." }, { status: 400 });
  }

  // Production login is bypassed for now (see CLAUDE.md) - every scan is
  // attributed to the "Production" label rather than a real account.
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("production_logs")
    .insert({ job_order_id: jobOrderId, station_id: stationId, scanned_by_label: "Production", results })
    .select("*, station:station_codes(station_name), account:production_accounts(full_name)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Drives the Dashboard's "Under Production - <Station> Station" label -
  // last station scanned, not a workflow state, so it doesn't touch
  // job_orders.status (which the approval/production state machine owns).
  const stationName = (data as { station?: { station_name?: string } }).station?.station_name;
  if (stationName) {
    await admin.from("job_orders").update({ current_station_name: stationName }).eq("id", jobOrderId);
  }

  return NextResponse.json({ log: data });
}
