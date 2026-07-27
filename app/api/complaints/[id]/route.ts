import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const status = typeof body.status === "string" ? body.status : undefined;
  const suggestedAction = typeof body.suggestedAction === "string" ? body.suggestedAction : undefined;
  const archived = typeof body.archived === "boolean" ? body.archived : undefined;

  const updates: Record<string, unknown> = {};
  if (status) {
    updates.status = status;
    if (status === "done") updates.resolved_at = new Date().toISOString();
  }
  if (suggestedAction !== undefined) updates.suggested_action = suggestedAction;
  if (archived !== undefined) updates.archived = archived;

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.from("complaints").update(updates).eq("id", params.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ complaint: data });
}
