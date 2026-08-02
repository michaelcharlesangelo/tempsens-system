import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.from("shipment_packing_boxes").select("*").eq("shipment_id", params.id).order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ boxes: data });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.from("shipment_packing_boxes").insert({
    shipment_id: params.id,
    box_no: typeof body.boxNo === "string" ? body.boxNo.trim() : "",
    length_cm: Number(body.lengthCm) || 0,
    width_cm: Number(body.widthCm) || 0,
    height_cm: Number(body.heightCm) || 0,
    gross_weight_kg: Number(body.grossWeightKg) || 0,
    net_weight_kg: Number(body.netWeightKg) || 0,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ box: data });
}
