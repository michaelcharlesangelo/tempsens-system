import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request, { params }: { params: { stationId: string } }) {
  const admin = getSupabaseAdminClient();
  const { data: station } = await admin.from("station_codes").select("active").eq("id", params.stationId).maybeSingle();
  if (!station) return NextResponse.json({ error: "Station not found." }, { status: 404 });

  const { data, error } = await admin
    .from("station_codes")
    .update({ active: !station.active })
    .eq("id", params.stationId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ station: data });
}
