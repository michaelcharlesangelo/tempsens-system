import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { getCurrentProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request, { params }: { params: { stationId: string } }) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (profile.role !== "admin") {
    return NextResponse.json({ error: "Only admin can manage stations." }, { status: 403 });
  }

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
