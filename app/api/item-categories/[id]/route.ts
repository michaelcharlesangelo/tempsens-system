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
  return NextResponse.json({ ok: true });
}
