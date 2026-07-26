import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const itemNo = typeof body.itemNo === "string" ? body.itemNo.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const qty = Number(body.qty) || 0;
  const unit = typeof body.unit === "string" && body.unit ? body.unit : "pcs";
  const materialReady = body.materialReady !== false;

  if (!itemNo) return NextResponse.json({ error: "Item code is required." }, { status: 400 });

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("job_order_bom")
    .insert({ job_order_id: params.id, item_no: itemNo, description, qty, unit, material_ready: materialReady })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin
    .from("item_catalog")
    .upsert({ item_no: itemNo, description, updated_at: new Date().toISOString() }, { onConflict: "item_no", ignoreDuplicates: true });

  return NextResponse.json({ bomItem: data });
}
