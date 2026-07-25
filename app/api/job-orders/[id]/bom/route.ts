import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { getCurrentProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await req.json();
  const itemCode = typeof body.itemCode === "string" ? body.itemCode.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const estimatedQty = Number(body.estimatedQty);
  const actualQty = Number(body.actualQty) || 0;
  const unit = typeof body.unit === "string" && body.unit ? body.unit : "pcs";

  if (!itemCode) return NextResponse.json({ error: "Item code is required." }, { status: 400 });
  if (!Number.isFinite(estimatedQty) || estimatedQty <= 0) {
    return NextResponse.json({ error: "Estimated quantity must be greater than 0." }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("job_order_bom")
    .insert({
      job_order_id: params.id,
      item_code: itemCode,
      description,
      estimated_qty: estimatedQty,
      actual_qty: actualQty,
      unit,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Grow the item catalog for future auto-fill, without overwriting an
  // existing description if this code is already known.
  await admin.from("item_catalog").upsert(
    { item_code: itemCode, description, updated_at: new Date().toISOString() },
    { onConflict: "item_code", ignoreDuplicates: true }
  );

  return NextResponse.json({ bomItem: data });
}
