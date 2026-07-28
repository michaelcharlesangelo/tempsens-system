import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const updates: Record<string, unknown> = {};
  if (Array.isArray(body.serialNumbers)) updates.serial_numbers = body.serialNumbers.map((s: unknown) => String(s ?? "").trim());
  if (typeof body.finishEstimation === "string") updates.finish_estimation = body.finishEstimation || null;
  if (typeof body.finishDate === "string") updates.finish_date = body.finishDate || null;
  if (typeof body.readyForProduction === "boolean") updates.ready_for_production = body.readyForProduction;
  if (typeof body.costingDone === "boolean") updates.costing_done = body.costingDone;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.from("job_orders").update(updates).eq("id", params.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ jobOrder: data });
}
