import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { getCurrentProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await req.json();
  const stationCode = typeof body.stationCode === "string" ? body.stationCode.trim() : "";
  if (!stationCode) return NextResponse.json({ error: "Station code is required." }, { status: 400 });

  const admin = getSupabaseAdminClient();

  const { data: station } = await admin.from("station_codes").select("*").eq("code", stationCode).maybeSingle();
  if (!station) return NextResponse.json({ error: "Unrecognized station QR code." }, { status: 404 });
  if (!station.active) return NextResponse.json({ error: `Station "${station.station_name}" is no longer active.` }, { status: 400 });

  const { data: jobOrder } = await admin.from("job_orders").select("*").eq("id", params.id).maybeSingle();
  if (!jobOrder) return NextResponse.json({ error: "Job order not found." }, { status: 404 });
  if (!["acknowledged", "in_progress"].includes(jobOrder.status)) {
    return NextResponse.json({ error: `Can't log production for a job order that's "${jobOrder.status}".` }, { status: 400 });
  }

  const { data: log, error } = await admin
    .from("production_logs")
    .insert({ job_order_id: params.id, station_id: station.id, scanned_by: profile.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (jobOrder.status === "acknowledged") {
    await admin.from("job_orders").update({ status: "in_progress" }).eq("id", params.id);
  }

  return NextResponse.json({ log, station });
}
