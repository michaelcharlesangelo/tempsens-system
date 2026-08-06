import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { JobOrder } from "@/lib/jobOrders";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const admin = getSupabaseAdminClient();

  // Only JOs that have cleared General Manager approval show here (not
  // draft/pending_approval/cancelled/rejected). Completed ones used to drop
  // off automatically 7 days after finish_date - now the client filters
  // them via a Hide Finished toggle instead, so every completed JO stays
  // queryable (also needed for the Production bar graph's year tabs, which
  // recompute the category breakdown from this same set). Oldest JO date
  // first by default.
  const { data: activeRaw, error: activeErr } = await admin
    .from("job_orders")
    .select("id, jo_number, jo_date, customer_name, so_no, item_category, item_description, quantity, item_no, sales_person_name, deadline, urgent, serial_numbers, finish_estimation, finish_date, status, current_station_name, current_approval_layer, created_at, history:job_order_history(id, job_order_id, status, changed_by, comment, changed_at)")
    .not("status", "in", "(draft,pending_approval,cancelled,rejected)")
    .order("jo_date", { ascending: true })
    .order("changed_at", { foreignTable: "job_order_history", ascending: true });
  if (activeErr) return NextResponse.json({ error: activeErr.message }, { status: 500 });

  const { data: categoriesRaw, error: catErr } = await admin
    .from("item_categories")
    .select("name, sequence")
    .order("sequence");
  if (catErr) return NextResponse.json({ error: catErr.message }, { status: 500 });

  return NextResponse.json({
    activeJobOrders: (activeRaw ?? []) as JobOrder[],
    categories: (categoriesRaw ?? []).map((c: { name: string }) => c.name),
  });
}
