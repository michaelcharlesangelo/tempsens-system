import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface RowInput {
  itemNo?: string;
  description?: string;
  qty?: number | string;
  unit?: string;
  materialReady?: boolean;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const rows = Array.isArray(body.rows) ? (body.rows as RowInput[]) : [];

  const validRows = rows
    .map((r) => ({
      item_no: (r.itemNo || "").trim(),
      description: (r.description || "").trim(),
      qty: Number(r.qty) || 0,
      unit: (r.unit || "pcs").trim() || "pcs",
      material_ready: r.materialReady !== false,
    }))
    .filter((r) => r.item_no); // skip blank rows

  if (validRows.length === 0) {
    return NextResponse.json({ error: "Add at least one item with an Item No." }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("job_order_bom")
    .insert(validRows.map((r) => ({ ...r, job_order_id: params.id })))
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Grow the item catalog for future auto-fill.
  for (const r of validRows) {
    await admin
      .from("item_catalog")
      .upsert({ item_no: r.item_no, description: r.description, updated_at: new Date().toISOString() }, { onConflict: "item_no", ignoreDuplicates: true });
  }

  return NextResponse.json({ bomItems: data });
}
