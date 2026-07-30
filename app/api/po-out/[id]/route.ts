import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const updates: Record<string, unknown> = {};

  if (typeof body.action === "string" && body.action === "cancel") {
    updates.status = "cancelled";
  } else {
    if (body.poDate) updates.po_date = body.poDate;
    if (body.deadline !== undefined) updates.deadline = body.deadline || null;
    if (typeof body.poNumber === "string") updates.po_number = body.poNumber.trim();
    if (typeof body.itemCode === "string") updates.item_code = body.itemCode.trim().toUpperCase();
    if (typeof body.sales === "string") updates.sales = body.sales.trim();
    if (typeof body.customerName === "string") updates.customer_name = body.customerName.trim();
    if (typeof body.itemDescription === "string") updates.item_description = body.itemDescription.trim();
    if (typeof body.unit === "string") updates.unit = body.unit.trim() || "pcs";
    if (typeof body.supplier === "string") updates.supplier = body.supplier.trim();
    if (typeof body.stockExport === "string") updates.stock_export = body.stockExport === "export" ? "export" : "stock";
    if (body.qty !== undefined || body.unitPrice !== undefined) {
      const admin0 = getSupabaseAdminClient();
      const { data: current } = await admin0.from("po_out").select("qty, unit_price").eq("id", params.id).maybeSingle();
      const qty = body.qty !== undefined ? Number(body.qty) || 0 : Number(current?.qty) || 0;
      const unitPrice = body.unitPrice !== undefined ? Number(body.unitPrice) || 0 : Number(current?.unit_price) || 0;
      updates.qty = qty;
      updates.unit_price = unitPrice;
      updates.total_price = qty * unitPrice;
    }
    if (body.unitSellingPrice !== undefined) updates.unit_selling_price = Number(body.unitSellingPrice) || 0;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.from("po_out").update(updates).eq("id", params.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ po: data });
}
