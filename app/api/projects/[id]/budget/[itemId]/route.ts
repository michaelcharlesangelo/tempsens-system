import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CURRENCIES = ["IDR", "USD", "SGD", "EUR", "CNY", "JPY"];

export async function PATCH(req: NextRequest, { params }: { params: { itemId: string } }) {
  const body = await req.json();
  const admin = getSupabaseAdminClient();

  const updates: Record<string, unknown> = {};
  if (typeof body.itemDescription === "string") updates.item_description = body.itemDescription.trim();
  if (typeof body.supplier === "string") updates.supplier = body.supplier.trim();
  if (typeof body.unit === "string") updates.unit = body.unit.trim() || "pcs";
  if (typeof body.unitPriceCurrency === "string" && CURRENCIES.includes(body.unitPriceCurrency)) updates.unit_price_currency = body.unitPriceCurrency;
  if (body.qty !== undefined || body.unitPrice !== undefined) {
    const { data: current } = await admin.from("project_budget_items").select("qty, unit_price").eq("id", params.itemId).maybeSingle();
    const qty = body.qty !== undefined ? Number(body.qty) || 0 : Number(current?.qty) || 0;
    const unitPrice = body.unitPrice !== undefined ? Number(body.unitPrice) || 0 : Number(current?.unit_price) || 0;
    updates.qty = qty;
    updates.unit_price = unitPrice;
    updates.total_price = qty * unitPrice;
  }

  if (Object.keys(updates).length === 0) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  const { data, error } = await admin.from("project_budget_items").update(updates).eq("id", params.itemId).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}

export async function DELETE(req: NextRequest, { params }: { params: { itemId: string } }) {
  const admin = getSupabaseAdminClient();
  const { error } = await admin.from("project_budget_items").delete().eq("id", params.itemId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
