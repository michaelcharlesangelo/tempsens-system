import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function PATCH(req: NextRequest, { params }: { params: { id: string; rowId: string } }) {
  const body = await req.json();
  const updates: Record<string, unknown> = {};

  if (typeof body.itemNo === "string") updates.item_no = body.itemNo.trim();
  if (typeof body.description === "string") updates.description = body.description.trim();
  if (body.qty !== undefined) updates.qty = Number(body.qty) || 0;
  if (typeof body.unit === "string") updates.unit = body.unit;
  if (typeof body.materialReady === "boolean") updates.material_ready = body.materialReady;
  if (typeof body.materialPrepared === "boolean") updates.material_prepared = body.materialPrepared;
  if (typeof body.procurementMethod === "string") updates.procurement_method = body.procurementMethod;
  if (body.actualQty !== undefined) updates.actual_qty = body.actualQty === null || body.actualQty === "" ? null : Number(body.actualQty);
  if (typeof body.actualUnit === "string") updates.actual_unit = body.actualUnit;
  if (typeof body.comment === "string") updates.comment = body.comment;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.from("job_order_bom").update(updates).eq("id", params.rowId).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (updates.item_no || updates.description) {
    await admin
      .from("item_catalog")
      .upsert(
        { item_no: data.item_no, description: data.description, updated_at: new Date().toISOString() },
        { onConflict: "item_no" }
      );
  }

  if (updates.material_prepared !== undefined) {
    const { data: allRowsRaw } = await admin.from("job_order_bom").select("material_ready, material_prepared").eq("job_order_id", params.id);
    const allRows = (allRowsRaw ?? []) as { material_ready: boolean; material_prepared: boolean }[];
    const relevant = allRows.filter((r) => r.material_ready);
    const allPrepared = relevant.length > 0 && relevant.every((r) => r.material_prepared);
    if (allPrepared) {
      const { data: jo } = await admin.from("job_orders").select("status").eq("id", params.id).maybeSingle();
      if (jo?.status === "acknowledged") {
        await admin.from("job_orders").update({ status: "in_progress" }).eq("id", params.id);
      }
    }
  }

  return NextResponse.json({ bomItem: data });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string; rowId: string } }) {
  const admin = getSupabaseAdminClient();
  const { error } = await admin.from("job_order_bom").delete().eq("id", params.rowId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
