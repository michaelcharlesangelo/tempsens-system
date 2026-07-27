import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface ResultInput { parameter?: string; actual?: string; }

export async function POST(req: NextRequest) {
  const body = await req.json();
  const jobOrderId = typeof body.jobOrderId === "string" ? body.jobOrderId : "";
  const stationId = typeof body.stationId === "string" ? body.stationId : "";
  const scannedBy = typeof body.scannedBy === "string" ? body.scannedBy : "";
  const results = Array.isArray(body.results)
    ? (body.results as ResultInput[])
        .map((r) => ({ parameter: String(r.parameter ?? ""), actual: String(r.actual ?? "").trim() }))
        .filter((r) => r.parameter)
    : [];

  if (!jobOrderId || !stationId || !scannedBy) {
    return NextResponse.json({ error: "Job order, station, and scanned-by account are required." }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("production_logs")
    .insert({ job_order_id: jobOrderId, station_id: stationId, scanned_by: scannedBy, results })
    .select("*, station:station_codes(station_name), account:production_accounts(full_name)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ log: data });
}
