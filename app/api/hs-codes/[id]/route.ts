import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const updates: Record<string, unknown> = {};
  if (typeof body.code === "string" && body.code.trim()) updates.code = body.code.trim().toUpperCase();
  if (typeof body.description === "string") updates.description = body.description.trim();
  if (body.bm !== undefined) updates.bm = Number(body.bm) || 0;
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.from("hs_codes").update(updates).eq("id", params.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ hsCode: data });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = getSupabaseAdminClient();
  const { error } = await admin.from("hs_codes").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
