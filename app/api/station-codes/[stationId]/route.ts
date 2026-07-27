import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function PATCH(req: NextRequest, { params }: { params: { stationId: string } }) {
  const body = await req.json();
  const updates: Record<string, unknown> = {};
  if (Array.isArray(body.parameters)) updates.parameters = body.parameters.map((p: unknown) => String(p).trim()).filter(Boolean);
  if (typeof body.description === "string") updates.description = body.description.trim();

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.from("station_codes").update(updates).eq("id", params.stationId).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ station: data });
}

export async function DELETE(req: NextRequest, { params }: { params: { stationId: string } }) {
  const admin = getSupabaseAdminClient();
  const { error } = await admin.from("station_codes").delete().eq("id", params.stationId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
