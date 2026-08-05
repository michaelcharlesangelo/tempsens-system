import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CURRENCIES = ["IDR", "USD", "SGD", "EUR", "CNY", "JPY"];

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const updates: Record<string, unknown> = {};

  if (typeof body.projectNumber === "string") updates.project_number = body.projectNumber.trim().toUpperCase();
  if (typeof body.customerName === "string") updates.customer_name = body.customerName.trim();
  if (typeof body.projectDescription === "string") updates.project_description = body.projectDescription.trim();
  if (typeof body.sales === "string") updates.sales = body.sales.trim();
  if (typeof body.hasPo === "boolean") {
    updates.has_po = body.hasPo;
    if (!body.hasPo) {
      updates.po_date = null;
      updates.po_number = "";
      updates.po_value = 0;
    }
  }
  if (body.hasPo !== false) {
    if (body.poDate !== undefined) updates.po_date = body.poDate || null;
    if (typeof body.poNumber === "string") updates.po_number = body.poNumber.trim().toUpperCase();
    if (body.poValue !== undefined) updates.po_value = Number(body.poValue) || 0;
    if (typeof body.poValueCurrency === "string" && CURRENCIES.includes(body.poValueCurrency)) updates.po_value_currency = body.poValueCurrency;
  }

  if (Object.keys(updates).length === 0) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.from("projects").update(updates).eq("id", params.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ project: data });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = getSupabaseAdminClient();
  const { error } = await admin.from("projects").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
