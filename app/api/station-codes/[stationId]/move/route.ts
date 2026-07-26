import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { StationCode } from "@/lib/jobOrders";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest, { params }: { params: { stationId: string } }) {
  const body = await req.json();
  const direction = body.direction === "up" ? "up" : "down";

  const admin = getSupabaseAdminClient();
  const { data: stationsData } = await admin.from("station_codes").select("*").order("sequence");
  if (!stationsData) return NextResponse.json({ error: "No stations found." }, { status: 404 });
  const stations = stationsData as StationCode[];

  const idx = stations.findIndex((s) => s.id === params.stationId);
  if (idx === -1) return NextResponse.json({ error: "Station not found." }, { status: 404 });

  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= stations.length) {
    return NextResponse.json({ error: "Already at the edge." }, { status: 400 });
  }

  const a = stations[idx];
  const b = stations[swapIdx];

  await admin.from("station_codes").update({ sequence: b.sequence }).eq("id", a.id);
  await admin.from("station_codes").update({ sequence: a.sequence }).eq("id", b.id);

  const { data: updated } = await admin.from("station_codes").select("*").order("sequence");
  return NextResponse.json({ stations: updated });
}
