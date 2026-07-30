import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CURRENCIES = ["IDR", "USD", "SGD", "EUR", "CNY", "JPY"];
const STATUSES = ["production", "shipment", "arrived"];
const STATUS_LABELS: Record<string, string> = { production: "Production", shipment: "Shipment", arrived: "Arrived" };

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const admin = getSupabaseAdminClient();

  if (typeof body.action === "string" && body.action === "setStatus") {
    if (!STATUSES.includes(body.status)) return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    const changedBy = typeof body.changedBy === "string" && body.changedBy.trim() ? body.changedBy.trim() : "Unknown";
    const note = typeof body.comment === "string" ? body.comment.trim() : "";
    const { data, error } = await admin.from("po_out").update({ status: body.status }).eq("id", params.id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const label = STATUS_LABELS[body.status];
    await admin.from("po_out_history").insert({
      po_out_id: params.id, changed_by: changedBy, status: body.status,
      comment: note ? `${label} - ${note}` : `Status changed to ${label}.`,
    });
    return NextResponse.json({ po: data });
  }

  const updates: Record<string, unknown> = {};
  if (body.poDate) updates.po_date = body.poDate;
  if (body.deadline !== undefined) updates.deadline = body.deadline || null;
  if (typeof body.urgent === "boolean") updates.urgent = body.urgent;
  if (typeof body.poNumber === "string") updates.po_number = body.poNumber.trim();
  if (typeof body.itemCode === "string") updates.item_code = body.itemCode.trim().toUpperCase();
  if (typeof body.sales === "string") updates.sales = body.sales.trim();
  if (typeof body.customerName === "string") updates.customer_name = body.customerName.trim();
  if (typeof body.itemDescription === "string") updates.item_description = body.itemDescription.trim();
  if (typeof body.unit === "string") updates.unit = body.unit.trim() || "pcs";
  if (typeof body.supplier === "string") updates.supplier = body.supplier.trim();
  if (typeof body.oc === "string") updates.oc = body.oc.trim();
  if (typeof body.origin === "string") updates.origin = body.origin.trim();
  if (typeof body.shipment === "string") updates.shipment = body.shipment.trim();
  if (typeof body.unitPriceCurrency === "string" && CURRENCIES.includes(body.unitPriceCurrency)) updates.unit_price_currency = body.unitPriceCurrency;
  if (typeof body.unitSellingPriceCurrency === "string" && CURRENCIES.includes(body.unitSellingPriceCurrency)) updates.unit_selling_price_currency = body.unitSellingPriceCurrency;
  if (body.qty !== undefined || body.unitPrice !== undefined) {
    const { data: current } = await admin.from("po_out").select("qty, unit_price").eq("id", params.id).maybeSingle();
    const qty = body.qty !== undefined ? Number(body.qty) || 0 : Number(current?.qty) || 0;
    const unitPrice = body.unitPrice !== undefined ? Number(body.unitPrice) || 0 : Number(current?.unit_price) || 0;
    updates.qty = qty;
    updates.unit_price = unitPrice;
    updates.total_price = qty * unitPrice;
  }
  if (body.unitSellingPrice !== undefined) updates.unit_selling_price = Number(body.unitSellingPrice) || 0;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const { data, error } = await admin.from("po_out").update(updates).eq("id", params.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ po: data });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = getSupabaseAdminClient();
  const { error } = await admin.from("po_out").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
