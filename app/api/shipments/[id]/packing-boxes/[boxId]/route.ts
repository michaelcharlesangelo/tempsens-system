import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function PATCH(req: NextRequest, { params }: { params: { id: string; boxId: string } }) {
  const body = await req.json();
  const updates: Record<string, unknown> = {};
  if (typeof body.boxNo === "string") updates.box_no = body.boxNo.trim();
  if (body.lengthCm !== undefined) updates.length_cm = Number(body.lengthCm) || 0;
  if (body.widthCm !== undefined) updates.width_cm = Number(body.widthCm) || 0;
  if (body.heightCm !== undefined) updates.height_cm = Number(body.heightCm) || 0;
  if (body.grossWeightKg !== undefined) updates.gross_weight_kg = Number(body.grossWeightKg) || 0;
  if (body.netWeightKg !== undefined) updates.net_weight_kg = Number(body.netWeightKg) || 0;
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.from("shipment_packing_boxes").update(updates).eq("id", params.boxId).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ box: data });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string; boxId: string } }) {
  const admin = getSupabaseAdminClient();
  const { error } = await admin.from("shipment_packing_boxes").delete().eq("id", params.boxId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
