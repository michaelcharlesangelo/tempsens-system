import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CURRENCIES = ["IDR", "USD", "SGD", "EUR", "CNY", "JPY"];

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const qty = Number(body.qty) || 0;
  const unitPrice = Number(body.unitPrice) || 0;

  const row = {
    project_id: params.id,
    progress_id: typeof body.progressId === "string" && body.progressId ? body.progressId : null,
    po_code: typeof body.poCode === "string" ? body.poCode.trim().toUpperCase() : "",
    item_description: typeof body.itemDescription === "string" ? body.itemDescription.trim() : "",
    supplier: typeof body.supplier === "string" ? body.supplier.trim() : "",
    qty,
    unit: typeof body.unit === "string" && body.unit.trim() ? body.unit.trim() : "pcs",
    unit_price: unitPrice,
    unit_price_currency: CURRENCIES.includes(body.unitPriceCurrency) ? body.unitPriceCurrency : "IDR",
    total_price: qty * unitPrice,
    submitted_by: typeof body.submittedBy === "string" ? body.submittedBy.trim() : "",
  };

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.from("project_cost_items").insert(row).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}
