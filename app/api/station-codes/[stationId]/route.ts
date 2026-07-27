import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function PATCH(req: NextRequest, { params }: { params: { stationId: string } }) {
  const body = await req.json();
  const updates: Record<string, unknown> = {};
  if (typeof body.parameter === "string") updates.parameter = body.parameter.trim();
  if (typeof body.description === "string") updates.description = body.description.trim();

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.from("station_codes").update(updates).eq("id", params.stationId).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ station: data });
}
