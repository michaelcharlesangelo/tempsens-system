import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { JobOrder } from "@/lib/jobOrders";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const admin = getSupabaseAdminClient();

  // Active JOs always show; completed ones stay visible for 7 days after
  // finish_date so Sales/etc. can still see it just finished, then drop off.
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: activeRaw, error: activeErr } = await admin
    .from("job_orders")
    .select("id, jo_number, jo_date, customer_name, so_no, item_category, item_description, quantity, item_no, sales_person_name, deadline, urgent, serial_numbers, finish_estimation, finish_date, status, current_station_name, current_approval_layer, created_at")
    .not("status", "in", "(cancelled,rejected)")
    .or(`status.neq.completed,finish_date.gte.${sevenDaysAgo}`)
    .order("created_at", { ascending: false });
  if (activeErr) return NextResponse.json({ error: activeErr.message }, { status: 500 });

  const yearStart = `${new Date().getFullYear()}-01-01T00:00:00Z`;
  const { data: completedRaw, error: compErr } = await admin
    .from("job_orders")
    .select("item_category, quantity, finish_date")
    .eq("status", "completed")
    .gte("finish_date", yearStart);
  if (compErr) return NextResponse.json({ error: compErr.message }, { status: 500 });

  const { data: categoriesRaw, error: catErr } = await admin
    .from("item_categories")
    .select("name, sequence")
    .order("sequence");
  if (catErr) return NextResponse.json({ error: catErr.message }, { status: 500 });

  const byCategory = new Map<string, number>();
  for (const c of (categoriesRaw ?? []) as { name: string }[]) byCategory.set(c.name, 0);
  for (const jo of (completedRaw ?? []) as { item_category: string; quantity: number }[]) {
    const cat = jo.item_category || "Uncategorized";
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + Number(jo.quantity));
  }
  const yearlyByCategory = Array.from(byCategory.entries()).map(([category, qty]) => ({ category, qty }));

  return NextResponse.json({
    activeJobOrders: (activeRaw ?? []) as JobOrder[],
    yearlyByCategory,
    year: new Date().getFullYear(),
  });
}
