import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Monthly consumption for the trailing 12 months, ending at the current
// month - drives the Items page's Usage bar chart.
export async function GET(req: NextRequest, { params }: { params: { itemNo: string } }) {
  const itemNo = decodeURIComponent(params.itemNo);
  const admin = getSupabaseAdminClient();

  const { data, error } = await admin
    .from("job_order_bom")
    .select("qty, created_at")
    .eq("item_no", itemNo);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const now = new Date();
  const buckets: { key: string; label: string; qty: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: `${MONTH_LABELS[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`, qty: 0 });
  }
  const byKey = new Map(buckets.map((b) => [b.key, b]));

  for (const row of (data ?? []) as { qty: number; created_at: string }[]) {
    const d = new Date(row.created_at);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const bucket = byKey.get(key);
    if (bucket) bucket.qty += Number(row.qty) || 0;
  }

  return NextResponse.json({ months: buckets.map(({ label, qty }) => ({ label, qty })) });
}
