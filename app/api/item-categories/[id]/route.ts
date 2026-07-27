import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const isTraded = typeof body.isTraded === "boolean" ? body.isTraded : undefined;

  const updates: Record<string, unknown> = {};
  if (name) updates.name = name;
  if (isTraded !== undefined) updates.is_traded = isTraded;

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.from("item_categories").update(updates).eq("id", params.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ category: data });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = getSupabaseAdminClient();
  const { error } = await admin.from("item_categories").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Close the gap left in `sequence` so remaining rows stay numbered
  // contiguously (1, 2, 3, ...) instead of skipping the deleted slot.
  const { data: remaining } = await admin.from("item_categories").select("id").order("sequence");
  if (remaining) {
    await Promise.all(remaining.map((row, i) => admin.from("item_categories").update({ sequence: i + 1 }).eq("id", row.id)));
  }

  return NextResponse.json({ ok: true });
}
