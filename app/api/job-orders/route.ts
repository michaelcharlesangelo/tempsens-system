import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { getCurrentProfile } from "@/lib/profile";
import { generateJoNumber, generateShortCode, PO_VISIBLE_ROLES, JobOrder } from "@/lib/jobOrders";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function stripPoIfUnauthorized(jo: JobOrder, role: string): JobOrder {
  if (PO_VISIBLE_ROLES.includes(role)) return jo;
  const { po_attachment_url, ...rest } = jo;
  return { ...rest, po_attachment_url: undefined };
}

export async function GET(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const status = req.nextUrl.searchParams.get("status");
  const admin = getSupabaseAdminClient();
  let query = admin.from("job_orders").select("*").order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const jobOrders = (data as JobOrder[]).map((jo) => stripPoIfUnauthorized(jo, profile.role));
  return NextResponse.json({ jobOrders });
}

export async function POST(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await req.json();
  const customerName = typeof body.customerName === "string" ? body.customerName.trim() : "";
  const soNo = typeof body.soNo === "string" ? body.soNo.trim() : "";
  const itemCategory = typeof body.itemCategory === "string" ? body.itemCategory.trim() : "";
  const itemDescription = typeof body.itemDescription === "string" ? body.itemDescription.trim() : "";
  const quantity = Number(body.quantity) || 1;
  const itemCode = typeof body.itemCode === "string" ? body.itemCode.trim() : "";
  const serialNo = typeof body.serialNo === "string" ? body.serialNo.trim() : "";
  const deadline = typeof body.deadline === "string" && body.deadline ? body.deadline : null;

  if (!customerName) {
    return NextResponse.json({ error: "Customer name is required." }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();

  const yearStart = `${new Date().getFullYear()}-01-01`;
  const { count } = await admin
    .from("job_orders")
    .select("id", { count: "exact", head: true })
    .gte("created_at", yearStart);

  const joNumber = generateJoNumber(count ?? 0);

  const { data, error } = await admin
    .from("job_orders")
    .insert({
      jo_number: joNumber,
      customer_name: customerName,
      so_no: soNo,
      item_category: itemCategory,
      item_description: itemDescription,
      quantity,
      item_code: itemCode,
      serial_no: serialNo,
      deadline,
      barcode: generateShortCode(),
      status: "draft",
      created_by: profile.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Grow the item catalog with this code/description if it's new.
  if (itemCode) {
    await admin
      .from("item_catalog")
      .upsert({ item_code: itemCode, description: itemDescription, category: itemCategory }, { onConflict: "item_code", ignoreDuplicates: true });
  }

  await admin.from("job_order_history").insert({
    job_order_id: data.id,
    status: "draft",
    changed_by: profile.id,
    comment: "Job order created.",
  });

  return NextResponse.json({ jobOrder: data });
}
