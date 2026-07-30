import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CURRENCIES = ["IDR", "USD", "SGD", "EUR"];

export async function GET() {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("po_out")
    .select("*, history:po_out_history(*)")
    .order("created_at", { ascending: true })
    .order("changed_at", { foreignTable: "po_out_history", ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ pos: data });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const qty = Number(body.qty) || 0;
  const unitPrice = Number(body.unitPrice) || 0;
  const submittedBy = typeof body.submittedBy === "string" ? body.submittedBy.trim() : "";

  const row = {
    po_date: body.poDate || new Date().toISOString().slice(0, 10),
    deadline: body.deadline || null,
    urgent: Boolean(body.urgent),
    po_number: String(body.poNumber ?? "").trim(),
    item_code: String(body.itemCode ?? "").trim().toUpperCase(),
    sales: String(body.sales ?? "").trim(),
    customer_name: String(body.customerName ?? "").trim(),
    item_description: String(body.itemDescription ?? "").trim(),
    qty,
    unit: String(body.unit ?? "pcs").trim() || "pcs",
    unit_price: unitPrice,
    unit_price_currency: CURRENCIES.includes(body.unitPriceCurrency) ? body.unitPriceCurrency : "IDR",
    total_price: qty * unitPrice,
    unit_selling_price: Number(body.unitSellingPrice) || 0,
    unit_selling_price_currency: CURRENCIES.includes(body.unitSellingPriceCurrency) ? body.unitSellingPriceCurrency : "IDR",
    supplier: String(body.supplier ?? "").trim(),
    submitted_by: submittedBy,
  };

  if (!row.po_number || !row.supplier) {
    return NextResponse.json({ error: "PO Number and Supplier are required." }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.from("po_out").insert(row).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("po_out_history").insert({
    po_out_id: data.id, changed_by: submittedBy || "Unknown", comment: "Created.",
  });

  return NextResponse.json({ po: data });
}
