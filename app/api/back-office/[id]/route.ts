import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { hashPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const password = typeof body.password === "string" ? body.password : "";
  const email = typeof body.email === "string" ? body.email.trim() : undefined;

  const updates: Record<string, unknown> = {};
  if (password) updates.password_hash = hashPassword(password);
  if (email !== undefined) updates.email = email;
  if ("positionId" in body) updates.position_id = typeof body.positionId === "string" && body.positionId ? body.positionId : null;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.from("back_office").update(updates).eq("id", params.id).select("id, name, email, position_id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ person: data });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = getSupabaseAdminClient();
  const { error } = await admin.from("back_office").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
