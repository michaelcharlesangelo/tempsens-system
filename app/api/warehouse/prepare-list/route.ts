import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { BomItem } from "@/lib/jobOrders";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface JoSummary { id: string; jo_number: string; so_no: string; acknowledged_at: string | null; status: string; }

export async function GET() {
  const admin = getSupabaseAdminClient();

  // Was scoped to just "acknowledged"/"in_progress" - once a JO moved past
  // that (qc, completed), its already-prepared rows vanished from this
  // page entirely, which read as Warehouse Manager data going missing.
  // Widened to cover the rest of the post-acknowledge lifecycle too.
  const { data: joRowsRaw } = await admin
    .from("job_orders")
    .select("id, jo_number, so_no, acknowledged_at, status")
    .in("status", ["acknowledged", "in_progress", "qc", "completed"]);
  const joRows = (joRowsRaw ?? []) as JoSummary[];

  const jobOrderIds = joRows.map((j) => j.id);
  if (jobOrderIds.length === 0) return NextResponse.json({ items: [] });

  const { data: bomRowsRaw, error } = await admin
    .from("job_order_bom")
    .select("*")
    .in("job_order_id", jobOrderIds)
    .eq("material_ready", true)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const bomRows = (bomRowsRaw ?? []) as BomItem[];

  const joMap: Record<string, JoSummary> = Object.fromEntries(joRows.map((j) => [j.id, j]));
  const items = bomRows.map((b) => ({
    ...b,
    jo_number: joMap[b.job_order_id]?.jo_number ?? "-",
    so_no: joMap[b.job_order_id]?.so_no ?? "-",
    req_date: joMap[b.job_order_id]?.acknowledged_at ?? null,
  }));

  return NextResponse.json({ items });
}
