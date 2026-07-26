import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  if (!("positionId" in body)) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }
  const positionId = typeof body.positionId === "string" && body.positionId ? body.positionId : null;

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("production_accounts")
    .update({ position_id: positionId })
    .eq("id", params.id)
    .select("id, username, full_name, position_id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ account: data });
}
