import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  // Item code is optional - a row can be added before the exact part is
  // decided (e.g. not in stock yet); the caller flags it Not Available
  // (materialReady: false) in that case instead of blocking the add.
  const itemNo = typeof body.itemNo === "string" ? body.itemNo.trim().toUpperCase() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const qty = Number(body.qty) || 0;
  const unit = typeof body.unit === "string" && body.unit ? body.unit : "pcs";
  const materialReady = body.materialReady !== false;

  const admin = getSupabaseAdminClient();
  const { data: jobOrder } = await admin.from("job_orders").select("status").eq("id", params.id).maybeSingle();
  if (jobOrder?.status === "completed") {
    return NextResponse.json({ error: "This job order is finished and can no longer be edited." }, { status: 400 });
  }

  const { data, error } = await admin
    .from("job_order_bom")
    .insert({ job_order_id: params.id, item_no: itemNo, description, qty, unit, material_ready: materialReady })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (itemNo) {
    await admin
      .from("item_catalog")
      .upsert({ item_no: itemNo, description, unit, updated_at: new Date().toISOString() }, { onConflict: "item_no", ignoreDuplicates: true });
  }

  return NextResponse.json({ bomItem: data });
}
