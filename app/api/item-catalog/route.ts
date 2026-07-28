import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") || "";
  const kind = req.nextUrl.searchParams.get("kind"); // "finished" | "material" | null (both)
  const admin = getSupabaseAdminClient();
  let query = admin.from("item_catalog").select("*").order("item_no").limit(q ? 50 : 500);
  if (q) query = query.ilike("item_no", `%${q}%`);
  if (kind) query = query.eq("kind", kind);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const itemNo = typeof body.itemNo === "string" ? body.itemNo.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const unit = typeof body.unit === "string" && body.unit.trim() ? body.unit.trim() : "pcs";
  const kind = body.kind === "finished" ? "finished" : "material";
  if (!itemNo) return NextResponse.json({ error: "Item code is required." }, { status: 400 });

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("item_catalog")
    .insert({ item_no: itemNo, description, unit, kind })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const itemNo = typeof body.itemNo === "string" ? body.itemNo.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : undefined;
  const unit = typeof body.unit === "string" ? body.unit.trim() : undefined;
  if (!itemNo) return NextResponse.json({ error: "Item code is required." }, { status: 400 });

  const admin = getSupabaseAdminClient();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (description !== undefined) updates.description = description;
  if (unit !== undefined && unit) updates.unit = unit;

  const { data, error } = await admin.from("item_catalog").update(updates).eq("item_no", itemNo).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}

export async function DELETE(req: NextRequest) {
  const itemNo = req.nextUrl.searchParams.get("itemNo");
  if (!itemNo) return NextResponse.json({ error: "Item code is required." }, { status: 400 });
  const admin = getSupabaseAdminClient();
  const { error } = await admin.from("item_catalog").delete().eq("item_no", itemNo);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
