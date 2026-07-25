import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { getCurrentProfile } from "@/lib/profile";
import { generateShortCode } from "@/lib/jobOrders";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.from("station_codes").select("*").order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ stations: data });
}

export async function POST(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (profile.role !== "admin") {
    return NextResponse.json({ error: "Only admin can register stations." }, { status: 403 });
  }

  const body = await req.json();
  const stationName = typeof body.stationName === "string" ? body.stationName.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (!stationName) return NextResponse.json({ error: "Station name is required." }, { status: 400 });

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("station_codes")
    .insert({ code: generateShortCode(), station_name: stationName, description })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ station: data });
}
