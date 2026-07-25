import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { getCurrentProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const admin = getSupabaseAdminClient();

  const { data: jobOrders, error: joError } = await admin
    .from("job_orders")
    .select("id, jo_number, customer_name, material_issued")
    .in("status", ["acknowledged", "in_progress"]);
  if (joError) return NextResponse.json({ error: joError.message }, { status: 500 });

  const jobOrderIds = (jobOrders ?? []).map((j) => j.id);
  if (jobOrderIds.length === 0) return NextResponse.json({ items: [], jobOrders: [] });

  const { data: bomRows, error: bomError } = await admin
    .from("job_order_bom")
    .select("*")
    .in("job_order_id", jobOrderIds);
  if (bomError) return NextResponse.json({ error: bomError.message }, { status: 500 });

  const jobOrderMap = Object.fromEntries((jobOrders ?? []).map((j) => [j.id, j]));

  const grouped = new Map<string, { itemCode: string; description: string; unit: string; totalEstimatedQty: number; joBreakdown: { joNumber: string; customerName: string; qty: number }[] }>();

  for (const row of bomRows ?? []) {
    const key = row.item_code;
    const jo = jobOrderMap[row.job_order_id];
    if (!jo) continue;
    const existing = grouped.get(key);
    if (existing) {
      existing.totalEstimatedQty += row.estimated_qty;
      existing.joBreakdown.push({ joNumber: jo.jo_number, customerName: jo.customer_name, qty: row.estimated_qty });
    } else {
      grouped.set(key, {
        itemCode: row.item_code,
        description: row.description,
        unit: row.unit,
        totalEstimatedQty: row.estimated_qty,
        joBreakdown: [{ joNumber: jo.jo_number, customerName: jo.customer_name, qty: row.estimated_qty }],
      });
    }
  }

  return NextResponse.json({
    items: Array.from(grouped.values()).sort((a, b) => a.itemCode.localeCompare(b.itemCode)),
    jobOrders: jobOrders ?? [],
  });
}
