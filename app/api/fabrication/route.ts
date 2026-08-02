import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const jobOrderId = req.nextUrl.searchParams.get("jobOrderId");
  const admin = getSupabaseAdminClient();
  let query = admin
    .from("fabrication_items")
    .select("*, job_order:job_orders(deadline, drawing_number)")
    .order("created_at", { ascending: false });
  if (jobOrderId) query = query.eq("job_order_id", jobOrderId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const jobOrderId = typeof body.jobOrderId === "string" && body.jobOrderId.trim() ? body.jobOrderId.trim() : null;
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const qty = Number(body.qty) || 0;
  const unit = typeof body.unit === "string" && body.unit.trim() ? body.unit.trim() : "pcs";

  const admin = getSupabaseAdminClient();

  // JO-linked rows always inherit jo_date/so_no from the parent JO (kept
  // accurate even if the client sent something else); standalone rows use
  // whatever was typed into the manual "+New Fabrication JO" form.
  let joDate = typeof body.joDate === "string" && body.joDate ? body.joDate : new Date().toISOString().slice(0, 10);
  let soNo = typeof body.soNo === "string" ? body.soNo.trim().toUpperCase() : "";

  if (jobOrderId) {
    const { data: jo } = await admin.from("job_orders").select("jo_date, so_no").eq("id", jobOrderId).maybeSingle();
    if (jo) { joDate = jo.jo_date; soNo = jo.so_no; }
  }

  const { data, error } = await admin
    .from("fabrication_items")
    .insert({ job_order_id: jobOrderId, jo_date: joDate, so_no: soNo, description, qty, unit })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}
