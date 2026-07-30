import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { BomItem } from "@/lib/jobOrders";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface JoSummary { id: string; jo_number: string; customer_name: string; so_no: string; }

export async function GET() {
  const admin = getSupabaseAdminClient();

  // Same widened scope as prepare-list - a "Not Available" flag shouldn't
  // disappear just because the JO moved on to qc/completed.
  const { data: joRowsRaw } = await admin
    .from("job_orders")
    .select("id, jo_number, customer_name, so_no")
    .in("status", ["acknowledged", "in_progress", "qc", "completed"]);
  const joRows = (joRowsRaw ?? []) as JoSummary[];

  const jobOrderIds = joRows.map((j) => j.id);
  if (jobOrderIds.length === 0) return NextResponse.json({ items: [] });

  const { data: bomRowsRaw, error } = await admin
    .from("job_order_bom")
    .select("*")
    .in("job_order_id", jobOrderIds)
    .eq("material_ready", false);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const bomRows = (bomRowsRaw ?? []) as BomItem[];

  const joMap: Record<string, JoSummary> = Object.fromEntries(joRows.map((j) => [j.id, j]));
  const items = bomRows.map((b) => ({
    ...b,
    jo_number: joMap[b.job_order_id]?.jo_number ?? "-",
    customer_name: joMap[b.job_order_id]?.customer_name ?? "-",
    so_no: joMap[b.job_order_id]?.so_no ?? "-",
  }));

  return NextResponse.json({ items });
}
