import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const comment = typeof body.comment === "string" ? body.comment.trim() : "";
  const changedBy = typeof body.changedBy === "string" && body.changedBy.trim() ? body.changedBy.trim() : "Unknown";
  if (!comment) return NextResponse.json({ error: "Comment is required." }, { status: 400 });

  const admin = getSupabaseAdminClient();
  const { error } = await admin.from("po_out_history").insert({ po_out_id: params.id, changed_by: changedBy, comment });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
